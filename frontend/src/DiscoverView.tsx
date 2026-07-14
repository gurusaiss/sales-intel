import { useState, useEffect, useCallback } from "react";

interface Innovation {
  id: string;
  name: string;
  description: string;
  source: string;
  type: string;
  language?: string;
  starsToday?: number;
  totalStars?: number;
  impactScore?: number;
  githubUrl?: string;
  url: string;
  discoveredAt: string;
  bookmarked?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  "Product Hunt": "PH",
  "Show HN": "HN",
  "GitHub Trending": "GitHub",
  BetaList: "Beta",
  "Hacker News": "HN",
  GitHub: "GitHub",
};

const SOURCE_COLORS: Record<string, string> = {
  PH: "#da552f",
  HN: "#ff6600",
  GitHub: "#24292e",
  Beta: "#6c47ff",
};

const TYPE_FILTERS = [
  "All",
  "AI Tools",
  "Open Source",
  "Startups",
  "Dev Tools",
  "SDKs",
  "APIs",
  "Other",
];

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatNum(n?: number): string {
  if (n === undefined || n === null) return "0";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function CardSkeleton() {
  return (
    <div className="discover-card skeleton-card">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line short" />
      <div className="skeleton skeleton-chips" />
      <div className="skeleton skeleton-bar" />
      <div className="skeleton skeleton-actions" />
    </div>
  );
}

interface ToastMsg {
  id: number;
  text: string;
  type: "success" | "error";
}

function Toast({ toasts }: { toasts: ToastMsg[] }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 30;

export default function DiscoverView() {
  const [innovations, setInnovations] = useState<Innovation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [bookmarking, setBookmarking] = useState<Set<string>>(new Set());

  const addToast = useCallback((text: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const fetchInnovations = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      });
      if (typeFilter !== "All") params.set("type", typeFilter);
      if (search.trim()) params.set("q", search.trim());

      const res = await fetch(`/api/innovations?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setInnovations(data.items ?? data);
      setTotal(data.total ?? (data.items ?? data).length);
    } catch {
      addToast("Failed to load innovations", "error");
      setInnovations([]);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, search, addToast]);

  useEffect(() => {
    const timer = setTimeout(fetchInnovations, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [fetchInnovations, search]);

  useEffect(() => {
    setPage(0);
  }, [typeFilter, search]);

  const handleBookmark = async (item: Innovation) => {
    if (bookmarking.has(item.id)) return;
    setBookmarking((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch("/api/me/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "innovation",
          refId: item.id,
          title: item.name,
          url: item.url,
          meta: { source: item.source, type: item.type },
        }),
      });
      if (!res.ok) throw new Error();
      setInnovations((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, bookmarked: true } : i))
      );
      addToast(`Bookmarked "${item.name}"`);
    } catch {
      addToast("Failed to bookmark", "error");
    } finally {
      setBookmarking((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="discover-view">
      <Toast toasts={toasts} />

      <div className="discover-header">
        <div>
          <h1 className="discover-title">Discover</h1>
          <p className="discover-subtitle">
            Trending innovations from GitHub, Product Hunt, Show HN, and BetaList
          </p>
        </div>
      </div>

      <div className="discover-filters">
        <div className="discover-search-wrap">
          <span className="search-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            className="discover-search"
            placeholder="Search innovations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>
              &times;
            </button>
          )}
        </div>

        <div className="type-chips">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              className={`type-chip${typeFilter === f ? " active" : ""}`}
              onClick={() => setTypeFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="discover-grid">
          {Array.from({ length: 9 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : innovations.length === 0 ? (
        <div className="discover-empty">
          <div className="empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h3>No innovations found</h3>
          <p>Try a different search or filter. We aggregate from:</p>
          <div className="empty-sources">
            {["GitHub Trending", "Product Hunt", "Show HN", "BetaList"].map((s) => (
              <span key={s} className="empty-source-badge">
                {SOURCE_LABELS[s] ?? s}
                <span className="empty-source-label">{s}</span>
              </span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="discover-grid">
            {innovations.map((item) => {
              const sourceLabel = SOURCE_LABELS[item.source] ?? item.source;
              const sourceColor = SOURCE_COLORS[sourceLabel] ?? "#555";
              const impact = Math.min(100, Math.max(0, item.impactScore ?? 0));
              return (
                <div key={item.id} className="discover-card">
                  <div className="card-top-row">
                    <span
                      className="source-badge"
                      style={{ background: sourceColor }}
                      title={item.source}
                    >
                      {sourceLabel}
                    </span>
                    <div className="card-chips">
                      {item.type && (
                        <span className="type-tag">{item.type}</span>
                      )}
                      {item.language && (
                        <span className="lang-tag">{item.language}</span>
                      )}
                    </div>
                    <button
                      className={`bookmark-btn${item.bookmarked ? " bookmarked" : ""}`}
                      onClick={() => handleBookmark(item)}
                      disabled={bookmarking.has(item.id) || item.bookmarked}
                      title={item.bookmarked ? "Bookmarked" : "Bookmark"}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill={item.bookmarked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                      </svg>
                    </button>
                  </div>

                  <h3 className="card-name">{item.name}</h3>
                  <p className="card-desc">{item.description}</p>

                  <div className="card-stats">
                    {item.starsToday !== undefined && (
                      <span className="stat-badge stars-today" title="Stars today">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        +{formatNum(item.starsToday)}
                      </span>
                    )}
                    {item.totalStars !== undefined && (
                      <span className="stat-badge total-stars" title="Total stars">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        {formatNum(item.totalStars)}
                      </span>
                    )}
                    <span className="stat-time">{timeAgo(item.discoveredAt)}</span>
                  </div>

                  {item.impactScore !== undefined && (
                    <div className="impact-wrap">
                      <div className="impact-label">
                        <span>Impact</span>
                        <span>{item.impactScore}/100</span>
                      </div>
                      <div className="impact-bar-bg">
                        <div
                          className="impact-bar-fill"
                          style={{
                            width: `${impact}%`,
                            background:
                              impact >= 70
                                ? "#22c55e"
                                : impact >= 40
                                ? "#f59e0b"
                                : "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="card-actions">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-view"
                    >
                      View
                    </a>
                    {item.githubUrl && (
                      <a
                        href={item.githubUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-github"
                        title="Open on GitHub"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                        </svg>
                        GitHub
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="discover-pagination">
              <button
                className="page-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                &larr; Prev
              </button>
              <span className="page-info">
                Page {page + 1} of {totalPages}
              </span>
              <button
                className="page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next &rarr;
              </button>
            </div>
          )}
        </>
      )}

      <style>{`
        .discover-view {
          padding: 24px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: inherit;
        }
        .discover-header {
          margin-bottom: 24px;
        }
        .discover-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 4px;
          color: var(--color-text, #111);
        }
        .discover-subtitle {
          font-size: 0.9rem;
          color: var(--color-text-muted, #666);
          margin: 0;
        }
        .discover-filters {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        .discover-search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          max-width: 400px;
        }
        .search-icon {
          position: absolute;
          left: 10px;
          color: var(--color-text-muted, #888);
          display: flex;
          align-items: center;
        }
        .discover-search {
          width: 100%;
          padding: 8px 32px 8px 34px;
          border: 1px solid var(--color-border, #ddd);
          border-radius: 8px;
          font-size: 0.9rem;
          background: var(--color-surface, #fff);
          color: var(--color-text, #111);
          outline: none;
          transition: border-color 0.15s;
        }
        .discover-search:focus {
          border-color: var(--color-primary, #6c47ff);
        }
        .search-clear {
          position: absolute;
          right: 8px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          color: var(--color-text-muted, #888);
          padding: 0;
          line-height: 1;
        }
        .type-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .type-chip {
          padding: 5px 14px;
          border-radius: 20px;
          border: 1px solid var(--color-border, #ddd);
          background: var(--color-surface, #fff);
          color: var(--color-text, #333);
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.15s;
          font-weight: 500;
        }
        .type-chip:hover {
          border-color: var(--color-primary, #6c47ff);
          color: var(--color-primary, #6c47ff);
        }
        .type-chip.active {
          background: var(--color-primary, #6c47ff);
          border-color: var(--color-primary, #6c47ff);
          color: #fff;
        }
        .discover-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 18px;
        }
        .discover-card {
          background: var(--color-surface, #fff);
          border: 1px solid var(--color-border, #e5e7eb);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          transition: box-shadow 0.15s;
        }
        .discover-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
        }
        .card-top-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .source-badge {
          font-size: 0.72rem;
          font-weight: 700;
          color: #fff;
          padding: 2px 7px;
          border-radius: 4px;
          letter-spacing: 0.03em;
          flex-shrink: 0;
        }
        .card-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          flex: 1;
        }
        .type-tag {
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--color-primary-light, #ede9fe);
          color: var(--color-primary, #6c47ff);
          font-weight: 500;
        }
        .lang-tag {
          font-size: 0.72rem;
          padding: 2px 8px;
          border-radius: 10px;
          background: var(--color-surface-2, #f3f4f6);
          color: var(--color-text-muted, #555);
          font-weight: 500;
        }
        .bookmark-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: var(--color-text-muted, #888);
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: color 0.15s, background 0.15s;
          margin-left: auto;
        }
        .bookmark-btn:hover:not(:disabled) {
          color: var(--color-primary, #6c47ff);
          background: var(--color-primary-light, #ede9fe);
        }
        .bookmark-btn.bookmarked {
          color: var(--color-primary, #6c47ff);
        }
        .bookmark-btn:disabled {
          opacity: 0.5;
          cursor: default;
        }
        .card-name {
          font-size: 1rem;
          font-weight: 600;
          margin: 0;
          color: var(--color-text, #111);
          line-height: 1.3;
        }
        .card-desc {
          font-size: 0.85rem;
          color: var(--color-text-muted, #555);
          margin: 0;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .card-stats {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .stat-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 8px;
        }
        .stars-today {
          background: #fef3c7;
          color: #92400e;
        }
        .total-stars {
          background: var(--color-surface-2, #f3f4f6);
          color: var(--color-text-muted, #555);
        }
        .stat-time {
          font-size: 0.78rem;
          color: var(--color-text-muted, #888);
          margin-left: auto;
        }
        .impact-wrap {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .impact-label {
          display: flex;
          justify-content: space-between;
          font-size: 0.75rem;
          color: var(--color-text-muted, #888);
        }
        .impact-bar-bg {
          height: 5px;
          background: var(--color-surface-2, #e5e7eb);
          border-radius: 3px;
          overflow: hidden;
        }
        .impact-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.4s ease;
        }
        .card-actions {
          display: flex;
          gap: 8px;
          margin-top: 2px;
        }
        .btn-view {
          padding: 6px 14px;
          background: var(--color-primary, #6c47ff);
          color: #fff;
          border: none;
          border-radius: 7px;
          font-size: 0.83rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s;
          display: inline-flex;
          align-items: center;
        }
        .btn-view:hover {
          background: var(--color-primary-dark, #5535d4);
        }
        .btn-github {
          padding: 6px 12px;
          background: var(--color-surface-2, #f3f4f6);
          color: var(--color-text, #333);
          border: 1px solid var(--color-border, #ddd);
          border-radius: 7px;
          font-size: 0.83rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          transition: background 0.15s;
        }
        .btn-github:hover {
          background: var(--color-surface-3, #e5e7eb);
        }
        /* Skeleton */
        .skeleton-card {
          gap: 12px;
        }
        .skeleton {
          background: linear-gradient(90deg, var(--color-surface-2, #f3f4f6) 25%, var(--color-surface-3, #e9eaf0) 50%, var(--color-surface-2, #f3f4f6) 75%);
          background-size: 200% 100%;
          animation: shimmer 1.4s infinite;
          border-radius: 6px;
        }
        .skeleton-title { height: 20px; width: 60%; }
        .skeleton-line { height: 13px; width: 100%; }
        .skeleton-line.short { width: 75%; }
        .skeleton-chips { height: 20px; width: 45%; }
        .skeleton-bar { height: 8px; width: 100%; }
        .skeleton-actions { height: 32px; width: 50%; }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        /* Empty state */
        .discover-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 24px;
          text-align: center;
          color: var(--color-text-muted, #666);
        }
        .empty-icon {
          color: var(--color-border, #ccc);
          margin-bottom: 16px;
        }
        .discover-empty h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-text, #333);
          margin: 0 0 8px;
        }
        .discover-empty p {
          margin: 0 0 16px;
          font-size: 0.9rem;
        }
        .empty-sources {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .empty-source-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border: 1px solid var(--color-border, #ddd);
          border-radius: 20px;
          font-size: 0.82rem;
          font-weight: 600;
        }
        .empty-source-label {
          font-weight: 400;
          color: var(--color-text-muted, #888);
        }
        /* Pagination */
        .discover-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 32px;
        }
        .page-btn {
          padding: 7px 18px;
          border: 1px solid var(--color-border, #ddd);
          border-radius: 8px;
          background: var(--color-surface, #fff);
          color: var(--color-text, #333);
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }
        .page-btn:hover:not(:disabled) {
          border-color: var(--color-primary, #6c47ff);
          color: var(--color-primary, #6c47ff);
        }
        .page-btn:disabled {
          opacity: 0.4;
          cursor: default;
        }
        .page-info {
          font-size: 0.88rem;
          color: var(--color-text-muted, #666);
        }
        /* Toast */
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          z-index: 9999;
        }
        .toast {
          padding: 10px 18px;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #fff;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          animation: slideIn 0.2s ease;
        }
        .toast-success { background: #22c55e; }
        .toast-error { background: #ef4444; }
        @keyframes slideIn {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @media (max-width: 600px) {
          .discover-view { padding: 16px; }
          .discover-grid { grid-template-columns: 1fr; }
          .type-chips { gap: 6px; }
          .type-chip { font-size: 0.78rem; padding: 4px 11px; }
        }
        @media (prefers-color-scheme: dark) {
          .discover-title { color: #f1f5f9; }
          .discover-subtitle { color: #94a3b8; }
          .discover-search {
            background: #1e293b;
            border-color: #334155;
            color: #f1f5f9;
          }
          .type-chip {
            background: #1e293b;
            border-color: #334155;
            color: #cbd5e1;
          }
          .discover-card {
            background: #1e293b;
            border-color: #334155;
          }
          .card-name { color: #f1f5f9; }
          .card-desc { color: #94a3b8; }
          .lang-tag { background: #334155; color: #94a3b8; }
          .total-stars { background: #334155; color: #94a3b8; }
          .impact-bar-bg { background: #334155; }
          .btn-github { background: #334155; border-color: #475569; color: #e2e8f0; }
          .btn-github:hover { background: #475569; }
          .discover-empty h3 { color: #e2e8f0; }
          .discover-empty { color: #94a3b8; }
          .page-btn { background: #1e293b; border-color: #334155; color: #cbd5e1; }
          .skeleton { background: linear-gradient(90deg, #1e293b 25%, #273549 50%, #1e293b 75%); background-size: 200% 100%; }
        }
      `}</style>
    </div>
  );
}
