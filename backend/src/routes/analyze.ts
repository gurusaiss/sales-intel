import { Router } from "express";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { requireApiKey } from "../middleware/apiKey";
import { createRateLimit } from "../middleware/rateLimit";
import { createAnalysis, getAnalysis, listAnalyses } from "../services/analysisStore";
import { runAnalysis } from "../services/websiteAnalyzer";
import { getContactsByAnalysis, exportContactsAsCsv, exportContactsAsMarkdown } from "../services/contactStore";

const router = Router();

// Analysis triggers a real scrape + tech-stack fingerprint + CVE scan + AI
// pass — genuinely expensive per request, unlike a plain KV read. 20/hour is
// generous for interactive use but blocks a runaway loop from burning the
// AI provider's rate/cost budget.
const analyzeLimiter = createRateLimit(20, 3_600_000);

const analyzeSchema = z.object({
  url: z.string().url("Must be a valid URL"),
});

router.post("/analyze", requireApiKey, analyzeLimiter, async (req, res) => {
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

router.get("/analyze/:id/contacts", requireApiKey, async (req, res) => {
  try {
    const userId = req.userId ?? "default";
    const contacts = await getContactsByAnalysis(userId, req.params.id);
    if (!contacts) return res.status(404).json({ error: "Contacts not found" });
    res.json({ contacts });
  } catch { res.status(500).json({ error: "Failed to fetch contacts" }); }
});

router.get("/analyze/:id/download/json", requireApiKey, async (req, res) => {
  try {
    const userId = req.userId ?? "default";
    const [analysis, contacts] = await Promise.all([getAnalysis(userId, req.params.id), getContactsByAnalysis(userId, req.params.id)]);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=analysis-" + analysis.domain + ".json");
    res.send(JSON.stringify({ analysis, contacts }, null, 2));
  } catch { res.status(500).json({ error: "Download failed" }); }
});

router.get("/analyze/:id/download/csv", requireApiKey, async (req, res) => {
  try {
    const userId = req.userId ?? "default";
    const contacts = await getContactsByAnalysis(userId, req.params.id);
    if (!contacts) return res.status(404).json({ error: "No contacts" });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=contacts-" + contacts.domain + ".csv");
    res.send(exportContactsAsCsv(contacts));
  } catch { res.status(500).json({ error: "Download failed" }); }
});

router.get("/analyze/:id/download/markdown", requireApiKey, async (req, res) => {
  try {
    const userId = req.userId ?? "default";
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

router.get("/analyze/:id/download/pdf", requireApiKey, async (req, res) => {
  try {
    const userId = req.userId ?? "default";
    const [analysis, contacts] = await Promise.all([getAnalysis(userId, req.params.id), getContactsByAnalysis(userId, req.params.id)]);
    if (!analysis) return res.status(404).json({ error: "Not found" });
    const ai = analysis.aiResult ?? {};

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=analysis-" + analysis.domain + ".pdf");

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).font("Helvetica-Bold").text(ai.company_name ?? analysis.domain);
    doc.fontSize(10).font("Helvetica").fillColor("#666").text(analysis.url);
    doc.moveDown(0.3);
    doc.fillColor("#999").text("Generated " + new Date(analysis.updatedAt).toLocaleString());
    doc.moveDown(1);

    const section = (title: string) => {
      doc.moveDown(0.6);
      doc.fillColor("#4f46e5").fontSize(13).font("Helvetica-Bold").text(title);
      doc.fillColor("#111").fontSize(10).font("Helvetica");
      doc.moveDown(0.2);
    };

    if (ai.executive_summary) { section("Executive Summary"); doc.text(ai.executive_summary); }
    if (ai.sales_hook) { section("Sales Hook"); doc.text(ai.sales_hook); }

    const facts = [
      ["Industry", ai.industry], ["Business model", ai.business_model], ["Pricing", ai.pricing_model],
      ["Headquarters", ai.headquarters], ["Founded", ai.founded], ["Team size", ai.team_size],
    ].filter(([, v]) => v);
    if (facts.length) {
      section("Company Details");
      facts.forEach(([k, v]) => doc.text(`${k}: ${v}`));
    }

    if (analysis.techStack) {
      const entries = Object.entries(analysis.techStack).filter(([, v]) => Array.isArray(v) && v.length > 0);
      if (entries.length) {
        section("Tech Stack");
        entries.forEach(([cat, items]) => doc.text(`${cat}: ${(items as string[]).join(", ")}`));
      }
    }

    if (analysis.vulnerabilities && analysis.vulnerabilities.length > 0) {
      section("Security Vulnerabilities (CVEs)");
      analysis.vulnerabilities.forEach((v) => doc.text(`[${v.severity}] ${v.cveId} — ${v.techName}: ${v.summary}`));
    }

    if (contacts) {
      section("Extracted Contacts");
      if (contacts.emails.length) { doc.font("Helvetica-Bold").text("Emails:"); doc.font("Helvetica"); contacts.emails.forEach((e) => doc.text(`  [${e.type}] ${e.email}`)); }
      if (contacts.phones.length) { doc.font("Helvetica-Bold").text("Phones:"); doc.font("Helvetica"); contacts.phones.forEach((p) => doc.text(`  [${p.type}] ${p.raw}`)); }
      if (contacts.socialLinks.length) { doc.font("Helvetica-Bold").text("Social:"); doc.font("Helvetica"); contacts.socialLinks.forEach((s) => doc.text(`  ${s.platform}: ${s.url}`)); }
      if (contacts.bookingLinks.length) { doc.font("Helvetica-Bold").text("Booking:"); doc.font("Helvetica"); contacts.bookingLinks.forEach((b) => doc.text(`  ${b.platform}: ${b.url}`)); }
    }

    doc.end();
  } catch (err) {
    console.error("PDF download failed", err);
    if (!res.headersSent) res.status(500).json({ error: "Download failed" });
  }
});

export default router;
