import { useState, useEffect } from "react";
import { toast } from "./components/Toast";

interface Bookmark {
  id: string;
  contentType: string;
  contentId: string;
  title: string;
  note?: string;
  collectionId?: string;
  createdAt: string;
}

interface TopicFollow {
  id: string;
  topic: string;
}

interface FeedArticle {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  summaryShort?: string;
  publishedAt: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:4000") + "/api";
const API_KEY = import.meta.env.VITE_APP_API_KEY ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("sessionToken");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export default function SavedView() {
  const [tab, setTab] = useState<"feed" | "bookmarks" | "topics">("feed");
  const [feed, setFeed] = useState<FeedArticle[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [follows, setFollows] = useState<TopicFollow[]>([]);
  const [newTopic, setNewTopic] = useState("");
  const [brief, setBrief] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === "feed") {
      setLoading(true);
      Promise.all([
        apiFetch("/me/feed").then((d) => setFeed(d.articles ?? [])),
        apiFetch("/me/catch-up-brief").then((d) => setBrief(d.brief ?? null)).catch(() => {}),
      ]).finally(() => setLoading(false));
    } else if (tab === "bookmarks") {
      setLoading(true);
      apiFetch("/me/bookmarks").then((d) => setBookmarks(d.bookmarks ?? [])).finally(() => setLoading(false));
    } else if (tab === "topics") {
      setLoading(true);
      apiFetch("/me/follows").then((d) => setFollows(d.follows ?? [])).finally(() => setLoading(false));
    }
  }, [tab]);

  async function addTopic(e: React.FormEvent) {
    e.preventDefault();
    if (!newTopic.trim()) return;
    try {
      const d = await apiFetch("/me/follows", { method: "POST", body: JSON.stringify({ topic: newTopic.trim() }) });
      setFollows((prev) => [...prev, d.follow]);
      setNewTopic("");
      toast("Topic followed!", "success");
    } catch { toast("Failed to follow topic", "error"); }
  }

  async function removeTopic(id: string) {
    try {
      await apiFetch(`/me/follows/${id}`, { method: "DELETE" });
      setFollows((prev) => prev.filter((f) => f.id !== id));
    } catch { toast("Failed to unfollow", "error"); }
  }

  async function deleteBookmark(id: string) {
    try {
      await apiFetch(`/me/bookmarks/${id}`, { method: "DELETE" });
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
      toast("Removed", "success");
    } catch { toast("Failed to remove", "error"); }
  }

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>Saved</h2>
        <p className="intel-subtitle">Your personal feed, bookmarks, and followed topics</p>
      </div>

      <div className="tab-pills">
        <button className={`tab-pill ${tab === "feed" ? "active" : ""}`} onClick={() => setTab("feed")}>My Feed</button>
        <button className={`tab-pill ${tab === "bookmarks" ? "active" : ""}`} onClick={() => setTab("bookmarks")}>Bookmarks</button>
        <button className={`tab-pill ${tab === "topics" ? "active" : ""}`} onClick={() => setTab("topics")}>Topics</button>
      </div>

      {tab === "feed" && (
        <>
          {brief && <div className="catch-up-banner"><span className="card-label">Catch-up brief</span><p>{brief}</p></div>}
          {loading ? <div className="empty-state">Loading your feed…</div>
            : feed.length === 0 ? <div className="empty-state">Follow topics to personalize your feed.</div>
              : feed.map((a) => (
                  <div key={a.id} className="article-card">
                    <div className="article-meta">
                      <span className="article-source">{a.sourceName}</span>
                      <span className="article-time">{new Date(a.publishedAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="article-title">{a.title}</h3>
                    {a.summaryShort && <p className="article-preview">{a.summaryShort}</p>}
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Read →</a>
                  </div>
                ))}
        </>
      )}

      {tab === "bookmarks" && (
        <>
          {loading ? <div className="empty-state">Loading…</div>
            : bookmarks.length === 0 ? <div className="empty-state">No bookmarks yet.</div>
              : bookmarks.map((b) => (
                  <div key={b.id} className="article-card">
                    <div className="article-meta">
                      <span className="chip chip-sm">{b.contentType}</span>
                      <span className="article-time">{new Date(b.createdAt).toLocaleDateString()}</span>
                    </div>
                    <h3 className="article-title">{b.title}</h3>
                    {b.note && <p className="article-preview">{b.note}</p>}
                    <button className="btn-outline btn-sm" onClick={() => deleteBookmark(b.id)}>Remove</button>
                  </div>
                ))}
        </>
      )}

      {tab === "topics" && (
        <>
          <form className="analyze-form" onSubmit={addTopic} style={{ marginBottom: "1rem" }}>
            <input className="query-input" value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder="Follow a topic — e.g. AI, SaaS, DevOps" />
            <button type="submit">Follow</button>
          </form>
          {follows.length === 0 ? <div className="empty-state">No topics followed yet.</div>
            : <div className="chip-row">
                {follows.map((f) => (
                  <div key={f.id} className="topic-chip">
                    <span>{f.topic}</span>
                    <button className="chip-remove" onClick={() => removeTopic(f.id)}>×</button>
                  </div>
                ))}
              </div>}
        </>
      )}
    </div>
  );
}
