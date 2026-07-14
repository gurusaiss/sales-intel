import { Router } from "express";
import { requireApiKey } from "../middleware/apiKey";
import { listArticles, getArticle, incrementViewCount, getArticleCategories } from "../services/articleStore";
import { fetchHnSignalForUrl } from "../services/newsSignals";

const router = Router();

router.get("/news", requireApiKey, async (req, res) => {
  try {
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);
    const offset = parseInt(String(req.query.offset ?? "0"), 10) || 0;
    const articles = await listArticles({ category, limit, offset });
    res.json({ articles, limit, offset });
  } catch (err) { console.error(err); res.status(500).json({ error: "Failed to fetch news" }); }
});

router.get("/news/categories", requireApiKey, async (_req, res) => {
  try {
    const categories = await getArticleCategories();
    res.json({ categories });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/news/:id", requireApiKey, async (req, res) => {
  try {
    const article = await getArticle(req.params.id);
    if (!article) return res.status(404).json({ error: "Not found" });
    await incrementViewCount(article.id);
    // Enrich with HN signals on detail fetch
    if (!article.hnPoints) {
      const hn = await fetchHnSignalForUrl(article.url).catch(() => null);
      if (hn) {
        article.hnPoints = hn.points;
        article.hnComments = hn.comments;
        article.hnStoryId = hn.storyId;
      }
    }
    res.json({ article });
  } catch { res.status(500).json({ error: "Failed" }); }
});

export default router;
