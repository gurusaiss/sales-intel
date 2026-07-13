import { Router } from "express";
import { z } from "zod";
import { getEnrichmentProvider } from "../services/enrichment";
import { generateResearchOutput } from "../services/ai";
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
    const { aiSummary, outreachDraft } = await generateResearchOutput(enrichment);

    const response: ResearchResponse = { enrichment, aiSummary, outreachDraft };
    res.json(response);
  } catch (err) {
    console.error("Search failed", err);
    res.status(500).json({ error: "Research lookup failed. Please try again." });
  }
});

export default router;
