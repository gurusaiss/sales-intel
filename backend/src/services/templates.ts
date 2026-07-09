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
