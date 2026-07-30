import { EnrichmentResult } from "../types";
import { HunterEnrichmentProvider } from "./providers/hunter";
import { SnovEnrichmentProvider } from "./providers/snov";
import { CompanySearchResult, CandidateLead } from "../types/leads";
import { webSearch, resolveCompanyDomain, isBlockedHost } from "./webSearch";
import { scrape } from "./webScraper";
import { callAI } from "./aiRouter";
import { buildEnrichmentPrompt, ENRICHMENT_SYSTEM } from "../prompts/enrichmentPrompts";

/**
 * Enrichment is provider-agnostic by design: swapping providers (Hunter,
 * Snov, or this default web-search provider) for a paid people-data API
 * (People Data Labs, Coresignal, Datagma, etc.) means implementing this
 * interface — nothing else in the app changes.
 */
export interface EnrichmentProvider {
  name: string;
  lookup(query: string, domain?: string): Promise<EnrichmentResult>;
}

/**
 * Default provider when no paid enrichment API key is configured. Instead of
 * a static template (the old MockEnrichmentProvider — same fake company/
 * funding/tech-stack for every query), this does a real, query-specific
 * lookup: free web search (DuckDuckGo) finds relevant real sources, the
 * company's real site gets scraped when found, and an AI pass turns the real
 * source material into a structured profile — grounded explicitly against
 * inventing facts. Two different queries now produce two different, real
 * answers instead of the same fake one.
 */
class WebSearchEnrichmentProvider implements EnrichmentProvider {
  name = "web-search";

  async lookup(query: string, domain?: string): Promise<EnrichmentResult> {
    const cleaned = query.trim();
    const looksLikeCompany = /(inc|llc|labs|technologies|co\.|corp)$/i.test(cleaned);

    let resolvedDomain = domain;
    const sources: string[] = [];

    if (!resolvedDomain && looksLikeCompany) {
      const resolved = await resolveCompanyDomain(cleaned);
      if (resolved) {
        resolvedDomain = resolved.domain;
        sources.push(resolved.url);
      }
    }

    const searchQuery = looksLikeCompany || domain ? cleaned : `${cleaned} LinkedIn`;
    const searchResults = await webSearch(searchQuery, 6);
    for (const r of searchResults) if (!sources.includes(r.url)) sources.push(r.url);

    let pageTitle: string | undefined;
    let pageMetaDescription: string | undefined;
    let pageText: string | undefined;

    if (resolvedDomain) {
      try {
        const scraped = await scrape(`https://${resolvedDomain}`);
        pageTitle = scraped.title;
        pageMetaDescription = scraped.metaTags?.description;
        pageText = scraped.text;
        if (!sources.includes(`https://${resolvedDomain}`)) sources.push(`https://${resolvedDomain}`);
      } catch {
        // Site unreachable — proceed with search results only.
      }
    }

    const prompt = buildEnrichmentPrompt({ query: cleaned, domain: resolvedDomain, searchResults, pageTitle, pageMetaDescription, pageText });
    const aiRaw = await callAI(prompt, ENRICHMENT_SYSTEM, 1500);

    const parsed = aiRaw ? parseEnrichmentJson(aiRaw) : null;
    if (parsed?.company || parsed?.person) {
      return {
        person: parsed.person ?? { name: looksLikeCompany ? "Unknown — company search" : cleaned },
        company: parsed.company,
        sources: sources.length ? sources : ["web-search"],
      };
    }

    // AI unavailable or parse failed — fall back to what real search actually
    // found, so results still vary per query instead of collapsing to a
    // static template.
    return buildFallbackFromSearch(cleaned, looksLikeCompany, resolvedDomain, searchResults, pageMetaDescription, sources);
  }
}

interface ParsedEnrichment {
  person?: EnrichmentResult["person"];
  company?: EnrichmentResult["company"];
}

function parseEnrichmentJson(raw: string): ParsedEnrichment | null {
  try {
    const fenced = raw.match(/```(?:json)?[\r\n]?([\s\S]*?)```/);
    return JSON.parse((fenced ? fenced[1] : raw).trim()) as ParsedEnrichment;
  } catch {
    return null;
  }
}

function buildFallbackFromSearch(
  query: string,
  looksLikeCompany: boolean,
  domain: string | undefined,
  searchResults: { title: string; url: string; snippet: string }[],
  pageMetaDescription: string | undefined,
  sources: string[]
): EnrichmentResult {
  const top = searchResults[0];
  const description = pageMetaDescription || top?.snippet || undefined;

  if (looksLikeCompany || domain) {
    return {
      person: { name: "Unknown — company search" },
      company: {
        name: query,
        domain,
        website: domain ? `https://${domain}` : top?.url,
        description,
      },
      sources: sources.length ? sources : ["web-search"],
    };
  }

  return {
    person: { name: query, bioSignals: top ? [top.snippet].filter(Boolean) : [] },
    company: description ? { name: "Unknown", description } : undefined,
    sources: sources.length ? sources : ["web-search"],
  };
}

const webProvider = new WebSearchEnrichmentProvider();

export function getEnrichmentProvider(domain?: string): EnrichmentProvider {
  // Hunter/Snov need a domain to do a real people-search lookup. Without a
  // paid provider key, the web-search provider handles both cases (with or
  // without a domain) using free search + scrape + AI.
  if (process.env.HUNTER_API_KEY && domain) {
    return new HunterEnrichmentProvider(process.env.HUNTER_API_KEY);
  }
  if (process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET && domain) {
    return new SnovEnrichmentProvider(process.env.SNOV_CLIENT_ID, process.env.SNOV_CLIENT_SECRET);
  }
  return webProvider;
}

/**
 * Company-first search: "who works at this company" — a different shape
 * than the single-person lookup above. Real providers return their actual
 * domain-search results; without real keys, a synthetic candidate list
 * keeps the feature demoable and testable end-to-end.
 */
export async function searchCompanyPeople(
  companyName: string,
  domain: string
): Promise<CompanySearchResult> {
  if (process.env.HUNTER_API_KEY) {
    try {
      const result = await new HunterEnrichmentProvider(
        process.env.HUNTER_API_KEY
      ).searchPeopleAtDomain(domain);
      if (result && result.people.length > 0) return result;
    } catch (err) {
      console.error("Hunter company search failed, falling through to next provider", err);
    }
  }
  if (process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET) {
    try {
      const result = await new SnovEnrichmentProvider(
        process.env.SNOV_CLIENT_ID,
        process.env.SNOV_CLIENT_SECRET
      ).searchPeopleAtDomain(domain);
      if (result && result.people.length > 0) return result;
    } catch (err) {
      console.error("Snov company search failed, falling through to next provider", err);
    }
  }
  return realCompanySearch(companyName, domain);
}

/**
 * No paid people-search API configured. Rather than fabricating five generic
 * names for every company (the old mockCompanySearch — literally the same
 * "Alex Rivera, Priya Chen, Jordan Patel…" for any input), this finds real
 * public LinkedIn results via web search and scrapes the company's actual
 * site for a real description. If no real profiles turn up, it returns an
 * honest empty list rather than inventing people — a wrong "no one found" is
 * far less harmful than a wrong invented name.
 */
async function realCompanySearch(companyName: string, domain: string): Promise<CompanySearchResult> {
  let description: string | undefined;
  let industry: string | undefined;

  try {
    const scraped = await scrape(`https://${domain}`);
    description = scraped.metaTags?.description || scraped.title;
  } catch {
    // site unreachable — company info stays minimal
  }

  const results = await webSearch(`site:linkedin.com/in "${companyName}"`, 8);
  const people: CandidateLead[] = [];
  for (const r of results) {
    if (isBlockedHost(r.url) && !r.url.includes("linkedin.com/in")) continue;
    const parsed = parseLinkedInResultTitle(r.title);
    if (!parsed) continue;
    people.push({ name: parsed.name, title: parsed.title, sourceUrl: r.url, tier: "unclassified" });
    if (people.length >= 6) break;
  }

  return {
    company: {
      name: companyName,
      domain,
      website: `https://${domain}`,
      description,
      industry,
      socials: [{ platform: "LinkedIn", url: `https://www.linkedin.com/company/${slug(companyName)}` }],
    },
    people,
    source: people.length > 0 ? "web-search" : "web-search-no-results",
  };
}

/**
 * DuckDuckGo LinkedIn result titles typically look like
 * "First Last - Job Title - Company | LinkedIn" or "First Last | LinkedIn".
 * Best-effort split; returns null if it doesn't look like a person's name.
 */
function parseLinkedInResultTitle(title: string): { name: string; title?: string } | null {
  const withoutSuffix = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
  const parts = withoutSuffix.split(" - ").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return null;
  const name = parts[0];
  if (!/^[A-Z][a-zA-Z'.-]+(\s+[A-Z][a-zA-Z'.-]+){1,3}$/.test(name)) return null;
  return { name, title: parts[1] };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
