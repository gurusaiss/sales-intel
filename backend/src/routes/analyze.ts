import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { createAnalysis, getAnalysis, listAnalyses } from "../services/analysisStore";
import { runAnalysis } from "../services/websiteAnalyzer";
import { getContactsByAnalysis, exportContactsAsCsv, exportContactsAsMarkdown } from "../services/contactStore";
import { DEFAULT_USER_ID } from "../services/kvStore";

const router = Router();

const analyzeSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

router.post("/analyze", requireApiKey, async (req, res) => {
  const parsed = analyzeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid URL" });

  const userId = req.userId ?? "default";
  try {
    const analysis = await createAnalysis(userId, parsed.data.url);
    // Start analysis in background (non-blocking)
    setImmediate(() => { void runAnalysis(userId, analysis.id, parsed.data.url); });
    res.status(202).json({ id: analysis.id, status: analysis.status, url: analysis.url, createdAt: analysis.createdAt });
  } catch (err) {
    console.error("Analyze create failed", err);
    res.status(500).json({ error: "Failed to start analysis" });
  }
});

router.get("/analyze", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try {
    const analyses = await listAnalyses(userId);
    res.json({ analyses });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/analyze/:id", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try {
    const analysis = await getAnalysis(userId, req.params.id);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    res.json(analysis);
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/analyze/:id/vulnerabilities", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try {
    const analysis = await getAnalysis(userId, req.params.id);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    res.json({ vulnerabilities: analysis.vulnerabilities ?? [] });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/:id/contacts", requireApiKey, async (req, res) => {
  try {
    const userId = (req as any).userId ?? DEFAULT_USER_ID;
    const contacts = await getContactsByAnalysis(userId, req.params.id);
    if (!contacts) return res.status(404).json({ error: "Contacts not found" });
    res.json({ contacts });
  } catch (err) { res.status(500).json({ error: "Failed to fetch contacts" }); }
});

router.get("/:id/download/json", requireApiKey, async (req, res) => {
  try {
    const userId = (req as any).userId ?? DEFAULT_USER_ID;
    const [analysis, contacts] = await Promise.all([getAnalysis(userId, req.params.id), getContactsByAnalysis(userId, req.params.id)]);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=analysis-" + analysis.domain + ".json");
    res.send(JSON.stringify({ analysis, contacts }, null, 2));
  } catch { res.status(500).json({ error: "Download failed" }); }
});

router.get("/:id/download/csv", requireApiKey, async (req, res) => {
  try {
    const userId = (req as any).userId ?? DEFAULT_USER_ID;
    const contacts = await getContactsByAnalysis(userId, req.params.id);
    if (!contacts) return res.status(404).json({ error: "No contacts" });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts-" + contacts.domain + ".csv");
    res.send(exportContactsAsCsv(contacts));
  } catch { res.status(500).json({ error: "Download failed" }); }
});

router.get("/:id/download/markdown", requireApiKey, async (req, res) => {
  try {
    const userId = (req as any).userId ?? DEFAULT_USER_ID;
    const [analysis, contacts] = await Promise.all([getAnalysis(userId, req.params.id), getContactsByAnalysis(userId, req.params.id)]);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    const ai = analysis.aiResult ?? {};
    const lines = [
      "# Website Analysis — " + (ai.company_name ?? analysis.domain),
      "**URL:** " + analysis.url,
      "**Date:** " + new Date(analysis.updatedAt).toLocaleString(),
      "",
      "## Executive Summary",
      ai.executive_summary ?? "AI analysis pending",
      "",
      ai.sales_hook ? "## Sales Hook\n> " + ai.sales_hook : "",
      ai.industry ? "## Company Details\n- **Industry:** " + ai.industry : "",
      ai.business_model ? "- **Business Model:** " + ai.business_model : "",
      ai.pricing_model ? "- **Pricing:** " + ai.pricing_model : "",
      ai.headquarters ? "- **HQ:** " + ai.headquarters : "",
      "",
      contacts ? exportContactsAsMarkdown(contacts) : "",
    ];
    res.setHeader("Content-Type", "text/markdown");
    res.setHeader("Content-Disposition", "attachment; filename=analysis-" + analysis.domain + ".md");
    res.send(lines.filter(Boolean).join("\n"));
  } catch { res.status(500).json({ error: "Download failed" }); }
});

export default router;
