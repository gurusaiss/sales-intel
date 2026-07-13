export type EmailConfidence = "high" | "medium" | "low" | "unverified";

export interface CandidateLead {
  name: string;
  title?: string;
  email?: string;
  emailConfidence?: EmailConfidence;
  sourceUrl?: string;
  tier?: "leadership" | "hiring" | "employee" | "unclassified";
  department?: string;
}

export interface CompanySearchResult {
  company: {
    name: string;
    domain: string;
    website?: string;
    description?: string;
    industry?: string;
    employeeRange?: string;
    socials?: { platform: string; url: string }[];
  };
  people: CandidateLead[];
  source: string;
}

export type LeadStatus = "new" | "contacted" | "archived";

export interface Lead {
  id: string;
  name: string;
  company?: string;
  companyDomain?: string;
  title?: string;
  linkedinUrl?: string;
  website?: string;
  publicEmail?: string;
  emailConfidence?: EmailConfidence;
  phone?: string;
  socials?: { platform: string; url: string }[];
  tags: string[];
  notes: string;
  status: LeadStatus;
  priority: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddLeadsInput {
  company?: string;
  companyDomain?: string;
  source: string;
  people: CandidateLead[];
}
