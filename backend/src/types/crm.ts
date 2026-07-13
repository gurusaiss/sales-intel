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

export interface CrmMessage {
  direction: "outbound" | "inbound";
  text: string;
  capturedAt: string; // ISO timestamp
  source: "user-viewed";
}

export interface CrmMeeting {
  date: string;
  type?: string;
  notes?: string;
  outcome?: string;
}

export interface CrmNote {
  text: string;
  createdAt: string;
  author?: string;
}

export interface CrmPerson {
  id: string; // derived from linkedinUrl
  linkedinUrl: string;
  name: string;
  company?: string;
  role?: string;
  location?: string;

  templateCategory: TemplateCategory;
  tags: string[];
  priority: number; // 1-5

  messages: CrmMessage[];
  followUpCount: number;
  lastContactedAt?: string;
  lastReplyAt?: string;
  status: ContactStatus;

  companyDomain?: string;
  publicEmail?: string;
  emailConfidence?: "high" | "medium" | "low" | "unverified";
  bookingUrl?: string;
  contactPageUrl?: string;

  meetings: CrmMeeting[];
  notes: CrmNote[];

  createdAt: string;
  updatedAt: string;
}

export interface CapturePersonInput {
  linkedinUrl: string;
  name: string;
  company?: string;
  role?: string;
  location?: string;
  visibleMessage?: {
    direction: "outbound" | "inbound";
    text: string;
  };
}

export interface DraftRequest {
  linkedinUrl: string;
  name: string;
  company?: string;
  role?: string;
  visibleMessage?: {
    direction: "outbound" | "inbound";
    text: string;
  };
  templateOverride?: TemplateCategory;
}

export interface DraftResponse {
  person: CrmPerson;
  templateUsed: TemplateCategory;
  draft: string;
}
