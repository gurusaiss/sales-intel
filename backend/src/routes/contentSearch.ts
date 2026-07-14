import { Router } from "express";
import { requireApiKey } from "../middleware/apiKey";
import { searchContent } from "../services/searchService";

const router = Router();

router.get("/intel/search", requireApiKey, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);
  if (!q || q.length < 2) return res.status(400).json({ error: "Query must be at least 2 characters" });
  try { res.json({ results: await searchContent(q, limit), query: q }); }
  catch { res.status(500).json({ error: "Search failed" }); }
});

export default router;
