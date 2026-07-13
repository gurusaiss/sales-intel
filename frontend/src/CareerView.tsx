import { useState, useEffect, type FormEvent } from "react";
import {
  fetchResume,
  saveResumeText,
  scoreJobMatch,
  generateCoverLetter,
  optimizeResumeText,
  fetchJobs,
  addJobApplication,
  updateJobStatus,
  deleteJobApplication,
  linkJobReferral,
  fetchAllPersons,
  type JobMatchResult,
  type JobApplication,
  type JobStatus,
} from "./api";
import type { CrmPerson } from "./types";

const JOB_STATUSES: JobStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];

export default function CareerView() {
  const [resumeText, setResumeText] = useState("");
  const [resumeSaved, setResumeSaved] = useState(false);
  const [jobDescription, setJobDescription] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");

  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);
  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<JobApplication[]>([]);
  const [jobsLoaded, setJobsLoaded] = useState(false);
  const [optimized, setOptimized] = useState<string | null>(null);
  const [optimizing, setOptimizing] = useState(false);
  const [trackedPersons, setTrackedPersons] = useState<CrmPerson[]>([]);

  useEffect(() => {
    fetchResume()
      .then((resume) => {
        if (resume) setResumeText(resume.text);
      })
      .catch(() => {});
    fetchAllPersons()
      .then(setTrackedPersons)
      .catch(() => {});
  }, []);

  async function handleOptimizeResume() {
    if (!resumeText.trim()) return;
    setOptimizing(true);
    setError(null);
    try {
      const result = await optimizeResumeText(role.trim() || undefined);
      setOptimized(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to optimize resume");
    } finally {
      setOptimizing(false);
    }
  }

  async function handleLinkReferral(jobId: string, linkedinUrl: string) {
    if (!linkedinUrl) return;
    const job = await linkJobReferral(jobId, linkedinUrl);
    setJobs((current) => current.map((j) => (j.id === jobId ? job : j)));
  }

  async function handleSaveResume() {
    if (!resumeText.trim()) return;
    await saveResumeText(resumeText.trim());
    setResumeSaved(true);
    setTimeout(() => setResumeSaved(false), 2000);
  }

  async function handleScoreMatch() {
    if (!jobDescription.trim()) return;
    setMatching(true);
    setError(null);
    try {
      const result = await scoreJobMatch(jobDescription.trim());
      setMatchResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to score match");
    } finally {
      setMatching(false);
    }
  }

  async function handleGenerateCoverLetter() {
    if (!jobDescription.trim() || !company.trim() || !role.trim()) {
      setError("Company, role, and job description are required for a cover letter.");
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const letter = await generateCoverLetter(jobDescription.trim(), company.trim(), role.trim());
      setCoverLetter(letter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cover letter");
    } finally {
      setDrafting(false);
    }
  }

  async function loadJobs() {
    try {
      const data = await fetchJobs();
      setJobs(data);
      setJobsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    }
  }

  async function handleAddJob(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;
    const job = await addJobApplication(company.trim(), role.trim());
    setJobs((current) => [job, ...current]);
    setJobsLoaded(true);
  }

  async function handleJobStatus(id: string, status: JobStatus) {
    await updateJobStatus(id, status);
    setJobs((current) => current.map((j) => (j.id === id ? { ...j, status } : j)));
  }

  async function handleDeleteJob(id: string) {
    await deleteJobApplication(id);
    setJobs((current) => current.filter((j) => j.id !== id));
  }

  async function handleCopyLetter() {
    if (!coverLetter) return;
    await navigator.clipboard.writeText(coverLetter);
  }

  return (
    <div className="result">
      {error && <div className="error-banner">{error}</div>}

      <section className="card">
        <h2>Your resume</h2>
        <p className="subline">Stored once, reused for every job match score and cover letter.</p>
        <textarea
          className="resume-textarea"
          rows={6}
          value={resumeText}
          onChange={(e) => setResumeText(e.target.value)}
          placeholder="Paste your resume text here…"
        />
        <div className="queue-actions">
          <button className="ghost-button accent" onClick={handleSaveResume}>
            {resumeSaved ? "Saved!" : "Save resume"}
          </button>
          <button className="ghost-button" disabled={optimizing} onClick={handleOptimizeResume}>
            {optimizing ? "Optimizing…" : "AI-optimize resume"}
          </button>
        </div>
        {optimized && (
          <div className="card highlight" style={{ marginTop: "0.75rem" }}>
            <span className="card-label">AI-optimized resume</span>
            <pre className="draft-body">{optimized}</pre>
            <div className="queue-actions">
              <button
                className="ghost-button"
                onClick={() => navigator.clipboard.writeText(optimized)}
              >
                Copy
              </button>
              <button
                className="ghost-button accent"
                onClick={() => {
                  setResumeText(optimized);
                  setOptimized(null);
                }}
              >
                Use this version
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Job match &amp; cover letter</h2>
        <label className="field-label" htmlFor="jd">
          Job description
        </label>
        <textarea
          id="jd"
          className="resume-textarea"
          rows={5}
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste the job description…"
        />
        <div className="search-form" style={{ marginTop: "0.5rem" }}>
          <input
            type="text"
            className="query-input"
            placeholder="Company — e.g. Acme Corp"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            type="text"
            className="domain-input"
            placeholder="Role — e.g. Senior Backend Engineer"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <div className="queue-actions" style={{ marginTop: "0.5rem" }}>
          <button className="ghost-button" disabled={matching} onClick={handleScoreMatch}>
            {matching ? "Scoring…" : "Score job match"}
          </button>
          <button className="ghost-button accent" disabled={drafting} onClick={handleGenerateCoverLetter}>
            {drafting ? "Writing…" : "Generate cover letter"}
          </button>
        </div>

        {matchResult && (
          <div className="card highlight" style={{ marginTop: "0.75rem" }}>
            <span className="card-label">Match score: {matchResult.score}/100</span>
            <p>{matchResult.summary}</p>
            {matchResult.strengths.length > 0 && (
              <div className="signal-list">
                <span className="field-label">Strengths</span>
                <ul>
                  {matchResult.strengths.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {matchResult.gaps.length > 0 && (
              <div className="signal-list">
                <span className="field-label">Gaps</span>
                <ul>
                  {matchResult.gaps.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {coverLetter && (
          <div className="card highlight" style={{ marginTop: "0.75rem" }}>
            <span className="card-label">Cover letter</span>
            <pre className="draft-body">{coverLetter}</pre>
            <div className="queue-actions">
              <button className="ghost-button" onClick={handleCopyLetter}>
                Copy
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="card">
        <div className="queue-card-header">
          <h2>Job tracker</h2>
          <button className="ghost-button" onClick={loadJobs}>
            {jobsLoaded ? "Refresh" : "Load jobs"}
          </button>
        </div>
        <form className="search-form" onSubmit={handleAddJob}>
          <input
            type="text"
            className="query-input"
            placeholder="Company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
          <input
            type="text"
            className="domain-input"
            placeholder="Role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <button type="submit">Add application</button>
        </form>

        {jobsLoaded && jobs.length === 0 && (
          <p className="subline">No applications tracked yet.</p>
        )}

        {jobs.length > 0 && (
          <div className="lead-table" style={{ marginTop: "0.75rem" }}>
            <div className="lead-row jobs-row lead-header">
              <span />
              <span>Company</span>
              <span>Role</span>
              <span>Status</span>
              <span>Referral contact</span>
              <span></span>
            </div>
            {jobs.map((job) => (
              <div className="lead-row jobs-row" key={job.id}>
                <span />
                <span>{job.company}</span>
                <span>{job.role}</span>
                <span>
                  <select
                    value={job.status}
                    onChange={(e) => handleJobStatus(job.id, e.target.value as JobStatus)}
                    className="meeting-input"
                  >
                    {JOB_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </span>
                <span>
                  {job.referralPersonLinkedinUrl ? (
                    <span className="badge badge-medium">{job.referralContactName}</span>
                  ) : (
                    <select
                      value=""
                      className="meeting-input"
                      onChange={(e) => handleLinkReferral(job.id, e.target.value)}
                    >
                      <option value="">Link tracked contact…</option>
                      {trackedPersons.map((p) => (
                        <option key={p.id} value={p.linkedinUrl}>
                          {p.name}
                          {p.company ? ` (${p.company})` : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
                <span>
                  <button className="ghost-button danger" onClick={() => handleDeleteJob(job.id)}>
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
