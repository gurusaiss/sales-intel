import { Router } from "express";
import { z } from "zod";
import { getEnrichmentProvider } from "../services/enrichment";
import { generateResearchOutput } from "../services/ai";
import { fetchGrowthSignals } from "../services/newsSignals";
import { detectTechStack, flattenTechStack } from "../services/techStack";
import { ResearchResponse } from "../types";
import { requireApiKey } from "../middleware/apiKey";

const router = Router();

const searchSchema = z.object({
  query: z.string().trim().min(2, "Query must be at least 2 characters"),
  domain: z
    .string()
    .trim()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domain must look like example.com")
    .optional()
    .or(z.literal("")),
});

router.post("/search", requireApiKey, async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const domain = parsed.data.domain || undefined;

  try {
    const provider = getEnrichmentProvider(domain);
    const enrichment = await provider.lookup(parsed.data.query, domain);

    if (enrichment.company) {
      const realSignals = await fetchGrowthSignals(enrichment.company.name);
      if (realSignals.length > 0) {
        enrichment.company.newsSignals = realSignals;
        enrichment.sources = [...enrichment.sources, "hacker-news"];
      }

      const companyDomain = domain ?? enrichment.company.domain;
      if (companyDomain) {
        const techStack = await detectTechStack(companyDomain);
        if (techStack) {
          enrichment.company.techStack = techStack;
          const detected = flattenTechStack(techStack);
          const existing = enrichment.company.technologies ?? [];
          const merged = [...new Set([...existing, ...detected])];
          if (merged.length > 0) enrichment.company.technologies = merged;
          if (detected.length > 0) enrichment.sources = [...enrichment.sources, "tech-stack-detect"];
        }
      }
    }

    const { aiSummary, outreachDraft } = await generateResearchOutput(enrichment);

    const response: ResearchResponse = { enrichment, aiSummary, outreachDraft };
    res.json(response);
  } catch (err) {
    console.error("Search failed", err);
    res.status(500).json({ error: "Research lookup failed. Please try again." });
  }
});

export default router;
