import { Router } from "express";
import { requireApiKey } from "../middleware/apiKey";
import { listTrends, listInnovations, getTrendCategories, getInnovationTypes, getSparkline } from "../services/trendStore";
import { getStatForTech } from "../services/packageStats";
import { searchArxivPapers } from "../services/arxivService";

const router = Router();

router.get("/trends", requireApiKey, async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const trends = await listTrends(category);
    res.json({ trends });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/trends/categories", requireApiKey, async (_req, res) => {
  try { res.json({ categories: await getTrendCategories() }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/trends/:name/sparkline", requireApiKey, async (req, res) => {
  try { res.json({ sparkline: await getSparkline(req.params.name) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/trends/:name/packages", requireApiKey, async (req, res) => {
  try { res.json({ stat: await getStatForTech(req.params.name) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/trends/:name/papers", requireApiKey, async (req, res) => {
  try { res.json({ papers: await searchArxivPapers(req.params.name, 5) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/innovations", requireApiKey, async (req, res) => {
  try {
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const limit = Math.min(100, parseInt(String(req.query.limit ?? "50"), 10) || 50);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
    const all = await listInnovations(type);
    res.json({ innovations: all.slice(offset, offset + limit), total: all.length });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/innovations/types", requireApiKey, async (_req, res) => {
  try { res.json({ types: await getInnovationTypes() }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

export default router;
