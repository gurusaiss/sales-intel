import { useState } from "react";
import { toast } from "./components/Toast";

interface AnalysisResult {
  id: string;
  status: "pending" | "processing" | "done" | "failed";
  url: string;
  pageTitle?: string;
  techStack?: Record<string, string[]>;
  aiResult?: {
    company_name?: string;
    tagline?: string;
    executive_summary?: string;
    industry?: string;
    niche?: string;
    target_customers?: string;
    business_model?: string;
    pricing_model?: string;
    product_features?: string[];
    competitive_advantages?: string[];
    competitor_domains?: string[];
    keywords?: string[];
    seo_opportunities?: string[];
    headquarters?: string;
    founded?: string;
    team_size?: string;
    investor_summary?: string;
    developer_summary?: string;
    founder_summary?: string;
    sales_hook?: string;
    // Enhanced fields
    products?: string[];
    services?: string[];
    icp?: string;
    social_channels?: string[];
    has_pricing_page?: boolean;
    has_blog?: boolean;
    has_docs?: boolean;
    has_careers?: boolean;
    pricing_tiers?: Array<{ name: string; price?: string; features?: string[] }>;
  };
  vulnerabilities?: Array<{ techName: string; cveId: string; severity: string; summary: string }>;
  errorMessage?: string;
}

interface ExtractedContacts {
  emails: Array<{ email: string; type: string; context: string }>;
  phones: Array<{ number: string; type: string; raw: string }>;
  socialLinks: Array<{ platform: string; url: string; username?: string }>;
  bookingLinks: Array<{ platform: string; url: string }>;
  contactPages: string[];
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

async function apiFetch(path: string, opts?: RequestInit) {
  const token = localStorage.getItem("salesIntelToken");
  const headers: Record<string, string> = { "content-type": "application/json", ...(opts?.headers as Record<string, string> ?? {}) };
  if (API_KEY) headers["x-api-key"] = API_KEY;
  if (token) headers["authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

function BoolBadge({ label, value }: { label: string; value?: boolean }) {
  if (value === undefined || value === null) return null;
  return (
    <span className={`bool-badge ${value ? "bool-yes" : "bool-no"}`}>
      {value ? "✓" : "✗"} {label}
    </span>
  );
}

type ContactTab = "emails" | "phones" | "social" | "booking" | "pages";

export default function AnalyzeView() {
  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [contacts, setContacts] = useState<ExtractedContacts | null>(null);
  const [contactTab, setContactTab] = useState<ContactTab>("emails");
  const [saving, setSaving] = useState(false);

  async function startAnalysis(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setAnalysis(null);
    setContacts(null);
    try {
      const data = await apiFetch("/analyze", { method: "POST", body: JSON.stringify({ url: url.trim() }) });
      setAnalysis(data);
      setPolling(true);
      pollStatus(data.id);
    } catch (err) {
      toast("Failed to start analysis: " + (err instanceof Error ? err.message : "Unknown error"), "error");
    } finally {
      setLoading(false);
    }
  }

  function pollStatus(id: string) {
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch(`/analyze/${id}`);
        setAnalysis(data);
        if (data.status === "done" || data.status === "failed") {
          clearInterval(interval);
          setPolling(false);
          if (data.status === "done") {
            toast("Analysis complete!", "success");
            apiFetch("/analyze/" + data.id + "/contacts")
              .then((d) => setContacts(d.contacts))
              .catch(() => {});
          } else {
            toast("Analysis failed: " + (data.errorMessage ?? "Unknown error"), "error");
          }
        }
      } catch { clearInterval(interval); setPolling(false); }
    }, 2000);
  }

  async function saveBookmark() {
    if (!analysis) return;
    setSaving(true);
    try {
      await apiFetch("/analyze/" + analysis.id + "/bookmark", { method: "POST" });
      toast("Saved to bookmarks!", "success");
    } catch (err) {
      toast("Could not save: " + (err instanceof Error ? err.message : "Unknown error"), "error");
    } finally {
      setSaving(false);
    }
  }

  function downloadUrl(format: "json" | "csv" | "md") {
    if (!analysis) return "#";
    const token = localStorage.getItem("salesIntelToken");
    const base = `${API_BASE}/analyze/${analysis.id}/download/${format}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  const ai = analysis?.aiResult;
  const hasContacts = contacts && (
    contacts.emails.length > 0 ||
    contacts.phones.length > 0 ||
    contacts.socialLinks.length > 0 ||
    contacts.bookingLinks.length > 0 ||
    contacts.contactPages.length > 0
  );

  const contactTabCounts: Record<ContactTab, number> = {
    emails: contacts?.emails.length ?? 0,
    phones: contacts?.phones.length ?? 0,
    social: contacts?.socialLinks.length ?? 0,
    booking: contacts?.bookingLinks.length ?? 0,
    pages: contacts?.contactPages.length ?? 0,
  };

  return (
    <div className="intel-view">
      <div className="intel-header">
        <h2>Website Analyzer</h2>
        <p className="intel-subtitle">Deep business intelligence from any website — tech stack, AI summary, CVEs, competitors, contacts</p>
      </div>

      <form className="analyze-form" onSubmit={startAnalysis}>
        <input
          className="query-input"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://stripe.com"
          aria-label="Website URL"
        />
        <button type="submit" disabled={loading || polling}>
          {polling ? "Analyzing…" : loading ? "Starting…" : "Analyze Website"}
        </button>
      </form>

      {analysis && (
        <div className="analysis-result">
          {(analysis.status === "pending" || analysis.status === "processing") && (
            <div className="status-banner">
              <span className="spinner" /> {analysis.status === "pending" ? "Queued…" : "Analyzing website — extracting tech stack, running AI, scanning CVEs…"}
            </div>
          )}

          {analysis.status === "done" && ai && (
            <>
              <section className="card">
                <div className="card-title-row">
                  <h2>{ai.company_name ?? analysis.pageTitle ?? analysis.url}</h2>
                  <button
                    className="btn-secondary btn-sm"
                    onClick={saveBookmark}
                    disabled={saving}
                    title="Save to bookmarks"
                  >
                    {saving ? "Saving…" : "☆ Save"}
                  </button>
                </div>
                {ai.tagline && <p className="subline">{ai.tagline}</p>}
                {ai.sales_hook && (
                  <div className="sales-hook">
                    <span className="card-label">Sales hook</span>
                    <p>{ai.sales_hook}</p>
                  </div>
                )}
                {ai.executive_summary && <p style={{ marginTop: "0.75rem" }}>{ai.executive_summary}</p>}

                {/* Page presence badges */}
                {(ai.has_pricing_page !== undefined || ai.has_blog !== undefined || ai.has_docs !== undefined || ai.has_careers !== undefined) && (
                  <div className="bool-badge-row" style={{ marginTop: "0.75rem" }}>
                    <BoolBadge label="Pricing page" value={ai.has_pricing_page} />
                    <BoolBadge label="Blog" value={ai.has_blog} />
                    <BoolBadge label="Docs" value={ai.has_docs} />
                    <BoolBadge label="Careers" value={ai.has_careers} />
                  </div>
                )}

                <div className="field-grid" style={{ marginTop: "0.75rem" }}>
                  <Field label="Industry" value={ai.industry} />
                  <Field label="Niche" value={ai.niche} />
                  <Field label="Target customers" value={ai.target_customers} />
                  <Field label="ICP" value={ai.icp} />
                  <Field label="Business model" value={ai.business_model} />
                  <Field label="Pricing" value={ai.pricing_model} />
                  <Field label="Headquarters" value={ai.headquarters} />
                  <Field label="Founded" value={ai.founded} />
                  <Field label="Team size" value={ai.team_size} />
                </div>
              </section>

              {/* Products & Services */}
              {((ai.products && ai.products.length > 0) || (ai.services && ai.services.length > 0)) && (
                <section className="card">
                  {ai.products && ai.products.length > 0 && (
                    <>
                      <span className="card-label">Products</span>
                      <div className="tag-row" style={{ marginBottom: ai.services && ai.services.length > 0 ? "0.75rem" : 0 }}>
                        {ai.products.map((p) => <span className="tag tag-product" key={p}>{p}</span>)}
                      </div>
                    </>
                  )}
                  {ai.services && ai.services.length > 0 && (
                    <>
                      <span className="card-label">Services</span>
                      <div className="tag-row">
                        {ai.services.map((s) => <span className="tag tag-service" key={s}>{s}</span>)}
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* Pricing Tiers */}
              {ai.pricing_tiers && ai.pricing_tiers.length > 0 && (
                <section className="card">
                  <span className="card-label">Pricing Tiers</span>
                  <div className="pricing-tiers">
                    {ai.pricing_tiers.map((tier, i) => (
                      <div className="pricing-tier" key={i}>
                        <div className="pricing-tier-header">
                          <span className="pricing-tier-name">{tier.name}</span>
                          {tier.price && <span className="pricing-tier-price">{tier.price}</span>}
                        </div>
                        {tier.features && tier.features.length > 0 && (
                          <ul className="pricing-tier-features">
                            {tier.features.map((f, j) => <li key={j}>{f}</li>)}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Social Channels */}
              {ai.social_channels && ai.social_channels.length > 0 && (
                <section className="card">
                  <span className="card-label">Social Channels</span>
                  <div className="tag-row">
                    {ai.social_channels.map((s) => <span className="tag tag-social" key={s}>{s}</span>)}
                  </div>
                </section>
              )}

              {analysis.techStack && Object.values(analysis.techStack).some((v) => v.length > 0) && (
                <section className="card">
                  <span className="card-label">Tech Stack</span>
                  <div className="tech-stack">
                    {Object.entries(analysis.techStack).filter(([, v]) => v.length > 0).map(([cat, items]) => (
                      <div className="tech-category" key={cat}>
                        <span className="tech-category-label">{cat}</span>
                        <div className="tag-row">{items.map((t) => <span className="tag" key={t}>{t}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {ai.product_features && ai.product_features.length > 0 && (
                <section className="card">
                  <span className="card-label">Product Features</span>
                  <ul className="bullet-list">{ai.product_features.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </section>
              )}

              {ai.competitive_advantages && ai.competitive_advantages.length > 0 && (
                <section className="card">
                  <span className="card-label">Competitive Advantages</span>
                  <ul className="bullet-list">{ai.competitive_advantages.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </section>
              )}

              {ai.competitor_domains && ai.competitor_domains.length > 0 && (
                <section className="card">
                  <span className="card-label">Competitors</span>
                  <div className="tag-row">{ai.competitor_domains.map((d) => <span className="tag" key={d}>{d}</span>)}</div>
                </section>
              )}

              {ai.seo_opportunities && ai.seo_opportunities.length > 0 && (
                <section className="card">
                  <span className="card-label">SEO Opportunities</span>
                  <ul className="bullet-list">{ai.seo_opportunities.map((f, i) => <li key={i}>{f}</li>)}</ul>
                </section>
              )}

              {analysis.vulnerabilities && analysis.vulnerabilities.length > 0 && (
                <section className="card">
                  <span className="card-label">Security Vulnerabilities (CVEs)</span>
                  <div className="cve-list">
                    {analysis.vulnerabilities.map((v) => (
                      <div key={v.cveId} className="cve-item">
                        <span className={`cve-severity cve-${v.severity.toLowerCase()}`}>{v.severity}</span>
                        <div>
                          <span className="cve-id">{v.cveId}</span>
                          <span className="cve-tech"> · {v.techName}</span>
                          <p className="cve-summary">{v.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Contacts Section */}
              {hasContacts && contacts && (
                <section className="card contacts-card">
                  <div className="contacts-card-header">
                    <span className="card-label" style={{ margin: 0 }}>Extracted Contacts</span>
                    <div className="download-btn-row">
                      <a
                        className="btn-secondary btn-sm"
                        href={downloadUrl("json")}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        JSON
                      </a>
                      <a
                        className="btn-secondary btn-sm"
                        href={downloadUrl("csv")}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        CSV
                      </a>
                      <a
                        className="btn-secondary btn-sm"
                        href={downloadUrl("md")}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Markdown
                      </a>
                    </div>
                  </div>

                  <div className="contact-tabs">
                    {(["emails", "phones", "social", "booking", "pages"] as ContactTab[]).map((tab) => {
                      const labels: Record<ContactTab, string> = {
                        emails: "Emails",
                        phones: "Phones",
                        social: "Social",
                        booking: "Booking",
                        pages: "Contact Pages",
                      };
                      return (
                        <button
                          key={tab}
                          className={`contact-tab${contactTab === tab ? " active" : ""}`}
                          onClick={() => setContactTab(tab)}
                        >
                          {labels[tab]}
                          {contactTabCounts[tab] > 0 && (
                            <span className="contact-tab-count">{contactTabCounts[tab]}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="contact-tab-content">
                    {contactTab === "emails" && (
                      contacts.emails.length === 0
                        ? <p className="empty-state">No emails found</p>
                        : <ul className="contact-list">
                            {contacts.emails.map((e, i) => (
                              <li key={i} className="contact-item">
                                <span className="contact-badge contact-badge-email">{e.type || "email"}</span>
                                <a href={`mailto:${e.email}`} className="contact-value">{e.email}</a>
                                {e.context && <span className="contact-context">{e.context}</span>}
                              </li>
                            ))}
                          </ul>
                    )}

                    {contactTab === "phones" && (
                      contacts.phones.length === 0
                        ? <p className="empty-state">No phone numbers found</p>
                        : <ul className="contact-list">
                            {contacts.phones.map((p, i) => (
                              <li key={i} className="contact-item">
                                <span className="contact-badge contact-badge-phone">{p.type || "phone"}</span>
                                <a href={`tel:${p.number}`} className="contact-value">{p.number || p.raw}</a>
                              </li>
                            ))}
                          </ul>
                    )}

                    {contactTab === "social" && (
                      contacts.socialLinks.length === 0
                        ? <p className="empty-state">No social links found</p>
                        : <ul className="contact-list">
                            {contacts.socialLinks.map((s, i) => (
                              <li key={i} className="contact-item">
                                <span className="contact-badge contact-badge-social">{s.platform}</span>
                                {s.username && <span className="contact-username">@{s.username}</span>}
                                <a href={s.url} target="_blank" rel="noopener noreferrer" className="contact-value contact-link">
                                  {s.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                    )}

                    {contactTab === "booking" && (
                      contacts.bookingLinks.length === 0
                        ? <p className="empty-state">No booking links found</p>
                        : <ul className="contact-list">
                            {contacts.bookingLinks.map((b, i) => (
                              <li key={i} className="contact-item">
                                <span className="contact-badge contact-badge-booking">{b.platform}</span>
                                <a href={b.url} target="_blank" rel="noopener noreferrer" className="contact-value contact-link">
                                  {b.url}
                                </a>
                              </li>
                            ))}
                          </ul>
                    )}

                    {contactTab === "pages" && (
                      contacts.contactPages.length === 0
                        ? <p className="empty-state">No contact pages found</p>
                        : <ul className="contact-list">
                            {contacts.contactPages.map((page, i) => (
                              <li key={i} className="contact-item">
                                <span className="contact-badge contact-badge-page">page</span>
                                <a href={page} target="_blank" rel="noopener noreferrer" className="contact-value contact-link">
                                  {page}
                                </a>
                              </li>
                            ))}
                          </ul>
                    )}
                  </div>
                </section>
              )}

              <div className="role-summaries">
                {ai.investor_summary && (
                  <section className="card highlight">
                    <span className="card-label">Investor view</span>
                    <p>{ai.investor_summary}</p>
                  </section>
                )}
                {ai.developer_summary && (
                  <section className="card highlight">
                    <span className="card-label">Developer view</span>
                    <p>{ai.developer_summary}</p>
                  </section>
                )}
                {ai.founder_summary && (
                  <section className="card highlight">
                    <span className="card-label">Founder view</span>
                    <p>{ai.founder_summary}</p>
                  </section>
                )}
              </div>
            </>
          )}

          {analysis.status === "failed" && (
            <div className="error-banner">{analysis.errorMessage ?? "Analysis failed"}</div>
          )}
        </div>
      )}
    </div>
  );
}
