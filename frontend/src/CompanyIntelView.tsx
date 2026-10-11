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

interface JDFitResult {
  fitScore: number;
  atsScore: number;
  verdict: string;
  matchedSkills: string[];
  missingSkills: string[];
  keywordGaps: string[];
  tailoredPitch: string;
  resumeAdvice: string;
  interviewFocus: string[];
}

interface CompareResult {
  company1Score: number;
  company2Score: number;
  company1Pros: string[];
  company1Cons: string[];
  company2Pros: string[];
  company2Cons: string[];
  compEstimate1: string;
  compEstimate2: string;
  winner: string;
  verdict: string;
}

interface SalaryResult {
  baseLow: string;
  baseHigh: string;
  totalLow: string;
  totalHigh: string;
  level: string;
  breakdown: string;
  negotiationTips: string[];
  confidenceLevel: string;
  sources: string[];
}

type ActiveTool = "intel" | "jdfit" | "compare" | "salary" | "coverletter";

interface SectionDef {
  key: keyof CIQReport;
  num: string;
  label: string;
}

const SECTIONS: SectionDef[] = [
  { key: "overview",           num: "01", label: "Company Overview" },
  { key: "founders",           num: "02", label: "Founders & Leadership" },
  { key: "originStory",        num: "03", label: "Origin Story & Growth" },
  { key: "challenges",         num: "04", label: "Past Challenges" },
  { key: "productsProjects",   num: "05", label: "Products & Projects" },
  { key: "roadmap",            num: "06", label: "Future Roadmap" },
  { key: "competitive",        num: "07", label: "Competitive Landscape" },
  { key: "struggles",          num: "08", label: "Current Struggles" },
  { key: "culture",            num: "10", label: "Culture & Work Life" },
  { key: "redFlags",           num: "11", label: "Red Flags & Due Diligence" },
  { key: "applicationStrategy",num: "12", label: "Application Strategy" },
  { key: "candidateFit",       num: "13", label: "Candidate Fit Analysis" },
];

export default function CompanyIntelView() {
  const [activeTool, setActiveTool] = useState<ActiveTool>("intel");
  const [resumeText, setResumeText] = useState(() => localStorage.getItem("ciq_resume") ?? "");
  const [resumeEditing, setResumeEditing] = useState(() => !localStorage.getItem("ciq_resume"));
  const [history, setHistory] = useState<CIQJob[]>([]);
  const [activeJob, setActiveJob] = useState<CIQJob | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("overview");
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashFlipped, setFlashFlipped] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Intel tool state
  const [companyName, setCompanyName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // JD Fit state
  const [jdText, setJdText] = useState("");
  const [jdCompany, setJdCompany] = useState("");
  const [jdResult, setJdResult] = useState<JDFitResult | null>(null);

  // Compare state
  const [cmp1, setCmp1] = useState("");
  const [cmp2, setCmp2] = useState("");
  const [cmpResult, setCmpResult] = useState<CompareResult | null>(null);

  // Salary state
  const [salRole, setSalRole] = useState("");
  const [salCompany, setSalCompany] = useState("");
  const [salLocation, setSalLocation] = useState("");
  const [salResult, setSalResult] = useState<SalaryResult | null>(null);

  // Cover Letter state
  const [clCompany, setClCompany] = useState("");
  const [clRole, setClRole] = useState("");
  const [clJd, setClJd] = useState("");
  const [clJdOpen, setClJdOpen] = useState(false);
  const [clResult, setClResult] = useState<string | null>(null);

  useEffect(() => { loadHistory(); }, []);

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
      setJdResult(r as JDFitResult);
    } catch { toast("Analysis failed", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleCompare() {
    if (!cmp1.trim() || !cmp2.trim() || !resumeText.trim()) { toast("Two company names and resume required", "error"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/ciq/compare", { method: "POST", body: JSON.stringify({ company1: cmp1, company2: cmp2, resumeText }) });
      setCmpResult(r as CompareResult);
    } catch { toast("Comparison failed", "error"); }
    finally { setSubmitting(false); }
  }

  async function handleSalary() {
    if (!salRole.trim() || !salCompany.trim() || !resumeText.trim()) { toast("Role, company and resume required", "error"); return; }
    setSubmitting(true);
    try {
      const r = await apiFetch("/ciq/salary", { method: "POST", body: JSON.stringify({ role: salRole, companyName: salCompany, resumeText, location: salLocation }) });
      setSalResult(r as SalaryResult);
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

  const TABS: [ActiveTool, string][] = [
    ["intel",       "Intel"],
    ["jdfit",       "JD Fit"],
    ["compare",     "Compare"],
    ["salary",      "Salary"],
    ["coverletter", "Cover Letter"],
  ];

  return (
    <div className="result">

      {/* Resume — collapsible */}
      <section className="card">
        {resumeEditing ? (
          <>
            <div className="ciq-resume-header">
              <h2>Your Resume</h2>
              {!!resumeText && (
                <button className="ghost-button" onClick={() => setResumeEditing(false)}>Done</button>
              )}
            </div>
            <p className="subline">Stored locally — used by all CompanyIQ tools.</p>
            <textarea
              className="ciq-textarea"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here…"
              rows={6}
            />
          </>
        ) : (
          <div className="ciq-resume-preview">
            <span className="ciq-resume-preview-text">
              Resume saved · {resumeText.length} chars
            </span>
            <button className="ghost-button" onClick={() => setResumeEditing(true)}>Edit</button>
          </div>
        )}
      </section>

      {/* Tab bar — underline style */}
      <div className="ciq-tab-bar">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={`ciq-tab${activeTool === id ? " active" : ""}`}
            onClick={() => setActiveTool(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Company Intel ── */}
      {activeTool === "intel" && (
        <>
          <section className="card">
            <h2>Company Intelligence Report</h2>
            <p className="subline">AI researches the company live and generates a 13-section deep-dive.</p>
            <div className="search-form" style={{ marginTop: "0.75rem" }}>
              <input
                type="text"
                className="query-input"
                placeholder="Company name — e.g. Stripe, Zepto, Notion"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStartReport()}
              />
              <button disabled={submitting} onClick={handleStartReport}>
                {submitting ? "Starting…" : "Research"}
              </button>
            </div>

            {activeJob && activeJob.status !== "done" && activeJob.status !== "failed" && (
              <p className="ciq-status-line">
                {statusLabel[activeJob.status] ?? activeJob.status} {activeJob.companyName}
              </p>
            )}
            {activeJob?.status === "failed" && (
              <p className="ciq-status-line ciq-status-error">
                Failed — {activeJob.errorMessage ?? "unknown error"}
              </p>
            )}
          </section>

          {activeJob?.status === "done" && !!activeJob.report && (
            <section className="card">
              <div className="ciq-report-header">
                <h2>{activeJob.companyName}</h2>
                <span className="badge badge-medium">Report ready</span>
              </div>

              {activeJob.report.raw ? (
                <pre className="ciq-raw">{activeJob.report.raw}</pre>
              ) : (
                <div className="ciq-accordion">
                  {SECTIONS.map(({ key, num, label }) => {
                    const val = activeJob.report![key];
                    if (!val) return null;
                    const isOpen = expandedSection === key;
                    return (
                      <div key={key} className="ciq-section">
                        <button
                          className="ciq-section-btn"
                          onClick={() => setExpandedSection(isOpen ? null : key)}
                          aria-expanded={isOpen}
                        >
                          <span className="ciq-section-num">{num}</span>
                          <span className="ciq-section-title">{label}</span>
                          <span className="ciq-section-chevron">{isOpen ? "−" : "+"}</span>
                        </button>
                        {isOpen && (
                          <div className="ciq-section-body">
                            {typeof val === "string" ? val : JSON.stringify(val, null, 2)}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* 09 — Interview Questions */}
                  {questions.length > 0 && (
                    <div className="ciq-section">
                      <button
                        className="ciq-section-btn"
                        onClick={() => setExpandedSection(expandedSection === "flash" ? null : "flash")}
                        aria-expanded={expandedSection === "flash"}
                      >
                        <span className="ciq-section-num">09</span>
                        <span className="ciq-section-title">Interview Questions</span>
                        <span className="ciq-section-chevron">{expandedSection === "flash" ? "−" : "+"}</span>
                      </button>
                      {expandedSection === "flash" && (
                        <div className="ciq-section-body">
                          <div className="ciq-flashcard-wrap">
                            <div
                              className={`ciq-flashcard${flashFlipped ? " flipped" : ""}`}
                              onClick={() => setFlashFlipped((f) => !f)}
                            >
                              <div className="ciq-card-face ciq-card-front">
                                <p>{questions[flashcardIdx]}</p>
                              </div>
                              <div className="ciq-card-face ciq-card-back">
                                <p>{flashcardIdx + 1} / {questions.length}</p>
                              </div>
                            </div>
                          </div>
                          <div className="ciq-flashcard-nav">
                            <button
                              className="ghost-button"
                              onClick={() => { setFlashcardIdx((i) => (i - 1 + questions.length) % questions.length); setFlashFlipped(false); }}
                            >
                              ← Prev
                            </button>
                            <span className="muted">{flashcardIdx + 1} / {questions.length}</span>
                            <button
                              className="ghost-button"
                              onClick={() => { setFlashcardIdx((i) => (i + 1) % questions.length); setFlashFlipped(false); }}
                            >
                              Next →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {history.length > 0 && (
            <section className="card">
              <h2>Report History</h2>
              <div className="ciq-history-list">
                {history.map((j) => (
                  <div key={j.id} className="ciq-history-row" onClick={() => loadHistoryJob(j)}>
                    <div className="ciq-history-info">
                      <span className="ciq-history-name">{j.companyName}</span>
                      <span className="ciq-history-meta">
                        {new Date(j.createdAt).toLocaleDateString()} · {j.status}
                      </span>
                    </div>
                    <button
                      className="ghost-button danger"
                      onClick={(e) => { e.stopPropagation(); deleteJob(j.id); }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── JD Fit ── */}
      {activeTool === "jdfit" && (
        <section className="card">
          <h2>JD Fit Score</h2>
          <p className="subline">Paste a job description to get fit score, ATS score, skill gaps and tailored advice.</p>
          <input
            type="text"
            className="query-input"
            placeholder="Company name (optional)"
            value={jdCompany}
            onChange={(e) => setJdCompany(e.target.value)}
            style={{ width: "100%", marginBottom: "0.5rem" }}
          />
          <textarea
            className="ciq-textarea"
            rows={6}
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            placeholder="Paste job description here…"
          />
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleJdFit}>
            {submitting ? "Analyzing…" : "Analyze Fit"}
          </button>

          {!!jdResult && (
            <div style={{ marginTop: "1.25rem" }}>
              <div className="ciq-score-pair">
                <div className="ciq-score-block">
                  <span className="ciq-score-val">{jdResult.fitScore}</span>
                  <span className="ciq-score-label">Fit Score</span>
                </div>
                <div className="ciq-score-block">
                  <span className="ciq-score-val">{jdResult.atsScore}</span>
                  <span className="ciq-score-label">ATS Score</span>
                </div>
              </div>
              {!!jdResult.verdict && (
                <p className="ciq-verdict-line">{jdResult.verdict}</p>
              )}

              <div className="ciq-skills-grid">
                <div className="ciq-skill-col">
                  <span className="field-label">Present</span>
                  <ul className="ciq-skill-list ciq-skill-list--matched">
                    {jdResult.matchedSkills.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
                <div className="ciq-skill-col">
                  <span className="field-label">Missing</span>
                  <ul className="ciq-skill-list ciq-skill-list--missing">
                    {jdResult.missingSkills.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                </div>
              </div>

              {jdResult.keywordGaps.length > 0 && (
                <div style={{ marginBottom: "0.75rem" }}>
                  <span className="field-label">Keyword Gaps</span>
                  <div className="tag-row" style={{ marginTop: "0.35rem" }}>
                    {jdResult.keywordGaps.map((s) => <span key={s} className="tag">{s}</span>)}
                  </div>
                </div>
              )}

              {!!jdResult.tailoredPitch && (
                <div className="card highlight" style={{ marginTop: "0.75rem" }}>
                  <span className="card-label">Tailored Pitch</span>
                  <p>{jdResult.tailoredPitch}</p>
                </div>
              )}
              {!!jdResult.resumeAdvice && (
                <div className="card highlight" style={{ marginTop: "0.5rem" }}>
                  <span className="card-label">Resume Advice</span>
                  <p>{jdResult.resumeAdvice}</p>
                </div>
              )}
              {jdResult.interviewFocus.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <span className="field-label">Interview Focus Areas</span>
                  <ol className="ciq-ol">
                    {jdResult.interviewFocus.map((f) => <li key={f}>{f}</li>)}
                  </ol>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Compare ── */}
      {activeTool === "compare" && (
        <section className="card">
          <h2>Compare Companies</h2>
          <p className="subline">Head-to-head comparison for your profile and experience level.</p>
          <div className="ciq-comp-grid">
            <input type="text" className="query-input" placeholder="Company 1 — e.g. Google" value={cmp1} onChange={(e) => setCmp1(e.target.value)} />
            <input type="text" className="query-input" placeholder="Company 2 — e.g. Stripe" value={cmp2} onChange={(e) => setCmp2(e.target.value)} />
          </div>
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleCompare}>
            {submitting ? "Comparing…" : "Compare"}
          </button>

          {!!cmpResult && (
            <div style={{ marginTop: "1.25rem" }}>
              <div className="ciq-comp-grid">
                {([1, 2] as const).map((n) => {
                  const name = n === 1 ? cmp1 : cmp2;
                  const score = n === 1 ? cmpResult.company1Score : cmpResult.company2Score;
                  const pros = n === 1 ? cmpResult.company1Pros : cmpResult.company2Pros;
                  const cons = n === 1 ? cmpResult.company1Cons : cmpResult.company2Cons;
                  const comp = n === 1 ? cmpResult.compEstimate1 : cmpResult.compEstimate2;
                  const isWinner = cmpResult.winner === name;
                  return (
                    <div key={n} className={`ciq-comp-card${isWinner ? " winner" : ""}`}>
                      <div className="ciq-comp-card-header">
                        <strong>{name}</strong>
                        {isWinner && <span className="badge badge-high">Winner</span>}
                      </div>
                      <div className="ciq-comp-score">{score}<span className="ciq-comp-score-denom">/100</span></div>
                      <p className="muted" style={{ fontSize: "0.82rem", margin: "0 0 0.6rem" }}>Comp: {comp}</p>
                      <span className="field-label">Pros</span>
                      <ul className="ciq-bullet-list">
                        {pros.map((p) => <li key={p}>{p}</li>)}
                      </ul>
                      <span className="field-label" style={{ marginTop: "0.5rem", display: "block" }}>Cons</span>
                      <ul className="ciq-bullet-list">
                        {cons.map((c) => <li key={c}>{c}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
              {!!cmpResult.verdict && (
                <blockquote className="ciq-verdict">{cmpResult.verdict}</blockquote>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Salary ── */}
      {activeTool === "salary" && (
        <section className="card">
          <h2>Salary Intelligence</h2>
          <p className="subline">AI-estimated comp bands based on role, company, and your profile.</p>
          <div className="search-form" style={{ flexDirection: "column", gap: "0.5rem" }}>
            <input type="text" className="query-input" placeholder="Role — e.g. Senior SDE" value={salRole} onChange={(e) => setSalRole(e.target.value)} />
            <input type="text" className="query-input" placeholder="Company — e.g. Zepto" value={salCompany} onChange={(e) => setSalCompany(e.target.value)} />
            <input type="text" className="query-input" placeholder="Location (optional) — Bangalore, SF" value={salLocation} onChange={(e) => setSalLocation(e.target.value)} />
          </div>
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleSalary}>
            {submitting ? "Estimating…" : "Get Salary Intel"}
          </button>

          {!!salResult && (
            <div style={{ marginTop: "1.25rem" }}>
              <p className="ciq-comp-range">
                {salResult.baseLow} – {salResult.baseHigh} base
                <span className="ciq-comp-range-sep">·</span>
                {salResult.totalLow} – {salResult.totalHigh} total
              </p>
              <div className="ciq-sal-meta">
                <span className="badge">{salResult.level}</span>
                <span className="muted" style={{ fontSize: "0.8rem" }}>Confidence: {salResult.confidenceLevel}</span>
              </div>

              {!!salResult.breakdown && (
                <div className="card highlight" style={{ marginTop: "0.75rem" }}>
                  <span className="card-label">Breakdown</span>
                  <p>{salResult.breakdown}</p>
                </div>
              )}
              {salResult.negotiationTips.length > 0 && (
                <div style={{ marginTop: "0.75rem" }}>
                  <span className="field-label">Negotiation Tips</span>
                  <ol className="ciq-ol">
                    {salResult.negotiationTips.map((t) => <li key={t}>{t}</li>)}
                  </ol>
                </div>
              )}
              {salResult.sources.length > 0 && (
                <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  Sources: {salResult.sources.join(", ")}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Cover Letter ── */}
      {activeTool === "coverletter" && (
        <section className="card">
          <h2>Cover Letter Generator</h2>
          <p className="subline">Personalised 280–340 word cover letters grounded in your resume and the specific role.</p>
          <div className="search-form" style={{ flexDirection: "column", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <input type="text" className="query-input" placeholder="Company" value={clCompany} onChange={(e) => setClCompany(e.target.value)} />
            <input type="text" className="query-input" placeholder="Role" value={clRole} onChange={(e) => setClRole(e.target.value)} />
          </div>
          <button
            className="ghost-button"
            style={{ marginBottom: "0.5rem" }}
            onClick={() => setClJdOpen((v) => !v)}
          >
            {clJdOpen ? "− Remove job description" : "+ Add job description"}
          </button>
          {clJdOpen && (
            <textarea
              className="ciq-textarea"
              rows={4}
              value={clJd}
              onChange={(e) => setClJd(e.target.value)}
              placeholder="Paste job description (optional but recommended)…"
            />
          )}
          <button style={{ marginTop: "0.75rem" }} disabled={submitting} onClick={handleCoverLetter}>
            {submitting ? "Writing…" : "Generate Cover Letter"}
          </button>
          {!!clResult && (
            <div className="card highlight" style={{ marginTop: "1rem" }}>
              <div className="ciq-cl-header">
                <span className="card-label">Cover Letter</span>
                <button
                  className="ghost-button"
                  onClick={() => { navigator.clipboard.writeText(clResult); toast("Copied!", "success"); }}
                >
                  Copy
                </button>
              </div>
              <pre className="draft-body">{clResult}</pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
