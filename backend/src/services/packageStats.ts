import { readJson, writeJson } from "./kvStore";

export interface PackageStat {
  techName: string;
  npmPackage?: string;
  npmWeekly?: number;
  pypiPackage?: string;
  pypiMonthly?: number;
  fetchedAt: string;
}

// 80+ tech → package mappings
const NPM_PACKAGES: Record<string, string> = {
  "React": "react", "Next.js": "next", "Vue.js": "vue", "Angular": "@angular/core",
  "Svelte": "svelte", "Astro": "astro", "Remix": "@remix-run/react", "Gatsby": "gatsby",
  "jQuery": "jquery", "Alpine.js": "alpinejs", "Tailwind CSS": "tailwindcss",
  "Bootstrap": "bootstrap", "Vite": "vite", "Webpack": "webpack", "Parcel": "parcel",
  "TypeScript": "typescript", "ESLint": "eslint", "Prettier": "prettier",
  "Express": "express", "Fastify": "fastify", "Nest.js": "@nestjs/core",
  "Socket.io": "socket.io", "Axios": "axios", "Lodash": "lodash",
  "Moment.js": "moment", "Day.js": "dayjs", "Zod": "zod", "Joi": "joi",
  "Prisma": "@prisma/client", "Mongoose": "mongoose", "Sequelize": "sequelize",
  "Jest": "jest", "Vitest": "vitest", "Cypress": "cypress", "Playwright": "playwright",
  "React Query": "@tanstack/react-query", "Zustand": "zustand", "Redux": "redux",
  "GraphQL": "graphql", "Apollo": "@apollo/client",
};

const PYPI_PACKAGES: Record<string, string> = {
  "Django": "django", "Flask": "flask", "FastAPI": "fastapi",
  "SQLAlchemy": "sqlalchemy", "Pydantic": "pydantic", "Celery": "celery",
  "Pandas": "pandas", "NumPy": "numpy", "PyTorch": "torch", "TensorFlow": "tensorflow",
  "Scikit-learn": "scikit-learn", "Requests": "requests", "aiohttp": "aiohttp",
  "Pytest": "pytest", "Black": "black", "Ruff": "ruff", "Mypy": "mypy",
  "Uvicorn": "uvicorn", "Gunicorn": "gunicorn", "Alembic": "alembic",
  "LangChain": "langchain", "OpenAI": "openai", "Anthropic": "anthropic",
};

async function fetchNpmWeekly(pkg: string): Promise<number | undefined> {
  try {
    const res = await fetch(`https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(pkg)}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const d = await res.json() as { downloads?: number };
    return d.downloads;
  } catch { return undefined; }
}

async function fetchPypiMonthly(pkg: string): Promise<number | undefined> {
  try {
    const res = await fetch(`https://pypistats.org/api/packages/${encodeURIComponent(pkg.toLowerCase())}/recent?period=month`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return undefined;
    const d = await res.json() as { data?: { last_month?: number } };
    return d.data?.last_month;
  } catch { return undefined; }
}

export async function fetchPackageStats(): Promise<void> {
  const existing = await readJson<PackageStat[]>("package_stats", []);
  const statsMap: Record<string, PackageStat> = {};
  existing.forEach((s) => { statsMap[s.techName] = s; });

  const allTechs = [...new Set([...Object.keys(NPM_PACKAGES), ...Object.keys(PYPI_PACKAGES)])];
  for (const tech of allTechs) {
    const npmPkg = NPM_PACKAGES[tech];
    const pypiPkg = PYPI_PACKAGES[tech];
    const stat: PackageStat = { techName: tech, npmPackage: npmPkg, pypiPackage: pypiPkg, fetchedAt: new Date().toISOString() };
    if (npmPkg) stat.npmWeekly = await fetchNpmWeekly(npmPkg);
    if (pypiPkg) stat.pypiMonthly = await fetchPypiMonthly(pypiPkg);
    statsMap[tech] = stat;
    await new Promise((r) => setTimeout(r, 100)); // gentle rate limiting
  }

  await writeJson("package_stats", Object.values(statsMap));
}

export async function getStatForTech(techName: string): Promise<PackageStat | null> {
  const all = await readJson<PackageStat[]>("package_stats", []);
  return all.find((s) => s.techName.toLowerCase() === techName.toLowerCase()) ?? null;
}
