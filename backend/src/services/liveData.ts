import { listArticles } from "./articleStore";
import { pollAllSources } from "./newsPoller";
import { summarizePendingArticles } from "./newsSummarizer";
import { listTrends, listInnovations } from "./trendStore";
import { syncGithubTrending, detectTrendsFromArticles } from "./trendDetector";
import { pollDiscoverSources } from "./discoverPoller";

/**
 * Self-healing data layer.
 *
 * Render's free web tier spins the service down after ~15 min idle, which
 * kills the node-cron scheduler — so scheduled polling alone can't guarantee
 * fresh data on a page load. These helpers make the read endpoints populate
 * their own data on demand: if the store is empty they block until a poll
 * fills it; if it's merely stale they return what's there and refresh in the
 * background. Combined with an external keep-alive ping (see GET /api/refresh),
 * this keeps every tab showing live data with or without the cron scheduler.
 */

const FRESH_MS = 15 * 60 * 1000; // treat data younger than 15 min as fresh
const lastRun: Record<string, number> = {};
const inFlight: Record<string, Promise<void> | undefined> = {};

/** Run a job at most once concurrently; record completion time for staleness. */
function run(job: string, fn: () => Promise<void>): Promise<void> {
  const existing = inFlight[job];
  if (existing) return existing;
  const p = (async () => {
    try {
      await fn();
      lastRun[job] = Date.now();
    } catch (err) {
      console.error(`[liveData] job "${job}" failed:`, err);
    } finally {
      inFlight[job] = undefined;
    }
  })();
  inFlight[job] = p;
  return p;
}

function isStale(job: string): boolean {
  return !lastRun[job] || Date.now() - lastRun[job] > FRESH_MS;
}

export async function ensureNews(): Promise<void> {
  const existing = await listArticles({ limit: 1 });
  if (existing.length === 0) {
    // Cold store — block on raw RSS (fast) so the request returns real data.
    await run("news_poll", async () => { await pollAllSources(); });
    // AI summaries are slower and optional; fill them in asynchronously.
    void run("summarize", async () => { await summarizePendingArticles(20); });
  } else if (isStale("news_poll")) {
    void run("news_poll", async () => { await pollAllSources(); });
    void run("summarize", async () => { await summarizePendingArticles(20); });
  }
}

export async function ensureInnovations(): Promise<void> {
  const existing = await listInnovations();
  if (existing.length === 0) {
    await run("discover", async () => {
      await syncGithubTrending();
      await pollDiscoverSources();
    });
  } else if (isStale("discover")) {
    void run("discover", async () => {
      await syncGithubTrending();
      await pollDiscoverSources();
    });
  }
}

export async function ensureTrends(): Promise<void> {
  const existing = await listTrends();
  if (existing.length === 0) {
    // Trends are AI-derived from articles — make sure articles exist first.
    await ensureNews();
    await run("trends", async () => { await detectTrendsFromArticles(); });
  } else if (isStale("trends")) {
    void run("trends", async () => { await detectTrendsFromArticles(); });
  }
}

/** Full refresh — used by the keep-alive/refresh endpoint. Non-blocking jobs. */
export async function refreshAll(): Promise<void> {
  await run("news_poll", async () => { await pollAllSources(); });
  await run("summarize", async () => { await summarizePendingArticles(20); });
  await run("discover", async () => {
    await syncGithubTrending();
    await pollDiscoverSources();
  });
  await run("trends", async () => { await detectTrendsFromArticles(); });
}

export function dataStatus(): Record<string, { lastRun: string | null; running: boolean }> {
  const jobs = ["news_poll", "summarize", "discover", "trends"];
  const out: Record<string, { lastRun: string | null; running: boolean }> = {};
  for (const j of jobs) {
    out[j] = {
      lastRun: lastRun[j] ? new Date(lastRun[j]).toISOString() : null,
      running: Boolean(inFlight[j]),
    };
  }
  return out;
}
