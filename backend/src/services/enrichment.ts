import { EnrichmentResult } from "../types";
import { HunterEnrichmentProvider } from "./providers/hunter";
import { SnovEnrichmentProvider } from "./providers/snov";
import { CompanySearchResult } from "../types/leads";

/**
 * Enrichment is provider-agnostic by design: swapping the mock provider for
 * a real one (People Data Labs, Coresignal, Datagma, etc.) means implementing
 * this interface — nothing else in the app changes.
 */
export interface EnrichmentProvider {
  name: string;
  lookup(query: string, domain?: string): Promise<EnrichmentResult>;
}

class MockEnrichmentProvider implements EnrichmentProvider {
  name = "mock";

  async lookup(query: string): Promise<EnrichmentResult> {
    const cleaned = query.trim();
    const looksLikeCompany = /(inc|llc|labs|technologies|co\.|corp)$/i.test(cleaned);

    if (looksLikeCompany) {
      return {
        person: {
          name: "Unknown — company search",
        },
        company: mockCompany(cleaned),
        sources: ["mock-provider"],
      };
    }

    return {
      person: mockPerson(cleaned),
      company: mockCompany(`${cleaned.split(" ")[0]}'s Company`),
      sources: ["mock-provider"],
    };
  }
}

function mockPerson(name: string) {
  return {
    name,
    title: "VP of Sales",
    company: "Northwind Analytics",
    location: "Austin, TX",
    publicEmail: `${name.split(" ")[0]?.toLowerCase() ?? "contact"}@northwindanalytics.com`,
    emailConfidence: "medium" as const,
    socials: [
      { platform: "LinkedIn", url: `https://www.linkedin.com/in/${slug(name)}` },
    ],
    bioSignals: [
      "Spoke at SaaStr Annual 2025 on outbound sales efficiency",
      "Guest on the 'Revenue Rebels' podcast, episode 142",
    ],
  };
}

function mockCompany(name: string) {
  return {
    name,
    domain: `${slug(name)}.com`,
    website: `https://${slug(name)}.com`,
    description: `${name} builds analytics tooling for mid-market revenue teams.`,
    industry: "B2B SaaS",
    employeeRange: "51-200",
    founded: "2019",
    funding: {
      stage: "Series A",
      totalRaised: "$14M",
      lastRoundDate: "2025-03-01",
      investors: ["Bessemer Venture Partners", "Uncork Capital"],
    },
    technologies: ["Salesforce", "Segment", "AWS", "React"],
    socials: [
      { platform: "LinkedIn", url: `https://www.linkedin.com/company/${slug(name)}` },
      { platform: "Twitter", url: `https://twitter.com/${slug(name)}` },
    ],
    newsSignals: [
      "Posted 4 open sales roles in the last 30 days",
      "Announced Series A extension in Q1 2025",
    ],
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

const mockProvider = new MockEnrichmentProvider();

export function getEnrichmentProvider(domain?: string): EnrichmentProvider {
  // All real providers need a domain to do a real lookup. Without one, real
  // results aren't possible, so we fall back to mock rather than guessing a
  // domain and being wrong. Hunter takes priority if both keys are set.
  if (process.env.HUNTER_API_KEY && domain) {
    return new HunterEnrichmentProvider(process.env.HUNTER_API_KEY);
  }
  if (process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET && domain) {
    return new SnovEnrichmentProvider(process.env.SNOV_CLIENT_ID, process.env.SNOV_CLIENT_SECRET);
  }
  return mockProvider;
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
    const result = await new HunterEnrichmentProvider(process.env.HUNTER_API_KEY).searchPeopleAtDomain(
      domain
    );
    if (result && result.people.length > 0) return result;
  }
  if (process.env.SNOV_CLIENT_ID && process.env.SNOV_CLIENT_SECRET) {
    const result = await new SnovEnrichmentProvider(
      process.env.SNOV_CLIENT_ID,
      process.env.SNOV_CLIENT_SECRET
    ).searchPeopleAtDomain(domain);
    if (result && result.people.length > 0) return result;
  }
  return mockCompanySearch(companyName, domain);
}

function mockCompanySearch(companyName: string, domain: string): CompanySearchResult {
  const titles = ["Founder", "VP of Sales", "Head of Marketing", "Recruiter", "Engineering Manager"];
  const firstNames = ["Alex", "Priya", "Jordan", "Sam", "Morgan"];
  const lastNames = ["Rivera", "Chen", "Patel", "Kelly", "Nguyen"];

  return {
    company: {
      name: companyName,
      domain,
      website: `https://${domain}`,
      description: `${companyName} builds tools for mid-market revenue teams.`,
      industry: "B2B SaaS",
      employeeRange: "51-200",
      socials: [{ platform: "LinkedIn", url: `https://www.linkedin.com/company/${slug(companyName)}` }],
    },
    people: titles.map((title, i) => ({
      name: `${firstNames[i]} ${lastNames[i]}`,
      title,
      email: `${firstNames[i].toLowerCase()}.${lastNames[i].toLowerCase()}@${domain}`,
      emailConfidence: "unverified" as const,
    })),
    source: "mock-provider",
  };
}
