import { readJson, writeJson } from "./kvStore";

export interface Article {
  id: string;
  sourceName: string;
  sourceCategory: string;
  title: string;
  url: string;
  imageUrl?: string;
  contentRaw: string;
  summaryShort?: string;
  summaryMedium?: string;
  summaryDetailed?: string;
  whyItMatters?: string;
  developerImpact?: string;
  startupImpact?: string;
  salesOpportunity?: string;
  categories: string[];
  keywords: string[];
  publishedAt: string;
  aiProcessed: boolean;
  viewCount: number;
  hnPoints?: number;
  hnComments?: number;
  hnStoryId?: number;
  keyHighlights?: string[];
  actionItems?: string[];
  risks?: string[];
  relatedCompanies?: string[];
  relatedProducts?: string[];
  relatedTechnologies?: string[];
  importantLinks?: Array<{title: string; url: string}>;
  sentiment?: string;
}

export async function listArticles(opts: { category?: string; limit?: number; offset?: number } = {}): Promise<Article[]> {
  const { category, limit = 20, offset = 0 } = opts;
  const all = await readJson<Article[]>("articles", []);
  const filtered = category ? all.filter((a) => a.categories.includes(category) || a.sourceCategory === category) : all;
  return filtered.slice(offset, offset + limit);
}

export async function getArticle(id: string): Promise<Article | null> {
  const all = await readJson<Article[]>("articles", []);
  return all.find((a) => a.id === id) ?? null;
}

export async function upsertArticle(item: Omit<Article, "id" | "aiProcessed" | "viewCount"> & { id?: string }): Promise<Article> {
  const all = await readJson<Article[]>("articles", []);
  const existing = all.find((a) => a.url === item.url);
  if (existing) {
    Object.assign(existing, item);
    await writeJson("articles", all);
    return existing;
  }
  const article: Article = { ...item, id: item.id ?? crypto.randomUUID(), aiProcessed: false, viewCount: 0 };
  all.unshift(article);
  // Cap at 2000 articles
  if (all.length > 2000) all.splice(2000);
  await writeJson("articles", all);
  return article;
}

export async function updateArticle(id: string, patch: Partial<Article>): Promise<void> {
  const all = await readJson<Article[]>("articles", []);
  const idx = all.findIndex((a) => a.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    await writeJson("articles", all);
  }
}

export async function incrementViewCount(id: string): Promise<void> {
  await updateArticle(id, { viewCount: ((await getArticle(id))?.viewCount ?? 0) + 1 });
}

export async function getPendingArticles(limit = 20): Promise<Article[]> {
  const all = await readJson<Article[]>("articles", []);
  return all.filter((a) => !a.aiProcessed).slice(0, limit);
}

export async function getArticleCategories(): Promise<string[]> {
  const all = await readJson<Article[]>("articles", []);
  const cats = new Set<string>();
  all.forEach((a) => a.categories.forEach((c) => cats.add(c)));
  return [...cats].sort();
}
