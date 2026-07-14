import { Router } from "express";
import { requireApiKey } from "../middleware/apiKey";
import { listReports, getLatestReport, getReport } from "../services/reportStore";
import { generateReport } from "../services/reportGenerator";
import { ReportType, REPORT_PROMPTS } from "../prompts/reportPrompts";

const router = Router();
const VALID_TYPES = Object.keys(REPORT_PROMPTS) as ReportType[];

router.get("/reports", requireApiKey, async (req, res) => {
  try {
    const type = req.query.type as ReportType | undefined;
    const reports = await listReports(type);
    res.json({ reports });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/reports/types", requireApiKey, async (_req, res) => {
  res.json({ types: VALID_TYPES });
});

router.get("/reports/:type/latest", requireApiKey, async (req, res) => {
  const type = req.params.type as ReportType;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "Invalid report type" });
  try {
    const report = await getLatestReport(type);
    if (!report) return res.status(404).json({ error: "No report generated yet" });
    res.json(report);
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/reports/:id", requireApiKey, async (req, res) => {
  try {
    const report = await getReport(req.params.id);
    if (!report) return res.status(404).json({ error: "Not found" });
    res.json(report);
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.post("/reports/generate/:type", requireApiKey, async (req, res) => {
  const type = req.params.type as ReportType;
  if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "Invalid report type" });
  try {
    setImmediate(() => { void generateReport(type); });
    res.json({ message: `Report generation started for type: ${type}` });
  } catch { res.status(500).json({ error: "Failed" }); }
});

export default router;
