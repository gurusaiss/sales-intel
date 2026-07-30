import { listArticles } from "./articleStore";
import { saveReport } from "./reportStore";
import { callAI } from "./aiRouter";
import { REPORT_PROMPTS, REPORT_SYSTEM, ReportType } from "../prompts/reportPrompts";

function formatArticlesForPrompt(articles: { title: string; url: string; summaryShort?: string }[]): string {
  return articles.map((a, i) =>
    `${i + 1}. ${a.title}\n   URL: ${a.url}${a.summaryShort ? `\n   Summary: ${a.summaryShort}` : ""}`
  ).join("\n\n");
}

export async function generateReport(type: ReportType): Promise<void> {
  const config = REPORT_PROMPTS[type];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.windowDays);
  const allArticles = await listArticles({ limit: config.articleLimit });
  const relevant = allArticles.filter((a) => new Date(a.publishedAt) >= cutoff);
  if (relevant.length < 3) {
    console.warn(`[reportGenerator] Not enough articles for ${type} report (${relevant.length})`);
    return;
  }
  const articlesText = formatArticlesForPrompt(relevant);
  const prompt = config.prompt.replace("{articles}", articlesText);
  let content = await callAI(prompt, REPORT_SYSTEM, 2000);
  if (!content) {
    // One retry with a smaller article batch — cheaper and more likely to
    // succeed than the full batch if the first attempt hit a transient
    // provider error or rate limit.
    const smallerPrompt = config.prompt.replace("{articles}", formatArticlesForPrompt(relevant.slice(0, 15)));
    content = await callAI(smallerPrompt, REPORT_SYSTEM, 2000);
  }
  if (!content) { console.warn(`[reportGenerator] AI returned null for ${type}`); return; }
  const now = new Date();
  await saveReport({
    reportType: type,
    title: config.title,
    content,
    periodStart: cutoff.toISOString(),
    periodEnd: now.toISOString(),
    articleCount: relevant.length,
    generatedAt: now.toISOString(),
  });
  console.log(`[reportGenerator] Generated ${type} report from ${relevant.length} articles`);
}
