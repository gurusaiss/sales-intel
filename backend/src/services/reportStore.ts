import { readJson, writeJson } from "./kvStore";
import { ReportType } from "../prompts/reportPrompts";

export interface Report {
  id: string;
  reportType: ReportType;
  title: string;
  content: string;
  periodStart: string;
  periodEnd: string;
  articleCount: number;
  generatedAt: string;
}

export async function saveReport(report: Omit<Report, "id">): Promise<Report> {
  const saved: Report = { ...report, id: crypto.randomUUID() };
  const key = `reports:${report.reportType}`;
  const list = await readJson<Report[]>(key, []);
  list.unshift(saved);
  if (list.length > 10) list.splice(10);
  await writeJson(key, list);
  return saved;
}

export async function listReports(reportType?: ReportType): Promise<Report[]> {
  if (reportType) {
    return readJson<Report[]>(`reports:${reportType}`, []);
  }
  const types: ReportType[] = ["daily", "weekly", "monthly", "founder", "developer", "investor", "ai", "sales_digest"];
  const all = await Promise.all(types.map((t) => readJson<Report[]>(`reports:${t}`, [])));
  return all.flat().sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
}

export async function getLatestReport(reportType: ReportType): Promise<Report | null> {
  const list = await readJson<Report[]>(`reports:${reportType}`, []);
  return list[0] ?? null;
}

export async function getReport(id: string): Promise<Report | null> {
  const types: ReportType[] = ["daily", "weekly", "monthly", "founder", "developer", "investor", "ai", "sales_digest"];
  for (const t of types) {
    const list = await readJson<Report[]>(`reports:${t}`, []);
    const found = list.find((r) => r.id === id);
    if (found) return found;
  }
  return null;
}
