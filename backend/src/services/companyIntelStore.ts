import { readJson, writeJson, userScopedKey } from "./kvStore";

export type CIQStatus = "pending" | "researching" | "analyzing" | "done" | "failed";

export interface CIQSection {
  title: string;
  content: string;
}

export interface CIQReport {
  overview?: string;
  founders?: string;
  originStory?: string;
  challenges?: string;
  productsProjects?: string;
  roadmap?: string;
  competitive?: string;
  struggles?: string;
  interviewQuestions?: string[];
  culture?: string;
  redFlags?: string;
  applicationStrategy?: string;
  candidateFit?: string;
  raw?: string;
}

export interface CIQJob {
  id: string;
  userId: string;
  companyName: string;
  resumeText: string;
  status: CIQStatus;
  report?: CIQReport;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

function itemKey(userId: string, id: string) {
  return userScopedKey(`ciq:${id}`, userId);
}

function indexKey(userId: string) {
  return userScopedKey("ciq_index", userId);
}

export async function createCIQJob(userId: string, companyName: string, resumeText: string): Promise<CIQJob> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const job: CIQJob = { id, userId, companyName, resumeText, status: "pending", createdAt: now, updatedAt: now };
  await writeJson(itemKey(userId, id), job);
  const index = await readJson<string[]>(indexKey(userId), []);
  index.unshift(id);
  if (index.length > 50) index.splice(50);
  await writeJson(indexKey(userId), index);
  return job;
}

export async function getCIQJob(userId: string, id: string): Promise<CIQJob | null> {
  return readJson<CIQJob | null>(itemKey(userId, id), null);
}

export async function listCIQJobs(userId: string): Promise<CIQJob[]> {
  const index = await readJson<string[]>(indexKey(userId), []);
  const items = await Promise.all(index.map((id) => getCIQJob(userId, id)));
  return items.filter((x): x is CIQJob => x !== null);
}

export async function updateCIQJob(userId: string, id: string, patch: Partial<CIQJob>): Promise<void> {
  const current = await getCIQJob(userId, id);
  if (!current) return;
  await writeJson(itemKey(userId, id), { ...current, ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteCIQJob(userId: string, id: string): Promise<void> {
  await writeJson(itemKey(userId, id), null);
  const index = await readJson<string[]>(indexKey(userId), []);
  await writeJson(indexKey(userId), index.filter((x) => x !== id));
}
