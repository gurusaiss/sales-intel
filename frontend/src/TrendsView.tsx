import { useState, useEffect } from "react";
import { CardSkeleton } from "./components/Skeleton";
import { toast } from "./components/Toast";

interface Trend {
  id: string;
  name: string;
  category: string;
  description: string;
  trendScore: number;
  growthScore: number;
  adoptionScore: number;
}

interface Innovation {
  id: string;
  name: string;
  type: string;
  description: string;
  url: string;
  githubUrl?: string;
  githubStars?: number;
  starsToday?: number;
  language?: string;
  impactScore: number;
  tags: string[];
}

interface SparklineEntry { date: string; count: number; }

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

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="score-bar-row">
      <span className="score-label">{label}</span>
      <div className="score-track">
        <div className="score-fill" style={{ width: `${value}%` }} />
      </div>
      <span className="score-num">{Math.round(value)}</span>
    </div>
  );
}

function Sparkline({ entries }: { entries: SparklineEntry[] }) {
  if (!entries.length) return <div className="sparkline-empty">No data yet</div>;
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

export default function TrendsView() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [innovations, setInnovations] = useState<Innovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"trends" | "discover">("trends");
  const [sparklines, setSparklines] = useState<Record<string, SparklineEntry[]>>({});
  const [innovType, setInnovType] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/trends").then((d) => setTrends(d.trends ?? [])),
      apiFetch("/innovations").then((d) => setInnovations(d.innovations ?? [])),
    ])
      .catch(() => toast("Failed to load trends", "error"))
      .finally(() => setLoading(false));
  }, []);

  async function loadSparkline(name: string) {
    if (sparklines[name]) return;
    try {
      const d = await apiFetch(`/trends/${encodeURIComponent(name)}/sparkline`);
      setSparklines((prev) => ({ ...prev, [name]: d.sparkline ?? [] }));
    } catch { /* ignore */ }
  }

  const INNOVATION_TYPES = ["all", "ai_release", "oss", "startup", "dev_tool", "sdk", "api"];
  const filteredInnovations = innovations.filter((i) => {
    const matchType = innovType === "all" || i.type === innovType;
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>Trends & Discover</h2>
        <p className="intel-subtitle">AI-detected tech trends and GitHub's hottest projects</p>
      </div>

      <div className="tab-pills">
        <button className={`tab-pill ${tab === "trends" ? "active" : ""}`} onClick={() => setTab("trends")}>Tech Trends</button>
        <button className={`tab-pill ${tab === "discover" ? "active" : ""}`} onClick={() => setTab("discover")}>Discover</button>
      </div>

      {tab === "trends" && (
        <div className="card-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
            : trends.length === 0
              ? <div className="empty-state">Trends load automatically every 2 hours.</div>
              : trends.map((t) => (
                  <div key={t.id} className="trend-card" onMouseEnter={() => loadSparkline(t.name)}>
                    <div className="trend-header">
                      <span className="trend-name">{t.name}</span>
                      <span className="chip chip-sm">{t.category}</span>
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
      )}

      {tab === "discover" && (
        <>
          <div className="filter-bar">
            <input className="search-input" placeholder="Search innovations..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="chip-row">
              {INNOVATION_TYPES.map((t) => (
                <button key={t} className={`chip ${innovType === t ? "chip-active" : ""}`} onClick={() => setInnovType(t)}>
                  {t === "all" ? "All" : t.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="card-grid">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)
              : filteredInnovations.length === 0
                ? <div className="empty-state">No results. GitHub data syncs hourly.</div>
                : filteredInnovations.map((i) => (
                    <div key={i.id} className="innovation-card">
                      <div className="innovation-header">
                        <span className="innovation-name">{i.name}</span>
                        {i.language && <span className="chip chip-sm">{i.language}</span>}
                      </div>
                      <p className="innovation-desc">{i.description}</p>
                      <div className="innovation-stats">
                        {i.starsToday !== undefined && <span className="stat-badge">⭐ +{i.starsToday} today</span>}
                        {i.githubStars !== undefined && <span className="stat-badge">★ {i.githubStars.toLocaleString()}</span>}
                        <span className="chip chip-sm">{i.type.replace("_", " ")}</span>
                      </div>
                      <div className="innovation-links">
                        <a href={i.url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">View →</a>
                        {i.githubUrl && <a href={i.githubUrl} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">GitHub</a>}
                      </div>
                    </div>
                  ))}
          </div>
        </>
      )}
    </div>
  );
}
