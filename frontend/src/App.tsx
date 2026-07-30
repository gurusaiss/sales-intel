import { useState, type FormEvent, useEffect } from "react";
import { searchQuery, findLinkedPerson } from "./api";
import type { ResearchResponse, CrmPerson } from "./types";
import QueueView from "./QueueView";
import AnalyticsView from "./AnalyticsView";
import CompanySearchView from "./CompanySearchView";
import CareerView from "./CareerView";
import AuthBar from "./AuthBar";
import HistoryView from "./HistoryView";
import AnalyzeView from "./AnalyzeView";
import NewsAndTrendsView from "./NewsAndTrendsView";
import DiscoverView from "./DiscoverView";
import ReportsView from "./ReportsView";
import SearchView from "./SearchView";
import SavedView from "./SavedView";
import { ToastContainer } from "./components/Toast";
import "./App.css";

type Tab = "research" | "companies" | "analyze" | "newstrends" | "discover" | "reports" | "search" | "saved" | "queue" | "analytics" | "career" | "history";

const PAGE_TITLES: Record<Tab, string> = {
  research: "Research",
  companies: "Company Search",
  analyze: "Website Analyzer",
  newstrends: "News & Trends",
  discover: "Discover",
  reports: "Reports",
  search: "Search",
  saved: "Saved",
  queue: "Outreach Queue",
  analytics: "Analytics",
  career: "Career Tools",
  history: "History",
};

const NAV_GROUPS: { label: string; items: { id: Tab; label: string; icon: string }[] }[] = [
  {
    label: "Intelligence",
    items: [
      { id: "newstrends", label: "News & Trends", icon: "news" },
      { id: "discover", label: "Discover", icon: "compass" },
      { id: "reports", label: "Reports", icon: "file" },
      { id: "search", label: "Search", icon: "search" },
    ],
  },
  {
    label: "Prospecting",
    items: [
      { id: "research", label: "Research", icon: "target" },
      { id: "companies", label: "Companies", icon: "building" },
      { id: "analyze", label: "Analyze Site", icon: "globe" },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { id: "queue", label: "Queue", icon: "inbox" },
      { id: "saved", label: "Saved", icon: "bookmark" },
      { id: "analytics", label: "Analytics", icon: "chart" },
      { id: "history", label: "History", icon: "clock" },
    ],
  },
  {
    label: "Toolkit",
    items: [{ id: "career", label: "Career", icon: "briefcase" }],
  },
];

const ICON_PATHS: Record<string, string> = {
  news: "M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8V6Z",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 13h6M9 17h6",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  building: "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18M2 22h20M10 6h4M10 10h4M10 14h4",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20Z",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z",
  chart: "M3 3v18h18M18 17V9M13 17V5M8 17v-3",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2",
  briefcase: "M20 7h-16a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16",
};

function NavIcon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name] ?? ""} />
    </svg>
  );
}

function App() {
  const [tab, setTab] = useState<Tab>("newstrends");
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [linkedPerson, setLinkedPerson] = useState<CrmPerson | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("salesIntelTheme");
      if (saved) return saved === "dark";
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("salesIntelTheme", darkMode ? "dark" : "light");
  }, [darkMode]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setLinkedPerson(null);
    try {
      const data = await searchQuery(query.trim(), domain.trim() || undefined);
      setResult(data);

      const linked = await findLinkedPerson({
        email: data.enrichment.person.publicEmail,
        domain: data.enrichment.company?.domain,
        name: data.enrichment.person.name,
      }).catch(() => null);
      setLinkedPerson(linked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  function go(id: Tab) {
    setTab(id);
    setNavOpen(false);
  }

  return (
    <div className="app-shell">
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">Si</div>
          <div>
            <div className="brand-name">Sales-Intel</div>
            <div className="brand-sub">Intelligence Platform</div>
          </div>
        </div>

        {NAV_GROUPS.map((group) => (
          <div className="nav-group" key={group.label}>
            <div className="nav-group-label">{group.label}</div>
            {group.items.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${tab === item.id ? "active" : ""}`}
                onClick={() => go(item.id)}
                aria-current={tab === item.id ? "page" : undefined}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <AuthBar />
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button className="nav-toggle" onClick={() => setNavOpen((o) => !o)} aria-label="Toggle navigation">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
            </button>
            <h1 className="topbar-title">{PAGE_TITLES[tab]}</h1>
          </div>
          <div className="topbar-actions">
            <button className="theme-toggle" onClick={() => setDarkMode((d) => !d)} aria-label="Toggle theme">
              {darkMode ? "☀" : "☾"}
            </button>
          </div>
        </header>

        <main className="main-content" key={tab}>
          {tab === "research" ? (
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
              {error && <div className="error-banner">{error}</div>}
              {result && <ResultView result={result} linkedPerson={linkedPerson} />}
              {!result && !error && !loading && (
                <p className="empty-state">
                  Enter a name or company to generate a research profile, AI summary, and a draft
                  outreach email.
                </p>
              )}
            </>
          ) : tab === "companies" ? (
            <CompanySearchView />
          ) : tab === "queue" ? (
            <QueueView />
          ) : tab === "career" ? (
            <CareerView />
          ) : tab === "history" ? (
            <HistoryView />
          ) : tab === "analyze" ? (
            <AnalyzeView />
          ) : tab === "newstrends" ? (
            <NewsAndTrendsView />
          ) : tab === "discover" ? (
            <DiscoverView />
          ) : tab === "reports" ? (
            <ReportsView />
          ) : tab === "search" ? (
            <SearchView />
          ) : tab === "saved" ? (
            <SavedView />
          ) : (
            <AnalyticsView />
          )}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

function ResultView({
  result,
  linkedPerson,
}: {
  result: ResearchResponse;
  linkedPerson: CrmPerson | null;
}) {
  const { enrichment, aiSummary, outreachDraft } = result;
  const { person, company, sources } = enrichment;

  return (
    <div className="result">
      {linkedPerson && (
        <div className="linked-banner">
          Already tracked from LinkedIn as <strong>{linkedPerson.name}</strong> — status:{" "}
          <span className="badge badge-medium">{linkedPerson.status.replace("_", " ")}</span>,{" "}
          {linkedPerson.followUpCount} follow-up{linkedPerson.followUpCount === 1 ? "" : "s"} so
          far. Check the Queue tab for their existing thread before starting a new one here.
        </div>
      )}
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
          {company.techStack && Object.values(company.techStack).some((v) => v && v.length > 0) ? (
            <div className="tech-stack">
              {(
                [
                  ["Frontend", company.techStack.frontend],
                  ["Backend", company.techStack.backend],
                  ["CMS", company.techStack.cms],
                  ["Analytics", company.techStack.analytics],
                  ["Marketing", company.techStack.marketing],
                  ["CDN", company.techStack.cdn],
                  ["Hosting", company.techStack.hosting],
                  ["Security", company.techStack.security],
                ] as [string, string[] | undefined][]
              )
                .filter(([, items]) => items && items.length > 0)
                .map(([label, items]) => (
                  <div className="tech-category" key={label}>
                    <span className="tech-category-label">{label}</span>
                    <div className="tag-row">
                      {items!.map((t) => (
                        <span className="tag" key={t}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          ) : company.technologies && company.technologies.length > 0 ? (
            <div className="tag-row">
              {company.technologies.map((t) => (
                <span className="tag" key={t}>
                  {t}
                </span>
              ))}
            </div>
          ) : null}
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
