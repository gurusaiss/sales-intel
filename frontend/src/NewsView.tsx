import { useState, useEffect } from "react";
import { ArticleSkeleton } from "./components/Skeleton";
import { toast } from "./components/Toast";

interface Article {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  sourceCategory: string;
  summaryShort?: string;
  summaryMedium?: string;
  whyItMatters?: string;
  salesOpportunity?: string;
  categories: string[];
  keywords: string[];
  publishedAt: string;
  viewCount: number;
  hnPoints?: number;
  hnComments?: number;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

async function apiFetch(path: string) {
  const token = localStorage.getItem("salesIntelToken");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

const CATEGORIES = ["All", "AI", "Tech", "Startups", "Cybersecurity", "Cloud", "DevOps", "Web Dev", "Data Science", "Open Source", "Funding", "Engineering"];

export default function NewsView() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, Article>>({});
  const LIMIT = 20;

  useEffect(() => {
    setLoading(true);
    const cat = category === "All" ? "" : category;
    apiFetch(`/news?category=${encodeURIComponent(cat)}&limit=${LIMIT}&offset=${offset}`)
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
      } catch { /* use basic data */ }
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>News & Trends</h2>
        <p className="intel-subtitle">Live feed from 25 sources — AI, Tech, Startups, Security and more</p>
      </div>

      <div className="chip-row">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            className={`chip ${category === c ? "chip-active" : ""}`}
            onClick={() => { setCategory(c); setOffset(0); }}
          >{c}</button>
        ))}
      </div>

      <div className="article-list">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <ArticleSkeleton key={i} />)
          : articles.length === 0
            ? <div className="empty-state">No articles yet — data loads automatically every 30 minutes.</div>
            : articles.map((article) => {
                const det = detail[article.id] ?? article;
                const isOpen = expanded === article.id;
                return (
                  <div key={article.id} className={`article-card ${isOpen ? "article-card-open" : ""}`}>
                    <div className="article-header" onClick={() => expand(article)}>
                      <div className="article-meta">
                        <span className="article-source">{article.sourceName}</span>
                        <span className="article-time">{timeAgo(article.publishedAt)}</span>
                        {article.hnPoints ? <span className="hn-badge">▲ {article.hnPoints}</span> : null}
                      </div>
                      <h3 className="article-title">{article.title}</h3>
                      {article.summaryShort && !isOpen && (
                        <p className="article-preview">{article.summaryShort}</p>
                      )}
                      <div className="tag-row" style={{ marginTop: "0.4rem" }}>
                        {article.categories.slice(0, 3).map((c) => <span className="tag" key={c}>{c}</span>)}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="article-detail">
                        {det.summaryMedium && (
                          <div className="detail-section">
                            <span className="detail-label">Summary</span>
                            <p>{det.summaryMedium}</p>
                          </div>
                        )}
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
                        <a href={article.url} target="_blank" rel="noopener noreferrer" className="btn-outline">
                          Read original ↗
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
      </div>

      {!loading && articles.length === LIMIT && (
        <div className="pagination">
          {offset > 0 && <button className="btn-outline" onClick={() => setOffset((o) => o - LIMIT)}>← Previous</button>}
          <button className="btn-outline" onClick={() => setOffset((o) => o + LIMIT)}>Next →</button>
        </div>
      )}
    </div>
  );
}
