import { useState, useEffect, useCallback } from "react";

const API_BASE = (import.meta.env.VITE_API_BASE ?? "http://localhost:4000") + "/api";
const API_KEY = import.meta.env.VITE_APP_API_KEY ?? "";

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("sessionToken");
  const h: Record<string, string> = { "content-type": "application/json" };
  if (API_KEY) h["x-api-key"] = API_KEY;
  if (token) h["authorization"] = `Bearer ${token}`;
  return h;
}

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

interface Article { id: string; title: string; sourceName: string; publishedAt: string; sentiment?: string; sourceCategory?: string; }
interface Trend { id: string; name: string; category: string; trendScore: number; }
interface Innovation { id: string; name: string; type: string; starsToday?: number; githubStars?: number; url: string; }
interface Report { id: string; title?: string; type?: string; content?: string; createdAt?: string; }

type Tab = "newstrends" | "discover" | "reports" | "search" | "analyze";

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diff)) return "";
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_LABELS: Record<string, string> = {
  ai_release: "AI", oss: "OSS", startup: "Startup", dev_tool: "Dev Tool", sdk: "SDK", api: "API", other: "Other",
};

const SENTIMENT_COLOR: Record<string, string> = {
  Positive: "var(--success)", Negative: "var(--danger)", Neutral: "var(--muted)",
};

export default function DashboardView({ onNavigate }: { onNavigate?: (tab: Tab) => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [innovations, setInnovations] = useState<Innovation[]>([]);
  const [innovationTotal, setInnovationTotal] = useState(0);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [news, tr, inn, rep] = await Promise.all([
      get<{ articles: Article[] }>("/news?limit=50", { articles: [] }),
      get<{ trends: Trend[] }>("/trends", { trends: [] }),
      get<{ innovations: Innovation[]; total: number }>("/innovations?limit=50", { innovations: [], total: 0 }),
      get<{ reports: Report[] }>("/reports", { reports: [] }),
    ]);
    setArticles(news.articles ?? []);
    setTrends((tr.trends ?? []).slice().sort((a, b) => b.trendScore - a.trendScore));
    setInnovations(inn.innovations ?? []);
    setInnovationTotal(inn.total ?? (inn.innovations ?? []).length);
    setReports(rep.reports ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await fetch(`${API_BASE}/refresh`, { method: "POST" }).catch(() => {});
    // give the poll a moment, then reload
    await new Promise((r) => setTimeout(r, 2500));
    await load();
    setRefreshing(false);
  };

  const latestReport = reports[0];
  const topInnovations = innovations
    .slice()
    .sort((a, b) => (b.starsToday ?? b.githubStars ?? 0) - (a.starsToday ?? a.githubStars ?? 0))
    .slice(0, 6);

  const stats = [
    { label: "News Articles", value: articles.length >= 50 ? "50+" : String(articles.length), sub: "from 25+ sources", accent: "var(--primary)", icon: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm14-8h-8M15 18h-5M10 6h8v4h-8V6Z", tab: "newstrends" as Tab },
    { label: "Tech Trends", value: String(trends.length), sub: "AI-detected", accent: "var(--success)", icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3", tab: "newstrends" as Tab },
    { label: "Innovations", value: String(innovationTotal), sub: "GitHub · PH · HN", accent: "var(--info)", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z", tab: "discover" as Tab },
    { label: "Reports", value: String(reports.length), sub: "AI-generated", accent: "var(--warning)", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 13h6M9 17h6", tab: "reports" as Tab },
  ];

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <h2 className="dash-title">Intelligence Overview</h2>
          <p className="dash-sub">Your live command center — news, trends, innovations, and reports in one glance.</p>
        </div>
        <button className="dash-refresh" onClick={refresh} disabled={refreshing}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={refreshing ? "spin" : ""}>
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {/* KPI tiles */}
      <div className="stat-grid">
        {stats.map((s) => (
          <button key={s.label} className="stat-tile" onClick={() => onNavigate?.(s.tab)}>
            <span className="stat-icon" style={{ background: `color-mix(in srgb, ${s.accent} 14%, transparent)`, color: s.accent }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
            </span>
            <span className="stat-value">{loading ? "—" : s.value}</span>
            <span className="stat-label">{s.label}</span>
            <span className="stat-sub">{s.sub}</span>
          </button>
        ))}
      </div>

      <div className="dash-columns">
        {/* Latest intelligence */}
        <section className="panel">
          <div className="panel-head">
            <h3>Latest Intelligence</h3>
            <button className="link-btn" onClick={() => onNavigate?.("newstrends")}>View all →</button>
          </div>
          <div className="feed">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="feed-row skel"><div className="sk sk-line" /></div>)
            ) : articles.slice(0, 6).map((a) => (
              <button key={a.id} className="feed-row" onClick={() => onNavigate?.("newstrends")}>
                <span className="feed-dot" style={{ background: SENTIMENT_COLOR[a.sentiment ?? "Neutral"] ?? "var(--muted)" }} />
                <span className="feed-main">
                  <span className="feed-title">{a.title}</span>
                  <span className="feed-meta">{a.sourceName} · {timeAgo(a.publishedAt)}</span>
                </span>
              </button>
            ))}
            {!loading && articles.length === 0 && <p className="empty">No articles yet — hit Refresh.</p>}
          </div>
        </section>

        {/* Top trends */}
        <section className="panel">
          <div className="panel-head">
            <h3>Top Trends</h3>
            <button className="link-btn" onClick={() => onNavigate?.("newstrends")}>View all →</button>
          </div>
          <div className="trend-mini-list">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <div key={i} className="sk sk-line" style={{ margin: "0.6rem 0" }} />)
            ) : trends.slice(0, 6).map((t, i) => (
              <div key={t.id} className="trend-mini">
                <span className="trend-rank">{i + 1}</span>
                <span className="trend-mini-body">
                  <span className="trend-mini-name">{t.name}</span>
                  <span className="trend-bar-track"><span className="trend-bar-fill" style={{ width: `${t.trendScore}%` }} /></span>
                </span>
                <span className="trend-score">{t.trendScore}</span>
              </div>
            ))}
            {!loading && trends.length === 0 && <p className="empty">Trends generate from news (needs an AI key set).</p>}
          </div>
        </section>
      </div>

      {/* Trending innovations */}
      <section className="panel">
        <div className="panel-head">
          <h3>Trending Now</h3>
          <button className="link-btn" onClick={() => onNavigate?.("discover")}>Explore Discover →</button>
        </div>
        <div className="inno-grid">
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <div key={i} className="inno-chip sk" style={{ height: 64 }} />)
          ) : topInnovations.map((it) => (
            <a key={it.id} className="inno-chip" href={it.url} target="_blank" rel="noopener noreferrer">
              <span className="inno-type">{TYPE_LABELS[it.type] ?? it.type}</span>
              <span className="inno-name">{it.name}</span>
              {(it.starsToday || it.githubStars) ? (
                <span className="inno-stars">★ {it.starsToday ? `+${it.starsToday} today` : it.githubStars}</span>
              ) : null}
            </a>
          ))}
          {!loading && topInnovations.length === 0 && <p className="empty">No innovations yet — hit Refresh.</p>}
        </div>
      </section>

      {/* Latest report + quick actions */}
      <div className="dash-columns">
        <section className="panel">
          <div className="panel-head"><h3>Latest Report</h3>
            <button className="link-btn" onClick={() => onNavigate?.("reports")}>All reports →</button>
          </div>
          {latestReport ? (
            <button className="report-preview" onClick={() => onNavigate?.("reports")}>
              <span className="report-badge">{latestReport.title ?? "Report"}</span>
              <span className="report-snippet">{(latestReport.content ?? "").replace(/[#*>`]/g, "").slice(0, 220) || "Open to read the full report."}…</span>
              <span className="report-time">{timeAgo(latestReport.createdAt)}</span>
            </button>
          ) : (
            <p className="empty">No reports yet. They generate from news (needs an AI key).</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Quick Actions</h3></div>
          <div className="qa-grid">
            <button className="qa" onClick={() => onNavigate?.("analyze")}>
              <span className="qa-ic">🔍</span><span>Analyze a Website</span>
            </button>
            <button className="qa" onClick={() => onNavigate?.("search")}>
              <span className="qa-ic">🧭</span><span>Search Intelligence</span>
            </button>
            <button className="qa" onClick={() => onNavigate?.("discover")}>
              <span className="qa-ic">🚀</span><span>Discover Tools</span>
            </button>
            <button className="qa" onClick={() => onNavigate?.("reports")}>
              <span className="qa-ic">📊</span><span>Generate Report</span>
            </button>
          </div>
        </section>
      </div>

      <style>{`
        .dash { display: flex; flex-direction: column; gap: 1.25rem; }
        .dash-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
        .dash-title { font-size: 1.5rem; margin: 0 0 0.25rem; letter-spacing: -0.02em; }
        .dash-sub { color: var(--muted); font-size: 0.9rem; margin: 0; max-width: 60ch; }
        .dash-refresh { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.9rem; border: 1px solid var(--border); background: var(--surface); color: var(--text); border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: border-color .15s, background .15s; }
        .dash-refresh:hover:not(:disabled) { border-color: var(--primary); color: var(--primary); }
        .dash-refresh:disabled { opacity: .6; cursor: default; }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
        .stat-tile { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 1.1rem 1.2rem; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); cursor: pointer; text-align: left; transition: transform .12s var(--ease), box-shadow .15s var(--ease), border-color .15s; }
        .stat-tile:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: color-mix(in srgb, var(--primary) 40%, var(--border)); }
        .stat-icon { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; margin-bottom: 0.5rem; }
        .stat-value { font-size: 1.9rem; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; line-height: 1; }
        .stat-label { font-size: 0.9rem; font-weight: 650; }
        .stat-sub { font-size: 0.75rem; color: var(--muted); }

        .dash-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 780px) { .dash-columns { grid-template-columns: 1fr; } }

        .panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow-sm); padding: 1.1rem 1.25rem 1.25rem; }
        .panel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .panel-head h3 { font-size: 1rem; margin: 0; }
        .link-btn { border: none; background: none; color: var(--primary); font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 0; }
        .link-btn:hover { text-decoration: underline; }

        .feed { display: flex; flex-direction: column; }
        .feed-row { display: flex; align-items: flex-start; gap: 0.65rem; padding: 0.6rem 0; border: none; background: none; text-align: left; cursor: pointer; border-bottom: 1px solid var(--border); width: 100%; }
        .feed-row:last-child { border-bottom: none; }
        .feed-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 0.4rem; flex-shrink: 0; }
        .feed-main { display: flex; flex-direction: column; gap: 0.1rem; min-width: 0; }
        .feed-title { font-size: 0.875rem; font-weight: 550; color: var(--text); line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .feed-row:hover .feed-title { color: var(--primary); }
        .feed-meta { font-size: 0.72rem; color: var(--muted); }

        .trend-mini-list { display: flex; flex-direction: column; gap: 0.55rem; }
        .trend-mini { display: flex; align-items: center; gap: 0.6rem; }
        .trend-rank { width: 20px; height: 20px; border-radius: 6px; background: var(--surface-2); color: var(--muted); font-size: 0.7rem; font-weight: 700; display: grid; place-items: center; flex-shrink: 0; }
        .trend-mini-body { flex: 1; display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
        .trend-mini-name { font-size: 0.82rem; font-weight: 550; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .trend-bar-track { height: 5px; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
        .trend-bar-fill { height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--primary), var(--primary-dark)); }
        .trend-score { font-size: 0.78rem; font-weight: 700; color: var(--primary); font-variant-numeric: tabular-nums; width: 1.8rem; text-align: right; }

        .inno-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.7rem; }
        .inno-chip { display: flex; flex-direction: column; gap: 0.25rem; padding: 0.7rem 0.85rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); text-decoration: none; transition: border-color .15s, transform .12s var(--ease); }
        .inno-chip:hover { border-color: var(--primary); transform: translateY(-2px); text-decoration: none; }
        .inno-type { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--primary); }
        .inno-name { font-size: 0.85rem; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .inno-stars { font-size: 0.72rem; color: var(--warning); font-weight: 600; }

        .report-preview { display: flex; flex-direction: column; gap: 0.4rem; text-align: left; background: none; border: none; cursor: pointer; padding: 0; width: 100%; }
        .report-badge { align-self: flex-start; font-size: 0.72rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.2rem 0.6rem; border-radius: 999px; }
        .report-snippet { font-size: 0.83rem; color: var(--muted); line-height: 1.55; }
        .report-time { font-size: 0.72rem; color: var(--muted); }

        .qa-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
        .qa { display: flex; align-items: center; gap: 0.55rem; padding: 0.7rem 0.85rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-2); color: var(--text); font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: border-color .15s, transform .12s var(--ease); }
        .qa:hover { border-color: var(--primary); transform: translateY(-1px); }
        .qa-ic { font-size: 1rem; }

        .empty { font-size: 0.82rem; color: var(--muted); padding: 0.5rem 0; margin: 0; }
        .sk { background: linear-gradient(90deg, var(--surface-2) 25%, var(--surface-3) 50%, var(--surface-2) 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; border-radius: 6px; }
        .sk-line { height: 14px; width: 100%; }
        .feed-row.skel { border-bottom: 1px solid var(--border); }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      `}</style>
    </div>
  );
}
