import { Router } from "express";
import { requireApiKey } from "../middleware/apiKey";
import {
  listBookmarks, createBookmark, updateBookmark, deleteBookmark,
  listCollections, createCollection, deleteCollection,
  listTopicFollows, addTopicFollow, removeTopicFollow,
} from "../services/bookmarkStore";
import { getPersonalFeed, getCatchUpBrief } from "../services/feedService";

const router = Router();

router.get("/me/feed", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  const limit = Math.min(50, parseInt(String(req.query.limit ?? "20"), 10) || 20);
  try { res.json({ articles: await getPersonalFeed(userId, limit) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/me/catch-up-brief", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ brief: await getCatchUpBrief(userId) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/me/bookmarks", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  const contentType = typeof req.query.content_type === "string" ? req.query.content_type as import("../services/bookmarkStore").BookmarkType : undefined;
  const collectionId = typeof req.query.collection_id === "string" ? req.query.collection_id : undefined;
  try { res.json({ bookmarks: await listBookmarks(userId, contentType, collectionId) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.post("/me/bookmarks", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ bookmark: await createBookmark(userId, req.body) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.patch("/me/bookmarks/:id", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try {
    const updated = await updateBookmark(userId, req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json({ bookmark: updated });
  } catch { res.status(500).json({ error: "Failed" }); }
});

router.delete("/me/bookmarks/:id", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ deleted: await deleteBookmark(userId, req.params.id) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/me/collections", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ collections: await listCollections(userId) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.post("/me/collections", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ collection: await createCollection(userId, req.body) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.delete("/me/collections/:id", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ deleted: await deleteCollection(userId, req.params.id) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.get("/me/follows", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ follows: await listTopicFollows(userId) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.post("/me/follows", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  const { topic } = req.body as { topic?: string };
  if (!topic) return res.status(400).json({ error: "topic required" });
  try { res.json({ follow: await addTopicFollow(userId, topic) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

router.delete("/me/follows/:id", requireApiKey, async (req, res) => {
  const userId = req.userId ?? "default";
  try { res.json({ deleted: await removeTopicFollow(userId, req.params.id) }); }
  catch { res.status(500).json({ error: "Failed" }); }
});

export default router;
