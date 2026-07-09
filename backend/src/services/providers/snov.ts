import { EnrichmentProvider } from "../enrichment";
import { EnrichmentResult, PersonInfo, CompanyInfo } from "../../types";

const SNOV_BASE = "https://api.snov.io";

interface SnovTokenResponse {
  access_token: string;
  expires_in: number; // seconds
}

interface SnovDomainEmail {
  email: string;
  first_name?: string;
  last_name?: string;
  position?: string;
  sourcePage?: string;
}

interface SnovDomainSearchResponse {
  success: boolean;
  domain: string;
  result?: number;
  emails?: SnovDomainEmail[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

export class SnovEnrichmentProvider implements EnrichmentProvider {
  name = "snov.io";

  constructor(
    private clientId: string,
    private clientSecret: string
  ) {}

  async lookup(query: string, domain?: string): Promise<EnrichmentResult> {
    if (!domain) {
      throw new Error("Snov.io lookups require a company domain.");
    }

    const token = await this.getAccessToken();
    const domainResult = await this.domainSearch(token, domain);

    const person = this.matchPerson(query, domainResult);
    const company: CompanyInfo | undefined = domainResult
      ? {
          name: domain,
          domain,
          website: `https://${domain}`,
        }
      : undefined;

    return {
      person,
      company,
      sources: ["snov.io"],
    };
  }

  private async getAccessToken(): Promise<string> {
    if (cachedToken && cachedToken.expiresAt > Date.now()) {
      return cachedToken.token;
    }

    const res = await fetch(`${SNOV_BASE}/v1/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
    });

    if (!res.ok) {
      throw new Error(`Snov.io auth failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as SnovTokenResponse;
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedToken.token;
  }

  private async domainSearch(
    token: string,
    domain: string
  ): Promise<SnovDomainSearchResponse | undefined> {
    const params = new URLSearchParams({
      access_token: token,
      domain,
      type: "all",
      limit: "20",
    });

    const res = await fetch(`${SNOV_BASE}/v1/get-domain-emails-with-info?${params.toString()}`);
    if (!res.ok) {
      console.error("Snov domain search failed", res.status, await res.text());
      return undefined;
    }
    return (await res.json()) as SnovDomainSearchResponse;
  }

  private matchPerson(query: string, domainResult?: SnovDomainSearchResponse): PersonInfo {
    const emails = domainResult?.emails ?? [];
    const queryLower = query.trim().toLowerCase();

    const exact = emails.find(
      (e) => `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim().toLowerCase() === queryLower
    );
    const match = exact ?? emails[0];

    if (!match) {
      return { name: query, emailConfidence: "unverified" };
    }

    return {
      name: query,
      title: match.position,
      publicEmail: match.email,
      emailConfidence: exact ? "high" : "low",
    };
  }
}
