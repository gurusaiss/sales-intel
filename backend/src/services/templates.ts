import { TemplateCategory } from "../types/crm";

interface TemplateSpec {
  category: TemplateCategory;
  toneInstructions: string;
}

const TEMPLATES: Record<TemplateCategory, TemplateSpec> = {
  ceo: {
    category: "ceo",
    toneInstructions:
      "Direct, concise, respectful of limited time. Lead with the single most relevant point. No fluff.",
  },
  founder: {
    category: "founder",
    toneInstructions:
      "Peer-to-peer, casual-professional. Founder-to-founder tone, can reference shared startup context.",
  },
  recruiter: {
    category: "recruiter",
    toneInstructions:
      "Clear about role/intent, specific about mutual value, no vague networking language.",
  },
  hr: {
    category: "hr",
    toneInstructions: "Process-respectful, polite, acknowledges their workload, easy to action.",
  },
  investor: {
    category: "investor",
    toneInstructions:
      "Metrics-forward, respects their deal flow volume, gets to the point with a clear ask.",
  },
  sir: {
    category: "sir",
    toneInstructions: "Formal, respectful, traditional business courtesy, addresses as 'Sir'.",
  },
  madam: {
    category: "madam",
    toneInstructions: "Formal, respectful, traditional business courtesy, addresses as 'Madam'.",
  },
  hiring_manager: {
    category: "hiring_manager",
    toneInstructions:
      "Direct about the specific role you're interested in, ties your background to their team's actual work, no generic flattery.",
  },
  engineer: {
    category: "engineer",
    toneInstructions:
      "Technical peer tone, can reference specific tech stack or a project of theirs, low-formality, respects that they're not a gatekeeper for hiring decisions.",
  },
  referral_request: {
    category: "referral_request",
    toneInstructions:
      "Explicitly names the ask (a referral for a specific role), makes it easy to say yes with minimal effort on their part, acknowledges it's a favor.",
  },
  internship_request: {
    category: "internship_request",
    toneInstructions:
      "Enthusiastic but not desperate, shows specific interest in their team/work, clear about being early-career without over-apologizing for it.",
  },
  cold_outreach: {
    category: "cold_outreach",
    toneInstructions:
      "No prior relationship assumed, leads with a specific reason for reaching out to this person particularly, short.",
  },
  unclassified: {
    category: "unclassified",
    toneInstructions:
      "Neutral, professional, moderately formal — safe default when role is unknown.",
  },
};

const ROLE_KEYWORDS: Array<{ pattern: RegExp; category: TemplateCategory }> = [
  { pattern: /\b(chief executive|ceo)\b/i, category: "ceo" },
  { pattern: /\b(founder|co-founder|cofounder)\b/i, category: "founder" },
  { pattern: /\b(recruiter|talent acquisition|talent partner)\b/i, category: "recruiter" },
  { pattern: /\b(hr|human resources|people ops|people operations)\b/i, category: "hr" },
  { pattern: /\b(investor|vc partner|venture partner|angel investor|managing partner)\b/i, category: "investor" },
  { pattern: /\b(hiring manager|engineering manager|team lead|head of engineering|head of product)\b/i, category: "hiring_manager" },
  { pattern: /\b(engineer|developer|swe|software engineer)\b/i, category: "engineer" },
];

/**
 * Rule-based match, ordered: explicit role keyword > formal fallback.
 * No ML needed for 7 fixed categories — see Section 6 of the architecture decision.
 */
export function matchTemplateCategory(role?: string): TemplateCategory {
  if (!role) return "unclassified";
  const match = ROLE_KEYWORDS.find((r) => r.pattern.test(role));
  return match?.category ?? "unclassified";
}

export function getTemplateSpec(category: TemplateCategory): TemplateSpec {
  return TEMPLATES[category];
}
