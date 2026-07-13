import { useState, type FormEvent } from "react";
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

export default function CompanySearchView() {
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompanySearchResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoaded, setLeadsLoaded] = useState(false);

  async function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSelected(new Set());
    try {
      const data = await searchCompany(company.trim(), domain.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Company search failed");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelected(index: number) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!result) return;
    setSelected((current) =>
      current.size === result.people.length ? new Set() : new Set(result.people.map((_, i) => i))
    );
  }

  async function handleAddSelected() {
    if (!result || selected.size === 0) return;
    setSaving(true);
    setSavedMessage(null);
    try {
      const chosen: CandidateLead[] = Array.from(selected).map((i) => result.people[i]);
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
              <div className="lead-table">
                <div className="lead-row lead-header">
                  <input
                    type="checkbox"
                    checked={selected.size === result.people.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                  <span>Name</span>
                  <span>Title</span>
                  <span>Email</span>
                  <span>Confidence</span>
                </div>
                {result.people.map((person, i) => (
                  <div className="lead-row" key={`${person.email ?? person.name}-${i}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggleSelected(i)}
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
