import { XMLParser } from "fast-xml-parser";

export interface ArxivPaper {
  title: string;
  summary: string;
  authors: string[];
  url: string;
  publishedAt: string;
  category: string;
}

const xmlParser = new XMLParser({ ignoreAttributes: false });

export async function searchArxivPapers(query: string, maxResults = 5): Promise<ArxivPaper[]> {
  const url = `https://export.arxiv.org/api/query?search_query=ti:${encodeURIComponent(query)}+OR+abs:${encodeURIComponent(query)}&sortBy=submittedDate&sortOrder=descending&max_results=${maxResults}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const entries = parsed?.feed?.entry;
    if (!entries) return [];
    const list = Array.isArray(entries) ? entries : [entries];
    return list.map((e: Record<string, unknown>) => ({
      title: String(e.title ?? "").trim().replace(/\n/g, " "),
      summary: String(e.summary ?? "").trim().slice(0, 400),
      authors: (() => {
        const a = e.author;
        if (!a) return [];
        const arr = Array.isArray(a) ? a : [a];
        return arr.slice(0, 3).map((x: unknown) => String((x as Record<string, unknown>)?.name ?? x));
      })(),
      url: String(e.id ?? ""),
      publishedAt: String(e.published ?? ""),
      category: String((e["arxiv:primary_category"] as Record<string, unknown>)?.["@_term"] ?? ""),
    }));
  } catch {
    return [];
  }
}
