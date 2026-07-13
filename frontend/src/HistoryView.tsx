import { useState, useEffect, useMemo } from "react";
import { fetchAllPersons, fetchAuditLog, type AuditEntry } from "./api";
import type { CrmPerson } from "./types";

type DateRange = "today" | "yesterday" | "7days" | "30days" | "all";
type SortKey = "recent" | "name" | "priority";

const RANGE_LABELS: Record<DateRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7days": "Last 7 days",
  "30days": "Last 30 days",
  all: "All time",
};

function isInRange(dateStr: string, range: DateRange): boolean {
  if (range === "all") return true;

  const date = new Date(dateStr);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (range === "today") return date >= startOfToday;

  if (range === "yesterday") {
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);
    return date >= startOfYesterday && date < startOfToday;
  }

  const daysAgo = range === "7days" ? 7 : 30;
  const cutoff = new Date(startOfToday);
  cutoff.setDate(cutoff.getDate() - daysAgo);
  return date >= cutoff;
}

export default function HistoryView() {
  const [persons, setPersons] = useState<CrmPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DateRange>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    fetchAllPersons()
      .then(setPersons)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleAudit() {
    if (!showAudit && auditLog.length === 0) {
      fetchAuditLog()
        .then(setAuditLog)
        .catch(() => {});
    }
    setShowAudit((current) => !current);
  }

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    return persons
      .filter((p) => isInRange(p.createdAt, range))
      .filter(
        (p) =>
          !searchLower ||
          `${p.name} ${p.company ?? ""} ${p.role ?? ""}`.toLowerCase().includes(searchLower)
      )
      .sort((a, b) => {
        if (sortKey === "name") return a.name.localeCompare(b.name);
        if (sortKey === "priority") return b.priority - a.priority;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [persons, range, search, sortKey]);

  if (loading) return <p className="empty-state">Loading history…</p>;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="result">
      <div className="tab-row" aria-label="Date range">
        {(Object.keys(RANGE_LABELS) as DateRange[]).map((r) => (
          <button
            key={r}
            className={`tab-button ${range === r ? "active" : ""}`}
            onClick={() => setRange(r)}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="search-form" style={{ marginTop: "0.75rem" }}>
        <input
          type="text"
          className="query-input"
          placeholder="Search by name, company, or role…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search history"
        />
        <select
          className="domain-input"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort by"
        >
          <option value="recent">Sort: Most recent</option>
          <option value="name">Sort: Name</option>
          <option value="priority">Sort: Priority</option>
        </select>
      </div>

      <p className="queue-meta" style={{ marginTop: "0.5rem" }}>
        {filtered.length} of {persons.length} total captured contacts.{" "}
        <button className="ghost-button" style={{ marginLeft: "0.5rem" }} onClick={handleToggleAudit}>
          {showAudit ? "Hide audit log" : "Show audit log"}
        </button>
      </p>

      {showAudit && (
        <div className="card" style={{ marginBottom: "0.75rem" }}>
          <span className="card-label">Audit log (last {auditLog.length} actions)</span>
          {auditLog.length === 0 ? (
            <p className="subline">No recorded actions yet.</p>
          ) : (
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem", fontSize: "0.82rem" }}>
              {auditLog.map((entry, i) => (
                <li key={i}>
                  <span className="badge badge-medium">{entry.action}</span> {entry.detail} —{" "}
                  {new Date(entry.at).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty-state">No contacts match this range/search.</p>
      ) : (
        <div className="lead-table">
          <div className="lead-row lead-header">
            <span />
            <span>Name</span>
            <span>Company</span>
            <span>Status</span>
            <span>Captured</span>
          </div>
          {filtered.map((p) => (
            <div className="lead-row" key={p.id}>
              <span />
              <span>{p.name}</span>
              <span>{p.company ?? "—"}</span>
              <span className="badge badge-medium">{p.status.replace("_", " ")}</span>
              <span>{new Date(p.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
