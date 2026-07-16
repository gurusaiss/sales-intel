import { readJson, writeJson, withKeyLock } from "./kvStore";

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
  return withKeyLock("articles", async () => {
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
  });
}

/**
 * Batch upsert — one read-modify-write for the whole set instead of one per
 * item. Polling 25 feeds × ~500 items previously did 500 sequential locked
 * read-modify-write cycles on an ever-growing array (O(n²), ~50s cold start).
 * This does a single merge and single write.
 */
export async function upsertArticlesBatch(
  items: Array<Omit<Article, "id" | "aiProcessed" | "viewCount"> & { id?: string }>
): Promise<number> {
  if (items.length === 0) return 0;
  return withKeyLock("articles", async () => {
    const all = await readJson<Article[]>("articles", []);
    const byUrl = new Map(all.map((a) => [a.url, a]));
    let added = 0;
    for (const item of items) {
      const existing = byUrl.get(item.url);
      if (existing) {
        Object.assign(existing, item);
      } else {
        const article: Article = { ...item, id: item.id ?? crypto.randomUUID(), aiProcessed: false, viewCount: 0 };
        all.unshift(article);
        byUrl.set(article.url, article);
        added++;
      }
    }
    if (all.length > 2000) all.splice(2000);
    await writeJson("articles", all);
    return added;
  });
}

export async function updateArticle(id: string, patch: Partial<Article>): Promise<void> {
  return withKeyLock("articles", async () => {
    const all = await readJson<Article[]>("articles", []);
    const idx = all.findIndex((a) => a.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      await writeJson("articles", all);
    }
  });
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
