import cron from "node-cron";
import { pollAllSources } from "./newsPoller";
import { summarizePendingArticles } from "./newsSummarizer";
import { detectTrendsFromArticles, syncGithubTrending } from "./trendDetector";
import { generateReport, generateAllScheduledReports } from "./reportGenerator";
import { fetchPackageStats } from "./packageStats";
import { readJson, writeJson } from "./kvStore";
import { pollDiscoverSources } from "./discoverPoller";
import { refreshAll } from "./liveData";

async function withGuard(jobName: string, fn: () => Promise<void>): Promise<void> {
  const key = `scheduler:last_run:${jobName}`;
  const last = await readJson<string | null>(key, null);
  if (last) {
    const diffMs = Date.now() - new Date(last).getTime();
    // Prevent re-run if job ran < 5 minutes ago (crash-restart guard)
    if (diffMs < 5 * 60 * 1000) {
      console.log(`[scheduler] Skipping ${jobName} — ran ${Math.round(diffMs / 60000)}m ago`);
      return;
    }
  }
  await writeJson(key, new Date().toISOString());
  try {
    await fn();
  } catch (err) {
    console.error(`[scheduler] Job ${jobName} failed:`, err);
  }
}

export function startScheduler(): void {
  // Poll RSS every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    void withGuard("news_poll", async () => {
      await pollAllSources();
    });
  });

  // Summarize new articles every 10 minutes
  cron.schedule("*/10 * * * *", () => {
    void withGuard("summarize", async () => { await summarizePendingArticles(20); });
  });

  // GitHub trending sync every hour
  cron.schedule("0 * * * *", () => {
    void withGuard("github_trending", () => syncGithubTrending());
  });

  // Poll discover sources (Product Hunt, Show HN, BetaList) every 3 hours
  cron.schedule("0 */3 * * *", () => {
    void withGuard("discover_poll", async () => { await pollDiscoverSources(); });
  });

  // AI trend detection every 2 hours
  cron.schedule("0 */2 * * *", () => {
    void withGuard("trend_detect", () => detectTrendsFromArticles());
  });

  // Package stats every 6 hours
  cron.schedule("0 */6 * * *", () => {
    void withGuard("package_stats", () => fetchPackageStats());
  });

  // Daily report at midnight
  cron.schedule("0 0 * * *", () => {
    void withGuard("daily_report", () => generateReport("daily"));
  });

  // Sales digest every day at 6am
  cron.schedule("0 6 * * *", () => {
    void withGuard("sales_digest", () => generateReport("sales_digest"));
  });

  // Weekly + role reports every Monday
  cron.schedule("0 1 * * 1", () => {
    void withGuard("weekly_reports", async () => {
      for (const t of ["weekly", "founder", "developer", "investor", "ai"] as const) {
        await generateReport(t);
      }
    });
  });

  console.log("[scheduler] All cron jobs started");

  // Run initial data load on startup (non-blocking). Routed through liveData so
  // it shares the same de-dupe lock as the on-demand endpoint polls — this
  // prevents two full polls running concurrently and racing on the same store
  // keys right after boot.
  setTimeout(() => {
    console.log("[scheduler] Running initial data load...");
    void refreshAll()
      .then(() => console.log("[scheduler] Initial data load complete"))
      .catch(console.error);
  }, 5000);
}
