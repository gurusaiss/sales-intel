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

export type TemplateCategory =
  | "ceo"
  | "founder"
  | "recruiter"
  | "hr"
  | "investor"
  | "sir"
  | "madam"
  | "hiring_manager"
  | "engineer"
  | "referral_request"
  | "internship_request"
  | "cold_outreach"
  | "unclassified";

export type ContactStatus = "no_reply" | "replied" | "booked" | "closed" | "do_not_contact";

export interface CrmPerson {
  id: string;
  linkedinUrl: string;
  name: string;
  company?: string;
  role?: string;
  templateCategory: TemplateCategory;
  priority: number;
  followUpCount: number;
  status: ContactStatus;
  publicEmail?: string;
  updatedAt: string;
}

export interface QueueItem {
  person: CrmPerson;
  draft: string;
}

export interface QueueResponse {
  queue: QueueItem[];
  totalPending: number;
}
