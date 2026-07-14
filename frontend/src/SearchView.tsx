import { useState } from "react";
import { toast } from "./components/Toast";

interface SearchResult {
  type: "article" | "trend" | "innovation";
  id: string;
  title: string;
  description: string;
  url?: string;
  category?: string;
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

const TYPE_COLORS: Record<string, string> = { article: "#2563eb", trend: "#7c3aed", innovation: "#059669" };
const TYPE_LABELS: Record<string, string> = { article: "Article", trend: "Trend", innovation: "Innovation" };

export default function SearchView() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function doSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim() || q.trim().length < 2) return;
    setLoading(true);
    try {
      const d = await apiFetch(`/intel/search?q=${encodeURIComponent(q.trim())}`);
      setResults(d.results ?? []);
      setSearched(true);
    } catch { toast("Search failed", "error"); }
    finally { setLoading(false); }
  }

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>Search</h2>
        <p className="intel-subtitle">Search across all articles, trends, and innovations</p>
      </div>

      <form className="analyze-form" onSubmit={doSearch}>
        <input
          className="query-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search for a technology, company, or topic..."
        />
        <button type="submit" disabled={loading}>{loading ? "Searching…" : "Search"}</button>
      </form>

      {searched && results.length === 0 && !loading && (
        <div className="empty-state">No results for "{q}"</div>
      )}

      <div className="search-results">
        {results.map((r) => (
          <div key={`${r.type}-${r.id}`} className="search-result-card">
            <div className="search-result-header">
              <span className="type-badge" style={{ background: TYPE_COLORS[r.type] }}>{TYPE_LABELS[r.type]}</span>
              {r.category && <span className="chip chip-sm">{r.category}</span>}
            </div>
            <h3 className="search-result-title">{r.title}</h3>
            <p className="search-result-desc">{r.description}</p>
            {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">View →</a>}
          </div>
        ))}
      </div>
    </div>
  );
}
