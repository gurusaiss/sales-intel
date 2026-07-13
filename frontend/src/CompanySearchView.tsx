import { useState, useMemo, type FormEvent } from "react";
import {
  searchCompany,
  addLeadsToCrm,
  fetchLeads,
  updateLeadStatus,
  deleteLeadById,
  downloadLeadsExport,
  type CompanySearchResult,
  type CandidateLead,
  type Lead,
} from "./api";

const DEPARTMENT_OPTIONS = [
  { value: "all", label: "All departments" },
  { value: "founders", label: "Founders" },
  { value: "executives", label: "Executives" },
  { value: "engineering", label: "Engineering" },
  { value: "product", label: "Product" },
  { value: "hr", label: "HR" },
  { value: "recruiting", label: "Recruiters" },
  { value: "sales", label: "Sales" },
  { value: "marketing", label: "Marketing" },
  { value: "finance", label: "Finance" },
  { value: "operations", label: "Operations" },
  { value: "customer_success", label: "Customer Success" },
  { value: "legal", label: "Legal" },
  { value: "security", label: "Security" },
  { value: "cloud", label: "Cloud" },
  { value: "ai", label: "AI" },
  { value: "data", label: "Data" },
  { value: "support", label: "Support" },
];

const TIER_LABELS: Record<string, string> = {
  leadership: "Leadership",
  hiring: "Hiring & Management",
  employee: "Employees",
  unclassified: "Unclassified",
};

function candidateKey(person: CandidateLead, index: number): string {
  return `${person.email ?? person.name}-${index}`;
}

export default function CompanySearchView() {
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanySearchResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [department, setDepartment] = useState("all");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    setKeyword("");
    setDepartment("all");
    try {
      const data = await searchCompany(company.trim(), domain.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Company search failed");
    } finally {
      setLoading(false);
    }
  }

  const indexedPeople = useMemo(
    () => (result?.people ?? []).map((person, i) => ({ person, key: candidateKey(person, i) })),
    [result]
  );

  const filteredPeople = useMemo(() => {
    const keywordLower = keyword.trim().toLowerCase();
    return indexedPeople.filter(({ person }) => {
      if (department !== "all" && person.department !== department) return false;
      if (keywordLower && !`${person.name} ${person.title ?? ""}`.toLowerCase().includes(keywordLower)) {
        return false;
      }
      return true;
    });
  }, [indexedPeople, keyword, department]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filteredPeople> = {
      leadership: [],
      hiring: [],
      employee: [],
      unclassified: [],
    };
    for (const item of filteredPeople) {
      const tier = item.person.tier ?? "unclassified";
      groups[tier].push(item);
    }
    return groups;
  }, [filteredPeople]);

  function toggleSelected(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleSelectAllInGroup(items: typeof filteredPeople) {
    const keys = items.map((i) => i.key);
    const allSelected = keys.every((k) => selected.has(k));
    setSelected((current) => {
      const next = new Set(current);
      keys.forEach((k) => (allSelected ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  async function handleAddSelected() {
    if (!result || selected.size === 0) return;
    setSaving(true);
    setSavedMessage(null);
    try {
      const chosen: CandidateLead[] = indexedPeople
        .filter(({ key }) => selected.has(key))
        .map(({ person }) => person);
      await addLeadsToCrm(result.company.name, result.company.domain, result.source, chosen);
      setSavedMessage(`Added ${chosen.length} lead${chosen.length === 1 ? "" : "s"} to your CRM.`);
      setSelected(new Set());
      if (leadsLoaded) await loadLeads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add leads");
    } finally {
      setSaving(false);
    }
  }

  async function loadLeads() {
    try {
      const data = await fetchLeads();
      setLeads(data);
      setLeadsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leads");
    }
  }

  async function handleLeadStatus(id: string, status: "contacted" | "archived") {
    await updateLeadStatus(id, status);
    setLeads((current) => current.map((l) => (l.id === id ? { ...l, status } : l)));
  }

  async function handleDeleteLead(id: string) {
    await deleteLeadById(id);
    setLeads((current) => current.filter((l) => l.id !== id));
  }

  async function handleExport(format: "csv" | "json") {
    try {
      await downloadLeadsExport(format);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="result">
      <form className="search-form" onSubmit={handleSearch}>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Company name — e.g. Amazon"
          aria-label="Company name"
          className="query-input"
        />
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Company domain — amazon.com"
          aria-label="Company domain"
          className="domain-input"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching…" : "Find people"}
        </button>
      </form>
      <p className="form-hint">
        Sourced from a compliant data provider (Hunter/Snov domain search), never from scraping
        LinkedIn's own search or company pages.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {result && (
        <section className="card">
          <div className="queue-card-header">
            <div>
              <h2>{result.company.name}</h2>
              <p className="subline">{result.company.description}</p>
            </div>
            <span className="badge badge-medium">{result.source}</span>
          </div>

          {result.people.length === 0 ? (
            <p className="subline">No candidates found for this domain.</p>
          ) : (
            <>
              <div className="search-form" style={{ marginTop: 0 }}>
                <input
                  type="text"
                  className="query-input"
                  placeholder="Filter by keyword — e.g. Python"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  aria-label="Keyword filter"
                />
                <select
                  className="domain-input"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  aria-label="Department filter"
                >
                  {DEPARTMENT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {filteredPeople.length === 0 ? (
                <p className="subline">No one matches this filter.</p>
              ) : (
                (["leadership", "hiring", "employee", "unclassified"] as const).map((tier) => {
                  const items = grouped[tier];
                  if (items.length === 0) return null;
                  return (
                    <div key={tier} className="tier-section">
                      <div className="tier-header">
                        <span>
                          {TIER_LABELS[tier]} ({items.length})
                        </span>
                        <button className="ghost-button" onClick={() => toggleSelectAllInGroup(items)}>
                          Select all
                        </button>
                      </div>
                      <div className="lead-table">
                        <div className="lead-row lead-header">
                          <span />
                          <span>Name</span>
                          <span>Title</span>
                          <span>Email</span>
                          <span>Confidence</span>
                        </div>
                        {items.map(({ person, key }) => (
                          <div className="lead-row" key={key}>
                            <input
                              type="checkbox"
                              checked={selected.has(key)}
                              onChange={() => toggleSelected(key)}
                              aria-label={`Select ${person.name}`}
                            />
                            <span>{person.name}</span>
                            <span>{person.title ?? "—"}</span>
                            <span>{person.email ?? "—"}</span>
                            <span className={`badge badge-${person.emailConfidence ?? "unverified"}`}>
                              {person.emailConfidence ?? "unverified"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}

              <div className="queue-actions">
                <button
                  className="ghost-button accent"
                  disabled={selected.size === 0 || saving}
                  onClick={handleAddSelected}
                >
                  {saving ? "Adding…" : `Add ${selected.size || ""} selected to CRM`}
                </button>
              </div>
              {savedMessage && <p className="form-hint">{savedMessage}</p>}
            </>
          )}
        </section>
      )}

      <section className="card">
        <div className="queue-card-header">
          <h2>Saved leads</h2>
          <div className="queue-actions">
            <button className="ghost-button" onClick={loadLeads}>
              {leadsLoaded ? "Refresh" : "Load leads"}
            </button>
            <button className="ghost-button" onClick={() => handleExport("csv")}>
              Export CSV
            </button>
            <button className="ghost-button" onClick={() => handleExport("json")}>
              Export JSON
            </button>
          </div>
        </div>

        {leadsLoaded && leads.length === 0 && (
          <p className="subline">No leads saved yet — search a company above and add some.</p>
        )}

        {leads.length > 0 && (
          <div className="lead-table">
            <div className="lead-row lead-header">
              <span />
              <span>Name</span>
              <span>Company</span>
              <span>Email</span>
              <span>Status</span>
            </div>
            {leads.map((lead) => (
              <div className="lead-row" key={lead.id}>
                <span />
                <span>{lead.name}</span>
                <span>{lead.company ?? "—"}</span>
                <span>{lead.publicEmail ?? "—"}</span>
                <span className="lead-status-cell">
                  <span className="badge badge-medium">{lead.status}</span>
                  <button className="ghost-button" onClick={() => handleLeadStatus(lead.id, "contacted")}>
                    Contacted
                  </button>
                  <button className="ghost-button" onClick={() => handleLeadStatus(lead.id, "archived")}>
                    Archive
                  </button>
                  <button className="ghost-button danger" onClick={() => handleDeleteLead(lead.id)}>
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
