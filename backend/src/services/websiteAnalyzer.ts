import { scrape } from "./webScraper";
import { detectTechStack } from "./techStack";
import { scanTechStack } from "./osvService";
import { callAI } from "./aiRouter";
import { buildAnalysisPrompt } from "../prompts/analysisPrompts";
import { updateAnalysis, WebsiteAnalysis } from "./analysisStore";
import { extractContacts } from "./contactExtractor";
import { saveContacts } from "./contactStore";

export async function runAnalysis(userId: string, analysisId: string, url: string): Promise<void> {
  try {
    await updateAnalysis(userId, analysisId, { status: "processing" });

    const scraped = await scrape(url);
    if (!scraped.text && !scraped.title) {
      await updateAnalysis(userId, analysisId, { status: "failed", errorMessage: "Could not fetch website content. The site may require JavaScript or block bots." });
      return;
    }

    const contacts = extractContacts(scraped.html ?? scraped.text, url);
    const techStackRaw = await detectTechStack(url);
    const techStack = techStackRaw ?? undefined;

    await saveContacts(userId, analysisId, url, contacts).catch(console.error);

    const prompt = buildAnalysisPrompt(url, scraped.title, scraped.metaTags?.description ?? "", scraped.text);
    const aiRaw = await callAI(prompt, undefined, 2000);

    let aiResult: WebsiteAnalysis["aiResult"] = undefined;
    if (aiRaw) {
      try {
        const fenced = aiRaw.match(/```(?:json)?[\r\n]?([\s\S]*?)```/);
        const jsonStr = fenced ? fenced[1] : aiRaw;
        aiResult = JSON.parse(jsonStr.trim());
      } catch {
        const extract = (key: string) => { const m = aiRaw.match(new RegExp('"' + key + '"\\s*:\\s*"([^"]+)"')); return m?.[1]; };
        aiResult = { company_name: extract("company_name"), executive_summary: extract("executive_summary"), industry: extract("industry"), sales_hook: extract("sales_hook") };
      }
    }

    const vulns = techStack ? await scanTechStack(techStack as unknown as Record<string, string[]>).catch(() => []) : [];

    await updateAnalysis(userId, analysisId, {
      status: "done",
      pageTitle: scraped.title,
      techStack,
      aiResult,
      metaTags: scraped.metaTags,
      vulnerabilities: vulns,
      contacts,
    });
  } catch (err) {
    console.error("[websiteAnalyzer]", err);
    await updateAnalysis(userId, analysisId, { status: "failed", errorMessage: err instanceof Error ? err.message : "Unknown error" });
  }
}
