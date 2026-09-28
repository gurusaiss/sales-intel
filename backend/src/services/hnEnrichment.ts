/**
 * Hacker News signal enrichment via the HN Algolia API.
 *
 * For each recent article that hasn't been enriched yet, we query
 * https://hn.algolia.com/api/v1/search?query=<url> to find the best-matching
 * HN story and store its points, comment count, and story ID back onto the
 * article. This adds community-signal badges (▲ 342 / 💬 87) in the News view.
 *
 * Rate-conscious: processes at most `limit` articles per run (default 30),
 * skips articles that already have hnPoints set, and adds a small delay between
 * requests so we don't hammer the Algolia API.
 */

import { readJson, writeJson, withKeyLock } from "./kvStore";
import type { Article } from "./articleStore";

const HN_ALGOLIA = "https://hn.algolia.com/api/v1/search";
const DELAY_MS = 300; // polite delay between Algolia requests

interface AlgoliaHit {
  objectID: string;
  points: number;
  num_comments: number;
}

interface AlgoliaResponse {
  hits: AlgoliaHit[];
}

async function fetchHnSignal(url: string): Promise<{ hnPoints: number; hnComments: number; hnStoryId: number | undefined } | null> {
  try {
    const q = encodeURIComponent(url);
    const res = await fetch(`${HN_ALGOLIA}?query=${q}&restrictAttributes=url&hitsPerPage=3`, {
      headers: { "User-Agent": "SalesIntel/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;

    const data = await res.json() as AlgoliaResponse;
    const hits = data.hits ?? [];
    if (hits.length === 0) return null;

    // Pick the hit with the most points (best community reception)
    const best = hits.reduce((a, b) => (b.points ?? 0) > (a.points ?? 0) ? b : a, hits[0]);
    if (!best || (best.points ?? 0) === 0) return null;

    const storyIdRaw = best.objectID;
    const hnStoryId = storyIdRaw && /^\d+$/.test(storyIdRaw) ? parseInt(storyIdRaw, 10) : undefined;

    return {
      hnPoints: best.points ?? 0,
      hnComments: best.num_comments ?? 0,
      hnStoryId,
    };
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Enrich up to `limit` recent articles with HN community signals.
 * Articles that already have hnPoints > 0 are skipped.
 * Returns the number of articles successfully enriched.
 */
export async function enrichHnSignals(limit = 30): Promise<number> {
  const all = await readJson<Article[]>("articles", []);

  // Candidates: no HN data yet, has a URL, most recent first
  const candidates = all
    .filter((a) => !a.hnPoints && a.url)
    .slice(0, limit * 3); // over-sample so we still find `limit` even if many get no HN hits

  let enriched = 0;

  for (const candidate of candidates) {
    if (enriched >= limit) break;

    const signal = await fetchHnSignal(candidate.url);
    if (!signal) {
      await sleep(DELAY_MS);
      continue;
    }

    // Patch the article in-store atomically
    await withKeyLock("articles", async () => {
      const current = await readJson<Article[]>("articles", []);
      const idx = current.findIndex((a) => a.id === candidate.id);
      if (idx >= 0) {
        current[idx] = { ...current[idx], ...signal };
        await writeJson("articles", current);
      }
    });

    enriched++;
    console.log(`[hnEnrichment] ${candidate.title.slice(0, 60)} → ▲${signal.hnPoints} 💬${signal.hnComments}`);
    await sleep(DELAY_MS);
  }

  console.log(`[hnEnrichment] Enriched ${enriched} articles`);
  return enriched;
}
