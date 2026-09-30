interface AppCard {
  id: string;
  title: string;
  description: string;
  emoji: string;
  badge?: string;
  onClick: () => void;
}

interface AppGroup {
  id: string;
  label: string;
  emoji: string;
  color: string;
  apps: AppCard[];
}

interface Props {
  onNavigate: (tab: string) => void;
}

export default function AppsView({ onNavigate }: Props) {
  const groups: AppGroup[] = [
    {
      id: "companyiq",
      label: "CompanyIQ Suite",
      emoji: "🏢",
      color: "#6366f1",
      apps: [
        {
          id: "intel",
          title: "Company Intel",
          description: "13-section deep-dive — founders, culture, red flags, strategy",
          emoji: "🔍",
          badge: "AI",
          onClick: () => onNavigate("company-intel"),
        },
        {
          id: "jdfit",
          title: "JD Fit Analyser",
          description: "Fit score, ATS score, skill gap and tailored resume advice",
          emoji: "📋",
          badge: "AI",
          onClick: () => onNavigate("company-intel"),
        },
        {
          id: "compare",
          title: "Compare Companies",
          description: "Head-to-head comparison with comp estimates and pros/cons",
          emoji: "⚖️",
          badge: "AI",
          onClick: () => onNavigate("company-intel"),
        },
        {
          id: "salary",
          title: "Salary Intel",
          description: "AI-estimated comp bands, negotiation tips, level benchmarks",
          emoji: "💰",
          badge: "AI",
          onClick: () => onNavigate("company-intel"),
        },
        {
          id: "coverletter",
          title: "Cover Letter",
          description: "Personalised 280–340 word letters grounded in your resume",
          emoji: "✉️",
          badge: "AI",
          onClick: () => onNavigate("company-intel"),
        },
      ],
    },
    {
      id: "tech",
      label: "Tech Intelligence",
      emoji: "⚙️",
      color: "#0ea5e9",
      apps: [
        {
          id: "analyze",
          title: "Website Analyzer",
          description: "Detect tech stack, CMS, analytics, CDN and marketing tools",
          emoji: "🌐",
          onClick: () => onNavigate("analyze"),
        },
        {
          id: "newstrends",
          title: "News & Trends",
          description: "Live market signals, HN tech trends, curated industry news",
          emoji: "📰",
          onClick: () => onNavigate("newstrends"),
        },
        {
          id: "discover",
          title: "Discover",
          description: "Explore companies by sector, funding stage, and tech signals",
          emoji: "🧭",
          onClick: () => onNavigate("discover"),
        },
      ],
    },
    {
      id: "toolkit",
      label: "Sales Toolkit",
      emoji: "🛠️",
      color: "#f59e0b",
      apps: [
        {
          id: "research",
          title: "Person Research",
          description: "Enrich a contact with AI summary, bio signals and outreach draft",
          emoji: "🎯",
          onClick: () => onNavigate("research"),
        },
        {
          id: "companies",
          title: "Company Search",
          description: "Search and enrich company profiles for prospecting",
          emoji: "🏛️",
          onClick: () => onNavigate("companies"),
        },
        {
          id: "reports",
          title: "Reports",
          description: "Generate structured intelligence reports on prospects",
          emoji: "📄",
          onClick: () => onNavigate("reports"),
        },
        {
          id: "search",
          title: "Search",
          description: "Full-text search across all saved contacts and companies",
          emoji: "🔎",
          onClick: () => onNavigate("search"),
        },
      ],
    },
    {
      id: "careers",
      label: "Career Tools",
      emoji: "💼",
      color: "#22c55e",
      apps: [
        {
          id: "career",
          title: "Career Hub",
          description: "Job tracking, resume tailoring, match scoring and prep tools",
          emoji: "📈",
          onClick: () => onNavigate("career"),
        },
        {
          id: "queue",
          title: "Outreach Queue",
          description: "Manage follow-ups, cadences and contact pipeline",
          emoji: "📥",
          onClick: () => onNavigate("queue"),
        },
      ],
    },
  ];

  return (
    <div className="result">
      <style>{`
        .apps-hero { margin-bottom:2rem; }
        .apps-hero h2 { font-size:1.5rem; font-weight:700; margin:0 0 0.35rem; }
        .apps-hero p { color:var(--muted); font-size:0.9rem; margin:0; }
        .apps-group { margin-bottom:2rem; }
        .apps-group-header { display:flex; align-items:center; gap:0.6rem; margin-bottom:1rem; }
        .apps-group-pill { width:10px; height:10px; border-radius:50%; }
        .apps-group-label { font-size:0.75rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:var(--muted); }
        .apps-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0.75rem; }
        @media(max-width:480px){ .apps-grid { grid-template-columns:1fr 1fr; } }
        .app-card { display:flex; flex-direction:column; gap:0.5rem; padding:1rem; background:var(--surface); border:1.5px solid var(--border); border-radius:var(--radius); cursor:pointer; transition:border-color 0.15s,transform 0.1s,box-shadow 0.15s; user-select:none; }
        .app-card:hover { border-color:var(--primary); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,0.08); }
        .app-card:active { transform:translateY(0); }
        .app-card-top { display:flex; align-items:flex-start; justify-content:space-between; }
        .app-emoji { font-size:1.5rem; line-height:1; }
        .app-ai-badge { font-size:0.65rem; font-weight:700; letter-spacing:0.06em; padding:0.15rem 0.45rem; border-radius:999px; background:var(--primary); color:#fff; }
        .app-title { font-weight:700; font-size:0.9rem; margin:0; color:var(--text); }
        .app-desc { font-size:0.78rem; color:var(--muted); line-height:1.5; margin:0; flex:1; }
      `}</style>

      <div className="apps-hero">
        <h2>My Apps</h2>
        <p>All tools in one place — click any card to jump straight in.</p>
      </div>

      {groups.map((group) => (
        <div key={group.id} className="apps-group">
          <div className="apps-group-header">
            <div className="apps-group-pill" style={{ background: group.color }} />
            <span className="apps-group-label">{group.emoji} {group.label}</span>
          </div>
          <div className="apps-grid">
            {group.apps.map((app) => (
              <div key={app.id} className="app-card" onClick={app.onClick}>
                <div className="app-card-top">
                  <span className="app-emoji">{app.emoji}</span>
                  {app.badge && <span className="app-ai-badge">{app.badge}</span>}
                </div>
                <p className="app-title">{app.title}</p>
                <p className="app-desc">{app.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
