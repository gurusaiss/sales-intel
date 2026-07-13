import { EnrichmentProvider } from "../enrichment";
import { EnrichmentResult, PersonInfo, CompanyInfo } from "../../types";
import { CompanySearchResult } from "../../types/leads";

const HUNTER_BASE = "https://api.hunter.io/v2";

interface HunterDomainSearchResponse {
  data: {
    domain: string;
    organization?: string;
    industry?: string;
    description?: string;
    company_size?: string;
    founded_year?: number;
    technologies?: string[];
    linkedin?: string;
    twitter?: string;
    emails: Array<{
      value: string;
      first_name?: string;
      last_name?: string;
      position?: string;
      confidence: number;
      sources: Array<{ uri: string }>;
    }>;
  };
}

interface HunterEmailFinderResponse {
  data: {
    email?: string;
    score?: number;
    first_name?: string;
    last_name?: string;
    position?: string;
    company?: string;
    sources?: Array<{ uri: string }>;
  };
}

export class HunterEnrichmentProvider implements EnrichmentProvider {
  name = "hunter.io";

  constructor(private apiKey: string) {}

  async lookup(query: string, domain?: string): Promise<EnrichmentResult> {
    if (!domain) {
      throw new Error("Hunter.io lookups require a company domain.");
    }

    const isPersonQuery = query.trim().includes(" ") && !isLikelyCompanyName(query);

    const [domainData, personResult] = await Promise.all([
      this.domainSearch(domain),
      isPersonQuery ? this.emailFinder(query, domain) : Promise.resolve(null),
    ]);

    const person: PersonInfo = personResult ?? this.personFromDomainSearch(query, domainData?.company);

    return {
      person,
      company: domainData?.company,
      sources: ["hunter.io"],
    };
  }

  /**
   * Full people list for a domain — the actual "search company, get everyone
   * there" use case. Hunter's domain-search already returns this array; the
   * single-person lookup() above only ever surfaced one match from it.
   */
  async searchPeopleAtDomain(domain: string): Promise<CompanySearchResult | undefined> {
    const domainData = await this.domainSearch(domain);
    if (!domainData) return undefined;

    return {
      company: {
        name: domainData.company.name,
        domain,
        website: domainData.company.website,
        description: domainData.company.description,
        industry: domainData.company.industry,
        employeeRange: domainData.company.employeeRange,
        socials: domainData.company.socials,
      },
      people: domainData.emails.map((e) => ({
        name: [e.first_name, e.last_name].filter(Boolean).join(" ") || "Unknown",
        title: e.position,
        email: e.value,
        emailConfidence: scoreToConfidence(e.confidence),
        sourceUrl: e.sources?.[0]?.uri,
      })),
      source: "hunter.io",
    };
  }

  private async domainSearch(
    domain: string
  ): Promise<{ company: CompanyInfo; emails: HunterDomainSearchResponse["data"]["emails"] } | undefined> {
    const res = await fetch(
      `${HUNTER_BASE}/domain-search?domain=${encodeURIComponent(domain)}&api_key=${this.apiKey}`
    );
    if (!res.ok) {
      console.error("Hunter domain-search failed", res.status, await res.text());
      return undefined;
    }
    const json = (await res.json()) as HunterDomainSearchResponse;
    const d = json.data;

    const company: CompanyInfo = {
      name: d.organization ?? domain,
      domain: d.domain,
      website: `https://${d.domain}`,
      description: d.description,
      industry: d.industry,
      employeeRange: d.company_size,
      founded: d.founded_year ? String(d.founded_year) : undefined,
      technologies: d.technologies,
      socials: [
        d.linkedin ? { platform: "LinkedIn", url: d.linkedin } : undefined,
        d.twitter ? { platform: "Twitter", url: `https://twitter.com/${d.twitter}` } : undefined,
      ].filter((s): s is { platform: string; url: string } => Boolean(s)),
    };

    return { company, emails: d.emails };
  }

  private async emailFinder(fullName: string, domain: string): Promise<PersonInfo | null> {
    const [firstName, ...rest] = fullName.trim().split(/\s+/);
    const lastName = rest.join(" ");
    if (!firstName || !lastName) return null;

    const params = new URLSearchParams({
      domain,
      first_name: firstName,
      last_name: lastName,
      api_key: this.apiKey,
    });

    const res = await fetch(`${HUNTER_BASE}/email-finder?${params.toString()}`);
    if (!res.ok) {
      console.error("Hunter email-finder failed", res.status, await res.text());
      return null;
    }
    const json = (await res.json()) as HunterEmailFinderResponse;
    const d = json.data;

    if (!d.email) return null;

    return {
      name: fullName,
      title: d.position,
      company: d.company,
      publicEmail: d.email,
      emailConfidence: scoreToConfidence(d.score),
    };
  }

  private personFromDomainSearch(query: string, company?: CompanyInfo): PersonInfo {
    return {
      name: query,
      company: company?.name,
    };
  }
}

function scoreToConfidence(score?: number): PersonInfo["emailConfidence"] {
  if (score === undefined) return "unverified";
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

function isLikelyCompanyName(s: string): boolean {
  return /(inc|llc|labs|technologies|co\.|corp)$/i.test(s.trim());
}
