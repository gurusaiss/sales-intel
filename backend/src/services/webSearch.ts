import * as cheerio from "cheerio";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const BLOCKED_HOSTS = [
  "wikipedia.org", "linkedin.com", "facebook.com", "twitter.com", "x.com",
  "youtube.com", "instagram.com", "crunchbase.com", "glassdoor.com",
  "indeed.com", "bloomberg.com", "forbes.com", "medium.com", "reddit.com",
  "pinterest.com", "duckduckgo.com", "google.com", "bing.com", "yelp.com",
  "tiktok.com", "amazon.com",
];

function decodeDdgUrl(href: string): string | null {
  try {
    // DuckDuckGo's HTML results wrap outbound links: /l/?uddg=<encoded>&rut=...
    if (href.startsWith("//duckduckgo.com/l/") || href.startsWith("/l/")) {
      const qs = href.split("?")[1] ?? "";
      const params = new URLSearchParams(qs);
      const real = params.get("uddg");
      return real ? decodeURIComponent(real) : null;
    }
    if (href.startsWith("http")) return href;
    return null;
  } catch {
    return null;
  }
}

/**
 * Free, no-API-key web search via DuckDuckGo's HTML endpoint — the same
 * mechanism used by lightweight lookup tools that don't have a paid search
 * API budget. This is what makes Research/Companies return real, query-
 * specific results instead of a static mock template: every distinct query
 * produces distinct real search hits, which then get scraped + AI-summarized.
 */
export async function webSearch(query: string, limit = 8): Promise<WebSearchResult[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      body: `q=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const results: WebSearchResult[] = [];

    $(".result").each((_, el) => {
      if (results.length >= limit) return;
      const a = $(el).find("a.result__a").first();
      const href = a.attr("href");
      const title = a.text().trim();
      const snippet = $(el).find(".result__snippet").text().trim();
      if (!href || !title) return;
      const url = decodeDdgUrl(href);
      if (!url) return;
      results.push({ title, url, snippet });
    });

    return results;
  } catch (err) {
    console.warn("[webSearch] failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

function hostnameOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export function isBlockedHost(url: string): boolean {
  const host = hostnameOf(url);
  if (!host) return true;
  return BLOCKED_HOSTS.some((b) => host === b || host.endsWith(`.${b}`));
}

/**
 * Best-effort "what is this company's official domain" resolver — searches
 * for the name, then picks the first result whose host isn't a directory /
 * social / news aggregator site. Not perfect, but real: it reflects an actual
 * top search result rather than a guessed `${slug}.com`.
 */
export async function resolveCompanyDomain(companyName: string): Promise<{ domain: string; url: string } | null> {
  const results = await webSearch(`${companyName} official website`, 8);
  const hit = results.find((r) => !isBlockedHost(r.url));
  if (!hit) return null;
  const host = hostnameOf(hit.url);
  if (!host) return null;
  return { domain: host, url: hit.url };
}
