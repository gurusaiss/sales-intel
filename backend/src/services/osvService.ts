export interface CveResult {
  techName: string;
  packageName: string;
  cveId: string;
  severity: string;
  summary: string;
}

// Maps display tech names to (package, ecosystem) for OSV.dev queries
const TECH_PACKAGE_MAP: Record<string, { pkg: string; ecosystem: string }> = {
  "React": { pkg: "react", ecosystem: "npm" },
  "Next.js": { pkg: "next", ecosystem: "npm" },
  "Vue.js": { pkg: "vue", ecosystem: "npm" },
  "Angular": { pkg: "@angular/core", ecosystem: "npm" },
  "Svelte": { pkg: "svelte", ecosystem: "npm" },
  "jQuery": { pkg: "jquery", ecosystem: "npm" },
  "Express": { pkg: "express", ecosystem: "npm" },
  "Fastify": { pkg: "fastify", ecosystem: "npm" },
  "Webpack": { pkg: "webpack", ecosystem: "npm" },
  "Vite": { pkg: "vite", ecosystem: "npm" },
  "WordPress": { pkg: "wordpress", ecosystem: "packagist" },
  "Drupal": { pkg: "drupal/core", ecosystem: "packagist" },
  "Django": { pkg: "django", ecosystem: "PyPI" },
  "Flask": { pkg: "flask", ecosystem: "PyPI" },
  "FastAPI": { pkg: "fastapi", ecosystem: "PyPI" },
  "Rails": { pkg: "rails", ecosystem: "RubyGems" },
  "Bootstrap": { pkg: "bootstrap", ecosystem: "npm" },
  "Tailwind CSS": { pkg: "tailwindcss", ecosystem: "npm" },
  "Lodash": { pkg: "lodash", ecosystem: "npm" },
  "Axios": { pkg: "axios", ecosystem: "npm" },
};

async function queryOsv(packageName: string, ecosystem: string): Promise<{ id: string; summary: string; severity?: string }[]> {
  try {
    const res = await fetch("https://api.osv.dev/v1/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ package: { name: packageName, ecosystem } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { vulns?: Array<{ id: string; summary?: string; severity?: Array<{ type: string; score: string }> }> };
    return (data.vulns ?? []).slice(0, 3).map((v) => ({
      id: v.id,
      summary: v.summary ?? "",
      severity: v.severity?.[0]?.type ?? "UNKNOWN",
    }));
  } catch { return []; }
}

export async function scanTechStack(techStack: Record<string, string[]>): Promise<CveResult[]> {
  const detected = Object.values(techStack).flat();
  const results: CveResult[] = [];
  for (const tech of detected) {
    const mapping = TECH_PACKAGE_MAP[tech];
    if (!mapping) continue;
    const vulns = await queryOsv(mapping.pkg, mapping.ecosystem);
    for (const v of vulns) {
      results.push({ techName: tech, packageName: mapping.pkg, cveId: v.id, severity: v.severity ?? "UNKNOWN", summary: v.summary });
    }
  }
  return results;
}
