interface AppRow {
  initials: string;
  title: string;
  description: string;
  tab: string;
}

interface AppGroup {
  id: string;
  label: string;
  apps: AppRow[];
}

interface Props {
  onNavigate: (tab: string) => void;
}

export default function AppsView({ onNavigate }: Props) {
  const groups: AppGroup[] = [
    {
      id: "companyiq",
      label: "CompanyIQ Suite",
      apps: [
        { initials: "CI", tab: "company-intel", title: "Company Intel", description: "13-section deep-dive: founders, culture, red flags, strategy" },
        { initials: "JD", tab: "company-intel", title: "JD Fit Score", description: "Fit & ATS score, skill gaps, tailored resume advice" },
        { initials: "Cx", tab: "company-intel", title: "Compare", description: "Head-to-head with comp estimates and verdict" },
        { initials: "Sa", tab: "company-intel", title: "Salary Intel", description: "Market comp bands, negotiation tips, level benchmarks" },
        { initials: "CL", tab: "company-intel", title: "Cover Letter", description: "280–340 word letters grounded in your resume" },
      ],
    },
    {
      id: "tech",
      label: "Tech Intelligence",
      apps: [
        { initials: "Wz", tab: "analyze", title: "Site Analyzer", description: "Detect tech stack, CMS, analytics, CDN, security layers" },
        { initials: "Nt", tab: "newstrends", title: "News & Trends", description: "Live signals, HN tech trends, curated industry news" },
        { initials: "Dv", tab: "discover", title: "Discover", description: "Explore companies by sector, funding, and tech signals" },
      ],
    },
    {
      id: "toolkit",
      label: "Sales Toolkit",
      apps: [
        { initials: "Pr", tab: "research", title: "Person Research", description: "Enrich a contact with AI summary and outreach draft" },
        { initials: "Co", tab: "companies", title: "Companies", description: "Search and enrich company profiles for prospecting" },
        { initials: "Rp", tab: "reports", title: "Reports", description: "Generate intelligence reports on prospects" },
        { initials: "Sx", tab: "search", title: "Search", description: "Full-text search across all contacts and companies" },
      ],
    },
    {
      id: "career",
      label: "Career Tools",
      apps: [
        { initials: "Ca", tab: "career", title: "Career Hub", description: "Job tracking, resume tailoring, AI match scoring" },
        { initials: "Oq", tab: "queue", title: "Outreach Queue", description: "Manage follow-ups, cadences and contact pipeline" },
      ],
    },
  ];

  return (
    <div className="apps-page">
      <div className="apps-hero">
        <h2>All Tools</h2>
        <p className="subline">Jump straight in — every tool in one place.</p>
      </div>

      {groups.map((group) => (
        <div key={group.id} className="apps-group">
          <div className="apps-group-hdr">
            <span className="apps-group-accent" />
            <span className="apps-group-label">{group.label}</span>
          </div>
          <div className="apps-list">
            {group.apps.map((app) => (
              <div
                key={`${app.initials}-${app.title}`}
                className="apps-row"
                onClick={() => onNavigate(app.tab)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && onNavigate(app.tab)}
              >
                <div className="apps-icon">{app.initials}</div>
                <div className="apps-info">
                  <span className="apps-info-title">{app.title}</span>
                  <span className="apps-info-desc">{app.description}</span>
                </div>
                <span className="apps-row-arrow">→</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
