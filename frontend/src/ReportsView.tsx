import { useState, useEffect } from "react";
import { CardSkeleton } from "./components/Skeleton";
import { toast } from "./components/Toast";

interface Report {
  id: string;
  reportType: string;
  title: string;
  content: string;
  periodStart: string;
  periodEnd: string;
  articleCount: number;
  generatedAt: string;
}

const REPORT_TYPES = ["daily", "weekly", "monthly", "founder", "developer", "investor", "ai", "sales_digest"];

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

function renderMarkdown(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])/gm, '')
    .trim();
}

export default function ReportsView() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState("daily");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch(`/reports?type=${activeType}`)
      .then((d) => setReports(d.reports ?? []))
      .catch(() => toast("Failed to load reports", "error"))
      .finally(() => setLoading(false));
  }, [activeType]);

  async function generateReport() {
    setGenerating(true);
    try {
      await apiFetch(`/reports/generate/${activeType}`, { method: "POST" });
      toast("Report generation started — refresh in ~30 seconds", "info");
    } catch { toast("Failed to trigger report generation", "error"); }
    finally { setGenerating(false); }
  }

  const latest = reports[0];

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>AI Reports</h2>
        <p className="intel-subtitle">Auto-generated intelligence reports — daily, weekly, role-specific</p>
      </div>

      <div className="chip-row">
        {REPORT_TYPES.map((t) => (
          <button key={t} className={`chip ${activeType === t ? "chip-active" : ""}`} onClick={() => setActiveType(t)}>
            {t.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="reports-toolbar">
        <button className="btn-outline" onClick={generateReport} disabled={generating}>
          {generating ? "Generating…" : "Generate now"}
        </button>
        <span className="muted-text">{reports.length} report{reports.length !== 1 ? "s" : ""} for {activeType.replace("_", " ")}</span>
      </div>

      {loading
        ? <CardSkeleton />
        : !latest
          ? <div className="empty-state">No {activeType} report yet. Click "Generate now" or wait for the scheduled run.</div>
          : (
            <div className="report-container">
              <div className="report-meta">
                <span className="report-title">{latest.title}</span>
                <span className="muted-text">{latest.articleCount} articles · {new Date(latest.generatedAt).toLocaleDateString()}</span>
              </div>
              <div
                className="report-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(latest.content) }}
              />
            </div>
          )}

      {reports.length > 1 && (
        <div className="report-history">
          <span className="card-label">Previous reports</span>
          {reports.slice(1).map((r) => (
            <div key={r.id} className="report-history-item">
              <span>{new Date(r.generatedAt).toLocaleDateString()}</span>
              <span className="muted-text">{r.articleCount} articles</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
