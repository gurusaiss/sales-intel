// Real, free, no-key growth signal source: Hacker News' public Algolia search
// API. Mentions of a company in HN stories/comments are a genuine (if noisy)
// public-attention signal — no API key, no billing, no rate-limit concerns
// for personal use.

const HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search";

interface HnHit {
  title: string | null;
  url: string | null;
  points: number | null;
  created_at: string;
  objectID: string;
}

interface HnResponse {
  hits: HnHit[];
}

export async function fetchGrowthSignals(companyName: string): Promise<string[]> {
  if (!companyName || companyName.trim().length < 3) return [];

  try {
    const params = new URLSearchParams({
      query: companyName,
      tags: "story",
      hitsPerPage: "5",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${HN_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return [];

    const data = (await res.json()) as HnResponse;

    return data.hits
      .filter((hit) => hit.title && titleMentionsCompany(hit.title, companyName))
      .slice(0, 3)
      .map((hit) => {
        const date = new Date(hit.created_at).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
        return `HN (${date}): "${hit.title}"${hit.points ? ` — ${hit.points} points` : ""}`;
      });
  } catch (err) {
    console.error("Growth signal fetch failed", err);
    return [];
  }
}

function titleMentionsCompany(title: string, companyName: string): boolean {
  const normalizedCompany = companyName.trim().toLowerCase().split(/\s+/)[0];
  return title.toLowerCase().includes(normalizedCompany);
}

export async function fetchHnSignalForUrl(url: string): Promise<{ points: number; comments: number; storyId: number } | null> {
  try {
    const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(url)}&restrictSearchableAttributes=url&hitsPerPage=1`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { hits?: Array<{ points?: number; num_comments?: number; objectID?: string }> };
    const hit = data.hits?.[0];
    if (!hit) return null;
    return { points: hit.points ?? 0, comments: hit.num_comments ?? 0, storyId: parseInt(hit.objectID ?? "0", 10) };
  } catch { return null; }
}
