import { getPendingArticles, updateArticle } from "./articleStore";
import { callAI } from "./aiRouter";
import { buildSummarizerPrompt, SUMMARIZER_SYSTEM } from "../prompts/summarizerPrompts";

interface SummaryResult {
  summary_short?: string;
  summary_medium?: string;
  summary_detailed?: string;
  why_it_matters?: string;
  developer_impact?: string;
  startup_impact?: string;
  sales_opportunity?: string;
  categories?: string[];
  keywords?: string[];
  key_highlights?: string[];
  action_items?: string[];
  risks?: string[];
  related_companies?: string[];
  related_products?: string[];
  related_technologies?: string[];
  important_links?: string[];
  sentiment?: string;
}

export async function summarizePendingArticles(batchSize = 20): Promise<number> {
  const pending = await getPendingArticles(batchSize);
  let processed = 0;
  for (const article of pending) {
    try {
      const prompt = buildSummarizerPrompt(article.title, article.url, article.contentRaw);
      const text = await callAI(prompt, SUMMARIZER_SYSTEM, 1000);
      if (!text) { await updateArticle(article.id, { aiProcessed: true }); continue; }
      let result: SummaryResult = {};
      try { result = JSON.parse(text) as SummaryResult; } catch { /* skip */ }
      await updateArticle(article.id, {
        summaryShort: result.summary_short,
        summaryMedium: result.summary_medium,
        summaryDetailed: result.summary_detailed,
        whyItMatters: result.why_it_matters,
        developerImpact: result.developer_impact,
        startupImpact: result.startup_impact,
        salesOpportunity: result.sales_opportunity,
        categories: result.categories?.length ? result.categories : [article.sourceCategory],
        keywords: result.keywords ?? [],
        keyHighlights: result.key_highlights,
        actionItems: result.action_items,
        risks: result.risks,
        relatedCompanies: result.related_companies,
        relatedProducts: result.related_products,
        relatedTechnologies: result.related_technologies,
        importantLinks: result.important_links?.map((l) =>
          typeof l === "string" ? { title: l, url: l } : l as { title: string; url: string }
        ),
        sentiment: result.sentiment,
        aiProcessed: true,
      });
      processed++;
    } catch (err) {
      console.warn(`[newsSummarizer] Failed for ${article.id}:`, err);
      await updateArticle(article.id, { aiProcessed: true });
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log(`[newsSummarizer] Processed ${processed}/${pending.length} articles`);
  return processed;
}
