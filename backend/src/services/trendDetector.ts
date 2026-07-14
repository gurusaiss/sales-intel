import { listArticles } from "./articleStore";
import { upsertTrend, upsertInnovation } from "./trendStore";
import { callAI } from "./aiRouter";
import { buildTrendPrompt, TREND_SYSTEM } from "../prompts/trendPrompts";
import { scrapeGithubTrending } from "./githubScraper";

interface DetectedTrend {
  name: string;
  category: string;
  description: string;
  trend_score: number;
  growth_score: number;
  virality_score: number;
  adoption_score: number;
  future_score: number;
}

export async function detectTrendsFromArticles(): Promise<void> {
  const articles = await listArticles({ limit: 60 });
  if (articles.length < 5) return;
  const titles = articles.map((a) => a.title);
  const prompt = buildTrendPrompt(titles);
  const text = await callAI(prompt, TREND_SYSTEM, 1500);
  if (!text) return;
  try {
    const parsed = JSON.parse(text) as { trends?: DetectedTrend[] };
    for (const t of parsed.trends ?? []) {
      await upsertTrend({
        name: t.name,
        category: t.category ?? "Other",
        description: t.description ?? "",
        trendScore: t.trend_score ?? 50,
        growthScore: t.growth_score ?? 50,
        viralityScore: t.virality_score ?? 50,
        adoptionScore: t.adoption_score ?? 50,
        futureScore: t.future_score ?? 50,
        source: "ai-detection",
      });
    }
    console.log(`[trendDetector] Upserted ${parsed.trends?.length ?? 0} trends`);
  } catch (err) {
    console.warn("[trendDetector] Parse error:", err);
  }
}

export async function syncGithubTrending(): Promise<void> {
  const repos = await scrapeGithubTrending("daily");
  for (const repo of repos) {
    const type = (() => {
      const desc = repo.description.toLowerCase();
      if (desc.includes("ai") || desc.includes("llm") || desc.includes("gpt")) return "ai_release" as const;
      if (repo.language === "Python" || repo.language === "Jupyter Notebook") return "oss" as const;
      if (desc.includes("sdk") || desc.includes("client")) return "sdk" as const;
      if (desc.includes("api")) return "api" as const;
      if (desc.includes("tool") || desc.includes("cli")) return "dev_tool" as const;
      return "oss" as const;
    })();
    await upsertInnovation({
      name: repo.name,
      type,
      description: repo.description || `A trending ${repo.language ?? "code"} project on GitHub`,
      url: repo.url,
      githubUrl: repo.url,
      githubStars: repo.totalStars,
      starsToday: repo.starsToday,
      language: repo.language,
      impactScore: Math.min(100, Math.floor(repo.starsToday / 10)),
      tags: [repo.language ?? "code", type],
    });
  }
  console.log(`[trendDetector] Synced ${repos.length} GitHub trending repos`);
}
