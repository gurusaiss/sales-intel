export type RoleTier = "leadership" | "hiring" | "employee" | "unclassified";

export type Department =
  | "founders"
  | "executives"
  | "engineering"
  | "product"
  | "hr"
  | "recruiting"
  | "sales"
  | "marketing"
  | "finance"
  | "operations"
  | "customer_success"
  | "legal"
  | "security"
  | "cloud"
  | "ai"
  | "data"
  | "support"
  | "unclassified";

const LEADERSHIP_PATTERNS: RegExp[] = [
  /\b(ceo|chief executive)\b/i,
  /\b(founder|co-founder|cofounder|owner)\b/i,
  /\bchairman\b/i,
  /\bpresident\b/i,
  /\bmanaging director\b/i,
  /\b(cto|chief technology)\b/i,
  /\b(coo|chief operating)\b/i,
  /\b(cfo|chief financial)\b/i,
  /\b(cmo|chief marketing)\b/i,
  /\b(cio|chief information)\b/i,
  /\b(ciso|chief information security)\b/i,
  /\bvice president\b|\bvp\b/i,
  /\bdirector\b/i,
  /\bhead of\b/i,
];

const HIRING_PATTERNS: RegExp[] = [
  /\bhr\b|human resources/i,
  /\brecruiter\b|talent acquisition|recruitment/i,
  /\bhiring manager\b/i,
  /\bengineering manager\b/i,
  /\bproduct manager\b/i,
  /\bdelivery manager\b/i,
  /\boperations manager\b/i,
  /\bbusiness manager\b/i,
  /\bproject manager\b/i,
  /\btechnical lead\b|\btech lead\b/i,
  /\bteam lead\b/i,
  /\blearning manager\b|\btraining manager\b/i,
  /\bmanager\b/i,
];

const DEPARTMENT_PATTERNS: Array<{ pattern: RegExp; department: Department }> = [
  { pattern: /\b(founder|owner|chairman)\b/i, department: "founders" },
  { pattern: /\b(ceo|coo|cfo|cmo|cio|president|managing director)\b/i, department: "executives" },
  { pattern: /\b(cto|engineer|developer|swe|software|devops|full.?stack|frontend|backend)\b/i, department: "engineering" },
  { pattern: /\b(product manager|product owner|head of product)\b/i, department: "product" },
  { pattern: /\bhr\b|human resources/i, department: "hr" },
  { pattern: /\brecruiter\b|talent acquisition|recruitment/i, department: "recruiting" },
  { pattern: /\bsales\b|account executive|business development/i, department: "sales" },
  { pattern: /\bmarketing\b/i, department: "marketing" },
  { pattern: /\bfinance\b|accounting|controller/i, department: "finance" },
  { pattern: /\boperations\b|\bops\b/i, department: "operations" },
  { pattern: /customer success|support engineer|customer support/i, department: "customer_success" },
  { pattern: /\blegal\b|counsel/i, department: "legal" },
  { pattern: /\b(ciso|security)\b/i, department: "security" },
  { pattern: /\bcloud\b/i, department: "cloud" },
  { pattern: /\b(ai|machine learning|ml engineer)\b/i, department: "ai" },
  { pattern: /\bdata (scientist|engineer|analyst)\b/i, department: "data" },
  { pattern: /\bsupport\b/i, department: "support" },
];

/**
 * Rule-based, same pattern as the LinkedIn template-category matcher — no ML
 * needed for a fixed set of tiers/departments derived from a job title.
 */
export function classifyRole(title?: string): { tier: RoleTier; department: Department } {
  if (!title) return { tier: "unclassified", department: "unclassified" };

  const tier = LEADERSHIP_PATTERNS.some((p) => p.test(title))
    ? "leadership"
    : HIRING_PATTERNS.some((p) => p.test(title))
      ? "hiring"
      : "employee";

  const match = DEPARTMENT_PATTERNS.find((d) => d.pattern.test(title));

  return { tier, department: match?.department ?? "unclassified" };
}

/**
 * Leadership title patterns rank roughly by seniority — used to sort the
 * Leadership tier so C-suite/founders surface before "Director"-level titles.
 */
export function leadershipRank(title?: string): number {
  if (!title) return LEADERSHIP_PATTERNS.length;
  const index = LEADERSHIP_PATTERNS.findIndex((p) => p.test(title));
  return index === -1 ? LEADERSHIP_PATTERNS.length : index;
}
