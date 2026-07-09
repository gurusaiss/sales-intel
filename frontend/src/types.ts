export interface SocialLink {
  platform: string;
  url: string;
}

export interface CompanyInfo {
  name: string;
  domain?: string;
  website?: string;
  description?: string;
  industry?: string;
  employeeRange?: string;
  founded?: string;
  funding?: {
    stage?: string;
    totalRaised?: string;
    lastRoundDate?: string;
    investors?: string[];
  };
  technologies?: string[];
  socials?: SocialLink[];
  newsSignals?: string[];
}

export interface PersonInfo {
  name: string;
  title?: string;
  company?: string;
  location?: string;
  publicEmail?: string;
  emailConfidence?: "high" | "medium" | "low" | "unverified";
  socials?: SocialLink[];
  bioSignals?: string[];
}

export interface EnrichmentResult {
  person: PersonInfo;
  company?: CompanyInfo;
  sources: string[];
}

export interface ResearchResponse {
  enrichment: EnrichmentResult;
  aiSummary: string;
  outreachDraft: {
    subject: string;
    body: string;
  };
}
