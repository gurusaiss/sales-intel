import { readJson, writeJson } from "./kvStore";

export interface Trend {
  id: string;
  name: string;
  category: string;
  description: string;
  trendScore: number;
  growthScore: number;
  viralityScore: number;
  adoptionScore: number;
  futureScore: number;
  source: string;
  updatedAt: string;
}

export interface Innovation {
  id: string;
  name: string;
  type: "ai_release" | "oss" | "startup" | "dev_tool" | "sdk" | "api" | "other";
  company?: string;
  description: string;
  url: string;
  githubUrl?: string;
  githubStars?: number;
  starsToday?: number;
  language?: string;
  impactScore: number;
  tags: string[];
  discoveredAt: string;
}

export interface SparklineEntry {
  date: string;
  count: number;
}

export async function listTrends(category?: string): Promise<Trend[]> {
  const all = await readJson<Trend[]>("trends", []);
  return category ? all.filter((t) => t.category === category) : all;
}

export async function upsertTrend(t: Omit<Trend, "id" | "updatedAt"> & { id?: string }): Promise<Trend> {
  const all = await readJson<Trend[]>("trends", []);
  const existing = all.find((x) => x.name.toLowerCase() === t.name.toLowerCase());
  if (existing) {
    Object.assign(existing, t, { updatedAt: new Date().toISOString() });
    await writeJson("trends", all);
    return existing;
  }
  const trend: Trend = { ...t, id: t.id ?? crypto.randomUUID(), updatedAt: new Date().toISOString() };
  all.unshift(trend);
  if (all.length > 200) all.splice(200);
  await writeJson("trends", all);
  return trend;
}

export async function listInnovations(type?: string): Promise<Innovation[]> {
  const all = await readJson<Innovation[]>("innovations", []);
  return type ? all.filter((i) => i.type === type) : all;
}

export async function upsertInnovation(item: Omit<Innovation, "id" | "discoveredAt"> & { id?: string }): Promise<Innovation> {
  const all = await readJson<Innovation[]>("innovations", []);
  const existing = all.find((x) => x.url === item.url || x.name.toLowerCase() === item.name.toLowerCase());
  if (existing) {
    Object.assign(existing, item);
    await writeJson("innovations", all);
    return existing;
  }
  const innovation: Innovation = { ...item, id: item.id ?? crypto.randomUUID(), discoveredAt: new Date().toISOString() };
  all.unshift(innovation);
  if (all.length > 500) all.splice(500);
  await writeJson("innovations", all);
  return innovation;
}

export async function getTrendCategories(): Promise<string[]> {
  const all = await readJson<Trend[]>("trends", []);
  return [...new Set(all.map((t) => t.category))].sort();
}

export async function getInnovationTypes(): Promise<string[]> {
  return ["ai_release", "oss", "startup", "dev_tool", "sdk", "api", "other"];
}

export async function getSparkline(techName: string): Promise<SparklineEntry[]> {
  const key = `sparkline:${techName.toLowerCase().replace(/\s+/g, "_")}`;
  return readJson<SparklineEntry[]>(key, []);
}

export async function updateSparkline(techName: string, date: string): Promise<void> {
  const key = `sparkline:${techName.toLowerCase().replace(/\s+/g, "_")}`;
  const entries = await readJson<SparklineEntry[]>(key, []);
  const existing = entries.find((e) => e.date === date);
  if (existing) existing.count += 1;
  else entries.push({ date, count: 1 });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length > 30) entries.splice(0, entries.length - 30);
  await writeJson(key, entries);
}
