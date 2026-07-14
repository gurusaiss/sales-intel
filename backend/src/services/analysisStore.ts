import { readJson, writeJson, userScopedKey } from "./kvStore";
import { ExtractedContacts } from "./contactExtractor";

export type AnalysisStatus = "pending" | "processing" | "done" | "failed";

export interface TechStackResult {
  frontend: string[];
  backend: string[];
  cms: string[];
  analytics: string[];
  marketing: string[];
  cdn: string[];
  security: string[];
  hosting: string[];
  other: string[];
}

export interface AiResult {
  company_name?: string;
  tagline?: string;
  executive_summary?: string;
  industry?: string;
  niche?: string;
  target_customers?: string;
  business_model?: string;
  pricing_model?: string;
  product_features?: string[];
  competitive_advantages?: string[];
  competitor_domains?: string[];
  keywords?: string[];
  seo_opportunities?: string[];
  headquarters?: string;
  founded?: string;
  team_size?: string;
  investor_summary?: string;
  developer_summary?: string;
  founder_summary?: string;
  brand?: string;
  category?: string;
  sub_category?: string;
  description?: string;
  about?: string;
  mission?: string;
  vision?: string;
  website_purpose?: string;
  icp?: string;
  products?: string[];
  services?: string[];
  integrations?: string[];
  pricing_tiers?: Array<{name: string; price: string; features: string[]}>;
  has_pricing_page?: boolean;
  has_careers_page?: boolean;
  has_blog?: boolean;
  has_docs?: boolean;
  has_integrations_page?: boolean;
  has_free_trial?: boolean;
  social_channels?: Array<{platform: string; url: string}>;
  social_presence_strength?: string;
  seo_score_estimate?: string;
  market_position?: string;
  tech_maturity?: string;
  employee_count?: string;
  sales_hook?: string;
}

export interface CveResult {
  techName: string;
  packageName: string;
  cveId: string;
  severity: string;
  summary: string;
}

export interface WebsiteAnalysis {
  id: string;
  userId: string;
  url: string;
  domain: string;
  status: AnalysisStatus;
  pageTitle?: string;
  techStack?: TechStackResult;
  aiResult?: AiResult;
  metaTags?: Record<string, string>;
  vulnerabilities?: CveResult[];
  contacts?: ExtractedContacts;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

function indexKey(userId: string): string {
  return userScopedKey("analyses", userId);
}

function itemKey(userId: string, id: string): string {
  return userScopedKey(`analyses:${id}`, userId);
}

export async function createAnalysis(userId: string, url: string): Promise<WebsiteAnalysis> {
  const id = crypto.randomUUID();
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const now = new Date().toISOString();
  const analysis: WebsiteAnalysis = { id, userId, url, domain, status: "pending", createdAt: now, updatedAt: now };
  await writeJson(itemKey(userId, id), analysis);
  const index = await readJson<string[]>(indexKey(userId), []);
  index.unshift(id);
  if (index.length > 200) index.splice(200);
  await writeJson(indexKey(userId), index);
  return analysis;
}

export async function getAnalysis(userId: string, id: string): Promise<WebsiteAnalysis | null> {
  return readJson<WebsiteAnalysis | null>(itemKey(userId, id), null);
}

export async function listAnalyses(userId: string): Promise<WebsiteAnalysis[]> {
  const index = await readJson<string[]>(indexKey(userId), []);
  const items = await Promise.all(index.map((id) => getAnalysis(userId, id)));
  return items.filter((x): x is WebsiteAnalysis => x !== null);
}

export async function updateAnalysis(userId: string, id: string, patch: Partial<WebsiteAnalysis>): Promise<void> {
  const current = await getAnalysis(userId, id);
  if (!current) return;
  await writeJson(itemKey(userId, id), { ...current, ...patch, updatedAt: new Date().toISOString() });
}
