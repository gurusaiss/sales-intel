import { listArticles } from "./articleStore";
import { listTrends } from "./trendStore";
import { listInnovations } from "./trendStore";

export interface SearchResult {
  type: "article" | "trend" | "innovation";
  id: string;
  title: string;
  description: string;
  url?: string;
  category?: string;
  score: number;
}

export async function searchContent(query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  const articles = await listArticles({ limit: 500 });
  for (const a of articles) {
    const haystack = `${a.title} ${a.summaryShort ?? ""} ${(a.keywords ?? []).join(" ")}`.toLowerCase();
    if (haystack.includes(q)) {
      const score = a.title.toLowerCase().includes(q) ? 10 : 5;
      results.push({ type: "article", id: a.id, title: a.title, description: a.summaryShort ?? a.contentRaw.slice(0, 120), url: a.url, category: a.sourceCategory, score });
    }
  }

  const trends = await listTrends();
  for (const t of trends) {
    if (t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)) {
      results.push({ type: "trend", id: t.id, title: t.name, description: t.description, category: t.category, score: t.name.toLowerCase().includes(q) ? 10 : 5 });
    }
  }

  const innovations = await listInnovations();
  for (const i of innovations) {
    if (i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q)) {
      results.push({ type: "innovation", id: i.id, title: i.name, description: i.description, url: i.url, category: i.type, score: i.name.toLowerCase().includes(q) ? 10 : 5 });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
