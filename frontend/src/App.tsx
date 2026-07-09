import { useState, type FormEvent } from "react";
import { searchQuery } from "./api";
import type { ResearchResponse } from "./types";
import QueueView from "./QueueView";
import "./App.css";

type Tab = "research" | "queue";

function App() {
  const [tab, setTab] = useState<Tab>("research");
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await searchQuery(query.trim(), domain.trim() || undefined);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="eyebrow">Sales Intelligence — Research MVP</span>
        <h1>{tab === "research" ? "Look up a person or company" : "Outreach queue"}</h1>
        <nav className="tab-row" aria-label="View">
          <button
            className={`tab-button ${tab === "research" ? "active" : ""}`}
            onClick={() => setTab("research")}
          >
            Research
          </button>
          <button
            className={`tab-button ${tab === "queue" ? "active" : ""}`}
            onClick={() => setTab("queue")}
          >
            Queue
          </button>
        </nav>

        {tab === "research" && (
          <>
            <form className="search-form" onSubmit={handleSubmit}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. John Doe or Northwind Analytics Inc."
                aria-label="Search query"
                className="query-input"
              />
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Company domain (optional) — acme.com"
                aria-label="Company domain"
                className="domain-input"
              />
              <button type="submit" disabled={loading}>
                {loading ? "Researching…" : "Research"}
              </button>
            </form>
            <p className="form-hint">
              {domain.trim()
                ? "Domain provided — this search will use real Hunter.io data if HUNTER_API_KEY is set."
                : "No domain — this search uses mock data. Add a company domain for real Hunter.io lookups."}
            </p>
          </>
        )}
      </header>

      {tab === "research" ? (
        <>
          {error && <div className="error-banner">{error}</div>}
          {result && <ResultView result={result} />}
          {!result && !error && !loading && (
            <p className="empty-state">
              Enter a name or company to generate a research profile, AI summary, and a draft
              outreach email.
            </p>
          )}
        </>
      ) : (
        <QueueView />
      )}
    </div>
  );
}

function ResultView({ result }: { result: ResearchResponse }) {
  const { enrichment, aiSummary, outreachDraft } = result;
  const { person, company, sources } = enrichment;

  return (
    <div className="result">
      <section className="card">
        <h2>{person.name}</h2>
        {person.title && (
          <p className="subline">
            {person.title}
            {person.company ? ` at ${person.company}` : ""}
          </p>
        )}
        <div className="field-grid">
          {person.location && <Field label="Location" value={person.location} />}
          {person.publicEmail && (
            <Field
              label="Public email"
              value={person.publicEmail}
              badge={person.emailConfidence}
            />
          )}
        </div>
        {person.socials && person.socials.length > 0 && (
          <LinkRow links={person.socials} />
        )}
        {person.bioSignals && person.bioSignals.length > 0 && (
          <SignalList title="Public signals" items={person.bioSignals} />
        )}
      </section>

      {company && (
        <section className="card">
          <h2>{company.name}</h2>
          {company.description && <p className="subline">{company.description}</p>}
          <div className="field-grid">
            {company.industry && <Field label="Industry" value={company.industry} />}
            {company.employeeRange && <Field label="Employees" value={company.employeeRange} />}
            {company.founded && <Field label="Founded" value={company.founded} />}
            {company.website && <Field label="Website" value={company.website} isLink />}
            {company.funding?.stage && (
              <Field
                label="Funding"
                value={`${company.funding.stage} · ${company.funding.totalRaised ?? "—"}`}
              />
            )}
          </div>
          {company.technologies && company.technologies.length > 0 && (
            <div className="tag-row">
              {company.technologies.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          )}
          {company.socials && company.socials.length > 0 && <LinkRow links={company.socials} />}
          {company.newsSignals && company.newsSignals.length > 0 && (
            <SignalList title="Growth signals" items={company.newsSignals} />
          )}
        </section>
      )}

      <section className="card highlight">
        <span className="card-label">AI Summary</span>
        <p>{aiSummary}</p>
      </section>

      <section className="card highlight">
        <span className="card-label">Draft Outreach</span>
        <p className="draft-subject">{outreachDraft.subject}</p>
        <pre className="draft-body">{outreachDraft.body}</pre>
      </section>

      <footer className="sources">Sources: {sources.join(", ")}</footer>
    </div>
  );
}

function Field({
  label,
  value,
  badge,
  isLink,
}: {
  label: string;
  value: string;
  badge?: string;
  isLink?: boolean;
}) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">
        {isLink ? (
          <a href={value} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
        {badge && <span className={`badge badge-${badge}`}>{badge}</span>}
      </span>
    </div>
  );
}

function LinkRow({ links }: { links: { platform: string; url: string }[] }) {
  return (
    <div className="link-row">
      {links.map((l) => (
        <a key={l.url} href={l.url} target="_blank" rel="noreferrer">
          {l.platform}
        </a>
      ))}
    </div>
  );
}

function SignalList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="signal-list">
      <span className="field-label">{title}</span>
      <ul>
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;
