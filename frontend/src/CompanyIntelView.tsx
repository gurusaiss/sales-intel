import { useState, useEffect, useRef } from "react";
import { toast } from "./components/Toast";

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

interface CIQReport {
  overview?: string;
  founders?: string;
  originStory?: string;
  challenges?: string;
  productsProjects?: string;
  roadmap?: string;
  competitive?: string;
  struggles?: string;
  interviewQuestions?: string[];
  culture?: string;
  redFlags?: string;
  applicationStrategy?: string;
  candidateFit?: string;
  raw?: string;
}

interface CIQJob {
  id: string;
  companyName: string;
  status: "pending" | "researching" | "analyzing" | "done" | "failed";
  report?: CIQReport;
  errorMessage?: string;
  createdAt: string;
}

type ActiveTool = "intel" | "jdfit" | "compare" | "salary" | "coverletter";

const SECTIONS: { key: keyof CIQReport; label: string; emoji: string }[] = [
  { key: "overview", label: "Company Overview", emoji: "🏢" },
  { key: "founders", label: "Founders & Leadership", emoji: "👥" },
  { key: "originStory", label: "Origin Story & Growth", emoji: "📖" },
  { key: "challenges", label: "Past Challenges", emoji: "⚡" },
  { key: "productsProjects", label: "Products & Projects", emoji: "🚀" },
  { key: "roadmap", label: "Future Roadmap", emoji: "🗺️" },
  { key: "competitive", label: "Competitive Landscape", emoji: "⚔️" },
  { key: "struggles", label: "Current Struggles", emoji: "🔴" },
  { key: "culture", label: "Culture & Work Life", emoji: "🌱" },
  { key: "redFlags", label: "Red Flags & Due Diligence", emoji: "🚩" },
  { key: "applicationStrategy", label: "Application Strategy", emoji: "🎯" },
  { key: "candidateFit", label: "Candidate Fit Analysis", emoji: "✅" },
];

export default function CompanyIntelView() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("intel");
  const [resumeText, setResumeText] = useState(() => localStorage.getItem("ciq_resume") ?? "");
  const [history, setHistory] = useState<CIQJob[]>([]);
  const [activeJob, setActiveJob] = useState<CIQJob | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("overview");
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tool states
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // JD Fit
  const [jdText, setJdText] = useState("");
  const [jdCompany, setJdCompany] = useState("");
  const [jdResult, setJdResult] = useState<Record<string, unknown> | null>(null);

  // Compare
  const [cmp1, setCmp1] = useState("");
  const [cmp2, setCmp2] = useState("");
  const [cmpResult, setCmpResult] = useState<Record<string, unknown> | null>(null);

  // Salary
  const [salRole, setSalRole] = useState("");
  const [salCompany, setSalCompany] = useState("");
  const [salLocation, setSalLocation] = useState("");
  const [salResult, setSalResult] = useState<Record<string, unknown> | null>(null);

  // Cover Letter
  const [clCompany, setClCompany] = useState("");
  const [clRole, setClRole] = useState("");
  const [clJd, setClJd] = useState("");
  const [clResult, setClResult] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    localStorage.setItem("ciq_resume", resumeText);
  }, [resumeText]);

  async function loadHistory() {
    try {
      const data = await apiFetch("/ciq/reports") as CIQJob[];
      setHistory(data);
    } catch { /* silent */ }
  }

  function startPolling(jobId: string) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiFetch(`/ciq/reports/${jobId}/status`) as { status: string; errorMessage?: string };
        if (status.status === "done") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          const job = await apiFetch(`/ciq/reports/${jobId}`) as CIQJob;
          setActiveJob(job);
          setExpandedSection("overview");
          setFlashcardIdx(0);
          setFlashFlipped(false);
          loadHistory();
          toast("Report ready!", "success");
        } else if (status.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setActiveJob((prev) => prev ? { ...prev, status: "failed", errorMessage: status.errorMessage } : null);
          toast(status.errorMessage ?? "Report generation failed", "error");
        } else {
          setActiveJob((prev) => prev ? { ...prev, status: status.status as CIQJob["status"] } : null);
        }
      } catch { /* continue polling */ }
    }, 3000);
  }

  async function handleStartReport() {
    if (!companyName.trim() || !resumeText.trim()) {
      toast("Enter company name and paste your resume first", "error");
      return;
    }
    setSubmitting(true);
    try {
      const { jobId } = await apiFetch("/ciq/reports", {
        method: "POST",
        body: JSON.stringify({ companyName: companyName.trim(), resumeText }),
      }) as { jobId: string };
      const newJob: CIQJob = { id: jobId, companyName: companyName.trim(), status: "researching", createdAt: new Date().toISOString() };
      setActiveJob(newJob);
      setHistory((prev) => [newJob, ...prev]);
      toast("Research started — takes ~30 seconds…", "success");
      startPolling(jobId);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to start", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadHistoryJob(job: CIQJob) {
    if (job.status !== "done") return;
    const full = await apiFetch(`/ciq/reports/${job.id}`) as CIQJob;
    setActiveJob(full);
    setExpandedSection("overview");
    setActiveTool("intel");
  }

  async function deleteJob(id: string) {
    await apiFetch(`/ciq/reports/${id}`, { method: "DELETE" });
    setHistory((prev) => prev.filter((j) => j.id !== id));
    if (activeJob?.id === id) setActiveJob(null);
    toast("Deleted", "success");
  }

  async function handleJdFit() {
    if (!resumeText.trim() || !jdText.trim()) { toast("Resume and JD required", "error"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/ciq/jd-fit", { method: "POST", body: JSON.stringify({ resumeText, jobDescription: jdText, companyName: jdCompany }) });
      setJdResult(r as Record<string, unknown>);
    } catch { toast("Analysis failed", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleCompare() {
    if (!cmp1.trim() || !cmp2.trim() || !resumeText.trim()) { toast("Two company names and resume required", "error"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/ciq/compare", { method: "POST", body: JSON.stringify({ company1: cmp1, company2: cmp2, resumeText }) });
      setCmpResult(r as Record<string, unknown>);
    } catch { toast("Comparison failed", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleSalary() {
    if (!salRole.trim() || !salCompany.trim() || !resumeText.trim()) { toast("Role, company and resume required", "error"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/ciq/salary", { method: "POST", body: JSON.stringify({ role: salRole, companyName: salCompany, resumeText, location: salLocation }) });
      setSalResult(r as Record<string, unknown>);
    } catch { toast("Salary lookup failed", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleCoverLetter() {
    if (!clCompany.trim() || !clRole.trim() || !resumeText.trim()) { toast("Company, role and resume required", "error"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/ciq/cover-letter", { method: "POST", body: JSON.stringify({ companyName: clCompany, role: clRole, resumeText, jobDescription: clJd }) }) as { letter: string };
      setClResult(r.letter);
    } catch { toast("Cover letter failed", "error"); }
    finally { setSubmitting(false); }
  }

  const statusLabel: Record<string, string> = {
    pending: "Queued…",
    researching: "Searching the web…",
    analyzing: "AI analyzing…",
    done: "Complete",
    failed: "Failed",
  };

  const questions = activeJob?.report?.interviewQuestions ?? [];

  return (
    <div className="result">
      <style>{`
        .ciq-tabs { display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1.5rem; }
        .ciq-tab { padding:0.45rem 1rem; border-radius:999px; border:1.5px solid var(--border); background:transparent; color:var(--muted); font-size:0.82rem; font-weight:500; cursor:pointer; transition:all 0.15s; }
        .ciq-tab.active { border-color:var(--primary); background:var(--primary); color:#fff; }
        .ciq-tab:hover:not(.active) { border-color:var(--primary); color:var(--primary); }
        .ciq-resume { width:100%; min-height:120px; resize:vertical; font-family:inherit; font-size:0.88rem; padding:0.75rem; border:1.5px solid var(--border); border-radius:var(--radius); background:var(--surface); color:var(--text); }
        .ciq-resume:focus { outline:none; border-color:var(--primary); }
        .ciq-section { border:1.5px solid var(--border); border-radius:var(--radius); margin-bottom:0.6rem; overflow:hidden; }
        .ciq-section-header { padding:0.75rem 1rem; cursor:pointer; display:flex; align-items:center; justify-content:space-between; background:var(--surface); font-weight:600; font-size:0.9rem; }
        .ciq-section-header:hover { background:var(--surface-2); }
        .ciq-section-body { padding:1rem; font-size:0.88rem; line-height:1.7; color:var(--text); background:var(--bg); white-space:pre-wrap; }
        .ciq-questions { list-style:none; padding:0; margin:0; }
        .ciq-questions li { padding:0.6rem 1rem; border-bottom:1px solid var(--border); font-size:0.88rem; }
        .ciq-questions li:last-child { border-bottom:none; }
        .status-bar { display:flex; align-items:center; gap:0.75rem; padding:0.75rem 1rem; background:var(--surface); border:1.5px solid var(--border); border-radius:var(--radius); margin-bottom:1rem; }
        .status-dot { width:8px; height:8px; border-radius:50%; background:var(--primary); animation:pulse 1.2s infinite; }
        .status-dot.done { background:#22c55e; animation:none; }
        .status-dot.failed { background:#ef4444; animation:none; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .history-list { display:flex; flex-direction:column; gap:0.4rem; }
        .history-item { display:flex; align-items:center; justify-content:space-between; padding:0.6rem 0.9rem; background:var(--surface); border:1.5px solid var(--border); border-radius:var(--radius); cursor:pointer; }
        .history-item:hover { border-color:var(--primary); }
        .flashcard-wrap { perspective:1000px; cursor:pointer; user-select:none; }
        .flashcard { width:100%; min-height:160px; position:relative; transition:transform 0.5s; transform-style:preserve-3d; }
        .flashcard.flipped { transform:rotateY(180deg); }
        .card-face { position:absolute; inset:0; backface-visibility:hidden; display:flex; align-items:center; justify-content:center; padding:1.5rem; border-radius:var(--radius); border:2px solid var(--primary); font-size:0.95rem; text-align:center; }
        .card-front { background:var(--surface); color:var(--text); }
        .card-back { background:var(--primary); color:#fff; transform:rotateY(180deg); }
        .score-row { display:flex; align-items:center; gap:0.75rem; margin:0.4rem 0; }
        .score-bar { flex:1; height:8px; background:var(--border); border-radius:999px; overflow:hidden; }
        .score-fill-bar { height:100%; background:var(--primary); border-radius:999px; transition:width 0.5s; }
        .chip-grid { display:flex; flex-wrap:wrap; gap:0.4rem; }
        .chip-tag { padding:0.25rem 0.6rem; background:var(--surface-2); border-radius:999px; font-size:0.78rem; color:var(--text); }
        .chip-tag.missing { background:#fee2e2; color:#991b1b; }
        .chip-tag.matched { background:#dcfce7; color:#166534; }
        [data-theme="dark"] .chip-tag.missing { background:#450a0a; color:#fca5a5; }
        [data-theme="dark"] .chip-tag.matched { background:#052e16; color:#86efac; }
        .cmp-cols { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
        @media(max-width:640px){ .cmp-cols { grid-template-columns:1fr; } }
        .verdict-box { padding:1rem; background:var(--primary); color:#fff; border-radius:var(--radius); font-size:0.92rem; line-height:1.6; margin-top:0.75rem; }
      `}</style>

      {/* Resume (always visible at top) */}
      <section className="card">
        <h2>Your Resume</h2>
        <p className="subline">Stored locally — used by all CompanyIQ tools.</p>
        <textarea
          className="ciq-resume"
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume text here…"
          rows={5}
        />
      </section>

      {/* Tool tabs */}
      <div className="ciq-tabs">
        {([
          ["intel", "🏢 Company Intel"],
          ["jdfit", "📋 JD Fit Score"],
          ["compare", "⚖️ Compare Companies"],
          ["salary", "💰 Salary Intel"],
          ["coverletter", "✉️ Cover Letter"],
        ] as [ActiveTool, string][]).map(([id, label]) => (
          <button key={id} className={`ciq-tab ${activeTool === id ? "active" : ""}`} onClick={() => setActiveTool(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Company Intel ─────────────────────────────────────── */}
      {activeTool === "intel" && (
        <>
          <section className="card">
            <h2>Company Intelligence Report</h2>
            <p className="subline">AI researches the company live and generates a 13-section deep-dive.</p>
            <div className="search-form" style={{ marginTop: "0.75rem" }}>
              <input
                type="text" className="query-input"
                placeholder="Company name — e.g. Stripe, Zepto, Notion"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartReport()}
              />
              <button disabled={submitting} onClick={handleStartReport}>
                {submitting ? "Starting…" : "Research"}
              </button>
            </div>
          </section>

          {/* Status bar */}
          {activeJob && activeJob.status !== "done" && (
            <div className="status-bar">
              <div className={`status-dot ${activeJob.status}`} />
              <span>{statusLabel[activeJob.status] ?? activeJob.status}</span>
              <span className="muted" style={{ marginLeft: "auto", fontSize: "0.8rem" }}>{activeJob.companyName}</span>
            </div>
          )}

          {/* Report */}
          {activeJob?.status === "done" && activeJob.report && (
            <section className="card">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <h2 style={{ margin: 0 }}>{activeJob.companyName}</h2>
                <span className="badge badge-medium">Report ready</span>
              </div>

              {activeJob.report.raw ? (
                <pre style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem" }}>{activeJob.report.raw}</pre>
              ) : (
                <>
                  {SECTIONS.map(({ key, label, emoji }) => {
                    const val = activeJob.report![key];
                    if (!val) return null;
                    const isOpen = expandedSection === key;
                    return (
                      <div key={key} className="ciq-section">
                        <div className="ciq-section-header" onClick={() => setExpandedSection(isOpen ? null : key)}>
                          <span>{emoji} {label}</span>
                          <span>{isOpen ? "▲" : "▼"}</span>
                        </div>
                        {isOpen && (
                          <div className="ciq-section-body">
                            {typeof val === "string" ? val : JSON.stringify(val, null, 2)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Interview Questions as Flashcards */}
                  {questions.length > 0 && (
                    <div className="ciq-section" style={{ marginTop: "0.5rem" }}>
                      <div className="ciq-section-header" onClick={() => setExpandedSection(expandedSection === "flash" ? null : "flash")}>
                        <span>🎴 Interview Flashcards ({questions.length})</span>
                        <span>{expandedSection === "flash" ? "▲" : "▼"}</span>
                      </div>
                      {expandedSection === "flash" && (
                        <div style={{ padding: "1rem" }}>
                          <div className="flashcard-wrap" style={{ minHeight: "180px" }} onClick={() => setFlashFlipped((f) => !f)}>
                            <div className={`flashcard ${flashFlipped ? "flipped" : ""}`} style={{ minHeight: "160px" }}>
                              <div className="card-face card-front">
                                <p>{questions[flashcardIdx]}</p>
                              </div>
                              <div className="card-face card-back">
                                <p>Tap to flip back · Question {flashcardIdx + 1} of {questions.length}</p>
                              </div>
                            </div>
                          </div>
                          <p style={{ textAlign: "center", fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.5rem" }}>Tap card to flip</p>
                          <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", marginTop: "0.5rem" }}>
                            <button className="ghost-button" onClick={() => { setFlashcardIdx((i) => (i - 1 + questions.length) % questions.length); setFlashFlipped(false); }}>← Prev</button>
                            <span style={{ alignSelf: "center", fontSize: "0.85rem", color: "var(--muted)" }}>{flashcardIdx + 1} / {questions.length}</span>
                            <button className="ghost-button" onClick={() => { setFlashcardIdx((i) => (i + 1) % questions.length); setFlashFlipped(false); }}>Next →</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {/* History */}
          {history.length > 0 && (
            <section className="card">
              <h2>Report History</h2>
              <div className="history-list">
                {history.map((j) => (
                  <div key={j.id} className="history-item" onClick={() => loadHistoryJob(j)}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{j.companyName}</div>
                      <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>{new Date(j.createdAt).toLocaleDateString()} · {j.status}</div>
                    </div>
                    <button className="ghost-button danger" style={{ fontSize: "0.78rem" }}
                      onClick={(e) => { e.stopPropagation(); deleteJob(j.id); }}>
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── JD Fit ───────────────────────────────────────────── */}
      {activeTool === "jdfit" && (
        <section className="card">
          <h2>JD Fit Analyser</h2>
          <p className="subline">Paste a job description to get fit score, ATS score, skill gaps and tailored advice.</p>
          <input type="text" className="query-input" style={{ width: "100%", marginBottom: "0.5rem" }}
            placeholder="Company name (optional)" value={jdCompany} onChange={(e) => setJdCompany(e.target.value)} />
          <textarea className="ciq-resume" rows={6} value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste job description here…" />
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleJdFit}>
            {submitting ? "Analyzing…" : "Analyze Fit"}
          </button>

          {jdResult && (
            <div style={{ marginTop: "1.25rem" }}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <div className="card" style={{ flex: 1, minWidth: "140px", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>{String(jdResult.fitScore)}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Fit Score</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: "140px", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", fontWeight: 700, color: "var(--primary)" }}>{String(jdResult.atsScore)}</div>
                  <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>ATS Score</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: "140px", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{String(jdResult.verdict)}</div>
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div className="field-label">Matched Skills</div>
                <div className="chip-grid" style={{ marginTop: "0.35rem" }}>
                  {(jdResult.matchedSkills as string[] ?? []).map((s) => <span key={s} className="chip-tag matched">{s}</span>)}
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div className="field-label">Missing Skills</div>
                <div className="chip-grid" style={{ marginTop: "0.35rem" }}>
                  {(jdResult.missingSkills as string[] ?? []).map((s) => <span key={s} className="chip-tag missing">{s}</span>)}
                </div>
              </div>
              <div style={{ marginBottom: "0.75rem" }}>
                <div className="field-label">Keyword Gaps (add to resume)</div>
                <div className="chip-grid" style={{ marginTop: "0.35rem" }}>
                  {(jdResult.keywordGaps as string[] ?? []).map((s) => <span key={s} className="chip-tag">{s}</span>)}
                </div>
              </div>
              {!!jdResult.tailoredPitch && <div className="card highlight" style={{ marginTop: "0.5rem" }}><span className="card-label">Tailored Pitch</span><p>{String(jdResult.tailoredPitch)}</p></div>}
              {!!jdResult.resumeAdvice && <div className="card" style={{ marginTop: "0.5rem" }}><span className="card-label">Resume Advice</span><p>{String(jdResult.resumeAdvice)}</p></div>}
              {(jdResult.interviewFocus as string[] ?? []).length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <div className="field-label">Interview Focus Areas</div>
                  <ul style={{ paddingLeft: "1.25rem", marginTop: "0.35rem" }}>
                    {(jdResult.interviewFocus as string[]).map((f) => <li key={f} style={{ fontSize: "0.88rem", marginBottom: "0.25rem" }}>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Compare ──────────────────────────────────────────── */}
      {activeTool === "compare" && (
        <section className="card">
          <h2>Compare Companies</h2>
          <p className="subline">Head-to-head comparison of two companies for your profile.</p>
          <div className="cmp-cols">
            <input type="text" className="query-input" placeholder="Company 1 — e.g. Google" value={cmp1} onChange={(e) => setCmp1(e.target.value)} />
            <input type="text" className="query-input" placeholder="Company 2 — e.g. Stripe" value={cmp2} onChange={(e) => setCmp2(e.target.value)} />
          </div>
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleCompare}>
            {submitting ? "Comparing…" : "Compare"}
          </button>

          {cmpResult && (
            <div style={{ marginTop: "1.25rem" }}>
              <div className="cmp-cols">
                {[1, 2].map((n) => {
                  const name = n === 1 ? cmp1 : cmp2;
                  const score = n === 1 ? cmpResult.company1Score : cmpResult.company2Score;
                  const pros = (n === 1 ? cmpResult.company1Pros : cmpResult.company2Pros) as string[] ?? [];
                  const cons = (n === 1 ? cmpResult.company1Cons : cmpResult.company2Cons) as string[] ?? [];
                  const comp = n === 1 ? cmpResult.compEstimate1 : cmpResult.compEstimate2;
                  const isWinner = String(cmpResult.winner) === name;
                  return (
                    <div key={n} className="card" style={{ borderColor: isWinner ? "var(--primary)" : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <strong>{name}</strong>
                        {isWinner && <span className="badge badge-high" style={{ background: "var(--primary)", color: "#fff" }}>Winner</span>}
                      </div>
                      <div className="score-row">
                        <span style={{ fontSize: "0.8rem", width: "60px" }}>Fit</span>
                        <div className="score-bar"><div className="score-fill-bar" style={{ width: `${score}%` }} /></div>
                        <strong>{String(score)}</strong>
                      </div>
                      <div style={{ fontSize: "0.82rem", color: "var(--muted)", marginBottom: "0.35rem" }}>Comp: {String(comp)}</div>
                      <div style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}><strong>✅ Pros</strong></div>
                      <ul style={{ paddingLeft: "1rem", margin: "0 0 0.5rem" }}>{pros.map((p) => <li key={p} style={{ fontSize: "0.82rem" }}>{p}</li>)}</ul>
                      <div style={{ fontSize: "0.82rem", marginBottom: "0.25rem" }}><strong>⚠️ Cons</strong></div>
                      <ul style={{ paddingLeft: "1rem", margin: 0 }}>{cons.map((c) => <li key={c} style={{ fontSize: "0.82rem" }}>{c}</li>)}</ul>
                    </div>
                  );
                })}
              </div>
              {!!cmpResult.verdict && <div className="verdict-box">{String(cmpResult.verdict)}</div>}
            </div>
          )}
        </section>
      )}

      {/* ── Salary ───────────────────────────────────────────── */}
      {activeTool === "salary" && (
        <section className="card">
          <h2>Salary Intelligence</h2>
          <p className="subline">AI-estimated comp bands based on role, company, and your profile.</p>
          <div className="search-form">
            <input type="text" className="query-input" placeholder="Role — e.g. Senior SDE" value={salRole} onChange={(e) => setSalRole(e.target.value)} />
            <input type="text" className="query-input" placeholder="Company — e.g. Zepto" value={salCompany} onChange={(e) => setSalCompany(e.target.value)} />
            <input type="text" className="query-input" placeholder="Location (optional) — Bangalore, SF" value={salLocation} onChange={(e) => setSalLocation(e.target.value)} />
          </div>
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleSalary}>
            {submitting ? "Estimating…" : "Get Salary Intel"}
          </button>

          {salResult && (
            <div style={{ marginTop: "1.25rem" }}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1rem" }}>
                <div className="card" style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Base Salary</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{String(salResult.baseLow)} – {String(salResult.baseHigh)}</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: "160px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Total Comp</div>
                  <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{String(salResult.totalLow)} – {String(salResult.totalHigh)}</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: "140px" }}>
                  <div style={{ fontSize: "0.78rem", color: "var(--muted)" }}>Level</div>
                  <div style={{ fontWeight: 700 }}>{String(salResult.level)}</div>
                </div>
              </div>
              {!!salResult.breakdown && <div className="card" style={{ marginBottom: "0.75rem" }}><span className="card-label">Breakdown</span><p style={{ fontSize: "0.88rem" }}>{String(salResult.breakdown)}</p></div>}
              {(salResult.negotiationTips as string[] ?? []).length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <div className="field-label">Negotiation Tips</div>
                  <ul style={{ paddingLeft: "1.25rem", marginTop: "0.35rem" }}>
                    {(salResult.negotiationTips as string[]).map((t) => <li key={t} style={{ fontSize: "0.88rem", marginBottom: "0.3rem" }}>{t}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                Confidence: <strong>{String(salResult.confidenceLevel)}</strong>
                {(salResult.sources as string[] ?? []).length > 0 && ` · Sources: ${(salResult.sources as string[]).join(", ")}`}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Cover Letter ─────────────────────────────────────── */}
      {activeTool === "coverletter" && (
        <section className="card">
          <h2>Cover Letter Generator</h2>
          <p className="subline">Personalised 280–340 word cover letters grounded in your resume and the specific role.</p>
          <div className="search-form" style={{ marginBottom: "0.5rem" }}>
            <input type="text" className="query-input" placeholder="Company" value={clCompany} onChange={(e) => setClCompany(e.target.value)} />
            <input type="text" className="query-input" placeholder="Role" value={clRole} onChange={(e) => setClRole(e.target.value)} />
          </div>
          <textarea className="ciq-resume" rows={4} value={clJd} onChange={(e) => setClJd(e.target.value)} placeholder="Paste job description (optional but recommended)…" />
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleCoverLetter}>
            {submitting ? "Writing…" : "Generate Cover Letter"}
          </button>
          {clResult && (
            <div className="card highlight" style={{ marginTop: "1rem" }}>
              <span className="card-label">Cover Letter</span>
              <pre className="draft-body">{clResult}</pre>
              <button className="ghost-button" onClick={() => { navigator.clipboard.writeText(clResult); toast("Copied!", "success"); }}>Copy</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
