import { useState, useEffect, useCallback } from "react";
import { ArticleSkeleton, CardSkeleton } from "./components/Skeleton";
import { toast } from "./components/Toast";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Article {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceCategory: string;
  summaryShort?: string;
  summaryMedium?: string;
  keyHighlights?: string[];
  whyItMatters?: string;
  salesOpportunity?: string;
  risks?: string[];
  actionItems?: string[];
  relatedCompanies?: string[];
  relatedProducts?: string[];
  relatedTechnologies?: string[];
  importantLinks?: { label: string; url: string }[];
  sentiment?: "positive" | "neutral" | "negative";
  categories: string[];
  keywords: string[];
  publishedAt: string;
  viewCount: number;
  hnPoints?: number;
  hnComments?: number;
}

interface Trend {
  id: string;
  name: string;
  category: string;
  description: string;
  trendScore: number;
  growthScore: number;
  adoptionScore: number;
}

interface SparklineEntry {
  date: string;
  count: number;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("salesIntelToken");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NEWS_CATEGORIES = [
  "All", "AI", "Tech", "Startups", "Cybersecurity", "Cloud",
  "DevOps", "Web Dev", "Data Science", "Open Source",
  "Funding", "Engineering", "Marketing", "Sales",
];

const NEWS_LIMIT = 20;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SentimentBadge({ sentiment }: { sentiment?: Article["sentiment"] }) {
  if (!sentiment) return null;
  const map: Record<string, { label: string; cls: string }> = {
    positive: { label: "Positive", cls: "sentiment-positive" },
    neutral: { label: "Neutral", cls: "sentiment-neutral" },
    negative: { label: "Negative", cls: "sentiment-negative" },
  };
  const { label, cls } = map[sentiment] ?? map.neutral;
  return <span className={`sentiment-badge ${cls}`}>{label}</span>;
}

function StringList({ items, label }: { items?: string[]; label: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="detail-section">
      <span className="detail-label">{label}</span>
      <ul className="detail-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

function TagCloud({ items, label }: { items?: string[]; label: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="detail-section">
      <span className="detail-label">{label}</span>
      <div className="tag-row" style={{ marginTop: "0.35rem" }}>
        {items.map((item) => <span className="tag" key={item}>{item}</span>)}
      </div>
    </div>
  );
}

function ImportantLinks({ links }: { links?: { label: string; url: string }[] }) {
  if (!links || links.length === 0) return null;
  return (
    <div className="detail-section">
      <span className="detail-label">Important links</span>
      <div className="important-links">
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
            {l.label} ↗
          </a>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-bar-row">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      <span className="score-num">{Math.round(value)}</span>
    </div>
  );
}

function Sparkline({ entries }: { entries: SparklineEntry[] }) {
  if (!entries.length) return <div className="sparkline-empty">No history yet</div>;
  const max = Math.max(...entries.map((e) => e.count), 1);
  return (
    <div className="sparkline">
      {entries.map((e) => (
        <div key={e.date} className="spark-bar" title={`${e.date}: ${e.count}`}>
          <div className="spark-fill" style={{ height: `${(e.count / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// News panel
// ---------------------------------------------------------------------------

function NewsPanel() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, Article>>({});
  const [bookmarking, setBookmarking] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const cat = category === "All" ? "" : category;
    apiFetch(`/news?category=${encodeURIComponent(cat)}&limit=${NEWS_LIMIT}&offset=${offset}`)
      .then((d) => setArticles(d.articles ?? []))
      .catch(() => toast("Failed to load news", "error"))
      .finally(() => setLoading(false));
  }, [category, offset]);

  async function expand(article: Article) {
    if (expanded === article.id) { setExpanded(null); return; }
    setExpanded(article.id);
    if (!detail[article.id]) {
      try {
        const d = await apiFetch(`/news/${article.id}`);
        setDetail((prev) => ({ ...prev, [article.id]: d.article }));
      } catch { /* fall back to basic data */ }
    }
  }

  async function bookmark(article: Article, e: React.MouseEvent) {
    e.stopPropagation();
    if (bookmarking === article.id) return;
    setBookmarking(article.id);
    try {
      await apiFetch("/me/bookmarks", {
        method: "POST",
        body: JSON.stringify({ contentType: "article", contentId: article.id, title: article.title }),
      });
      toast("Bookmarked!", "success");
    } catch {
      toast("Failed to bookmark", "error");
    } finally {
      setBookmarking(null);
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <>
      {/* Category chips */}
      <div className="chip-row chip-row-scroll">
        {NEWS_CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? "chip-active" : ""}`}
            onClick={() => { setCategory(c); setOffset(0); setExpanded(null); }}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Article list */}
      <div className="article-list">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <ArticleSkeleton key={i} />)
          : articles.length === 0
            ? <div className="empty-state">No articles yet — data loads automatically every 30 minutes.</div>
            : articles.map((article) => {
                const det: Article = detail[article.id] ?? article;
                const isOpen = expanded === article.id;
                return (
                  <div key={article.id} className={`article-card ${isOpen ? "article-card-open" : ""}`}>
                    {/* Card header — always visible */}
                    <div className="article-header" onClick={() => expand(article)}>
                      <div className="article-meta">
                        <span className="article-source">{article.sourceName}</span>
                        <span className="article-time">{timeAgo(article.publishedAt)}</span>
                        {article.hnPoints ? <span className="hn-badge">▲ {article.hnPoints}</span> : null}
                        {article.hnComments ? <span className="hn-badge hn-comments">💬 {article.hnComments}</span> : null}
                        <SentimentBadge sentiment={det.sentiment} />
                        <button
                          className={`bookmark-btn ${bookmarking === article.id ? "bookmarking" : ""}`}
                          onClick={(e) => bookmark(article, e)}
                          title="Bookmark"
                          aria-label="Bookmark article"
                        >
                          {bookmarking === article.id ? "…" : "🔖"}
                        </button>
                      </div>
                      <h3 className="article-title">{article.title}</h3>
                      {article.summaryShort && !isOpen && (
                        <p className="article-preview">{article.summaryShort}</p>
                      )}
                      <div className="tag-row" style={{ marginTop: "0.4rem" }}>
                        {article.categories.slice(0, 3).map((c) => <span className="tag" key={c}>{c}</span>)}
                      </div>
                    </div>

                    {/* Expanded detail panel */}
                    {isOpen && (
                      <div className="article-detail">
                        {det.summaryMedium && (
                          <div className="detail-section">
                            <span className="detail-label">Summary</span>
                            <p>{det.summaryMedium}</p>
                          </div>
                        )}

                        <StringList items={det.keyHighlights} label="Key highlights" />

                        {det.whyItMatters && (
                          <div className="detail-section">
                            <span className="detail-label">Why it matters</span>
                            <p>{det.whyItMatters}</p>
                          </div>
                        )}

                        {det.salesOpportunity && (
                          <div className="detail-section detail-sales">
                            <span className="detail-label">Sales opportunity</span>
                            <p>{det.salesOpportunity}</p>
                          </div>
                        )}

                        <StringList items={det.risks} label="Risks" />
                        <StringList items={det.actionItems} label="Action items" />
                        <TagCloud items={det.relatedCompanies} label="Related companies" />
                        <TagCloud items={det.relatedProducts} label="Related products" />
                        <TagCloud items={det.relatedTechnologies} label="Related technologies" />
                        <ImportantLinks links={det.importantLinks} />

                        <div className="detail-actions">
                          <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-outline">
                            Read original ↗
                          </a>
                          <button
                            className={`btn-outline ${bookmarking === article.id ? "bookmarking" : ""}`}
                            onClick={(e) => bookmark(article, e)}
                            disabled={bookmarking === article.id}
                          >
                            {bookmarking === article.id ? "Saving…" : "🔖 Bookmark"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
      </div>

      {/* Pagination */}
      {!loading && articles.length === NEWS_LIMIT && (
        <div className="pagination">
          {offset > 0 && (
            <button className="btn-outline" onClick={() => { setOffset((o) => o - NEWS_LIMIT); setExpanded(null); }}>
              ← Previous
            </button>
          )}
          <button className="btn-outline" onClick={() => { setOffset((o) => o + NEWS_LIMIT); setExpanded(null); }}>
            Next →
          </button>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Trends panel
// ---------------------------------------------------------------------------

function TrendsPanel() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sparklines, setSparklines] = useState<Record<string, SparklineEntry[]>>({});
  const [bookmarking, setBookmarking] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch("/trends")
      .then((d) => setTrends(d.trends ?? []))
      .catch(() => toast("Failed to load trends", "error"))
      .finally(() => setLoading(false));
  }, []);

  const loadSparkline = useCallback(async (name: string) => {
    if (sparklines[name] !== undefined) return;
    try {
      const d = await apiFetch(`/trends/${encodeURIComponent(name)}/sparkline`);
      setSparklines((prev) => ({ ...prev, [name]: d.sparkline ?? [] }));
    } catch { /* ignore */ }
  }, [sparklines]);

  async function bookmark(trend: Trend, e: React.MouseEvent) {
    e.stopPropagation();
    if (bookmarking === trend.id) return;
    setBookmarking(trend.id);
    try {
      await apiFetch("/me/bookmarks", {
        method: "POST",
        body: JSON.stringify({ contentType: "trend", contentId: trend.id, title: trend.name }),
      });
      toast("Bookmarked!", "success");
    } catch {
      toast("Failed to bookmark", "error");
    } finally {
      setBookmarking(null);
    }
  }

  return (
    <div className="card-grid">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        : trends.length === 0
          ? <div className="empty-state" style={{ gridColumn: "1 / -1" }}>Trends load automatically every 2 hours.</div>
          : trends.map((t) => (
              <div
                key={t.id}
                className="trend-card"
                onMouseEnter={() => loadSparkline(t.name)}
              >
                <div className="trend-header">
                  <span className="trend-name">{t.name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span className="chip chip-sm">{t.category}</span>
                    <button
                      className={`bookmark-btn bookmark-btn-sm ${bookmarking === t.id ? "bookmarking" : ""}`}
                      onClick={(e) => bookmark(t, e)}
                      title="Bookmark trend"
                      aria-label={`Bookmark ${t.name}`}
                    >
                      {bookmarking === t.id ? "…" : "🔖"}
                    </button>
                  </div>
                </div>
                <p className="trend-desc">{t.description}</p>
                <Sparkline entries={sparklines[t.name] ?? []} />
                <div className="scores">
                  <ScoreBar label="Trend" value={t.trendScore} />
                  <ScoreBar label="Growth" value={t.growthScore} />
                  <ScoreBar label="Adoption" value={t.adoptionScore} />
                </div>
              </div>
            ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export default function NewsAndTrendsView() {
  const [subTab, setSubTab] = useState<"news" | "trends">("news");

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>News &amp; Trends</h2>
        <p className="intel-subtitle">
          Live feed from 25+ sources and AI-detected tech trends — all in one place
        </p>
      </div>

      {/* Sub-navigation */}
      <div className="tab-pills" style={{ marginBottom: "1.25rem" }}>
        <button
          className={`tab-pill ${subTab === "news" ? "active" : ""}`}
          onClick={() => setSubTab("news")}
        >
          Latest News
        </button>
        <button
          className={`tab-pill ${subTab === "trends" ? "active" : ""}`}
          onClick={() => setSubTab("trends")}
        >
          Tech Trends
        </button>
      </div>

      {subTab === "news" && <NewsPanel />}
      {subTab === "trends" && <TrendsPanel />}
    </div>
  );
}
