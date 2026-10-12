import { readJson, writeJson, userScopedKey } from "./kvStore";

export type CIQStatus = "pending" | "researching" | "analyzing" | "done" | "failed";

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
  shareToken?: string;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export interface CIQApplication {
  id: string;
  userId: string;
  company: string;
  role: string;
  status: AppStatus;
  notes: string;
  jobId?: string;
  nextActionAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Job helpers ──────────────────────────────────────────────────────────────

function itemKey(userId: string, id: string) {
  return userScopedKey(`ciq:${id}`, userId);
}

function indexKey(userId: string) {
  return userScopedKey("ciq_index", userId);
}

// Global share-token → {userId, jobId} lookup (no userId required for public reads)
function shareIndexKey(token: string) {
  return `ciq_share:${token}`;
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
  const job = await getCIQJob(userId, id);
  if (job?.shareToken) {
    await writeJson(shareIndexKey(job.shareToken), null);
  }
  await writeJson(itemKey(userId, id), null);
  const index = await readJson<string[]>(indexKey(userId), []);
  await writeJson(indexKey(userId), index.filter((x) => x !== id));
}

// ── Share token ──────────────────────────────────────────────────────────────

function randomToken(len = 9): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let t = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (const b of arr) t += chars[b % chars.length];
  return t;
}

export async function setJobShare(userId: string, jobId: string): Promise<string> {
  const job = await getCIQJob(userId, jobId);
  if (!job) throw new Error("Job not found");
  const token = job.shareToken ?? randomToken();
  await updateCIQJob(userId, jobId, { shareToken: token, isPublic: true });
  await writeJson(shareIndexKey(token), { userId, jobId });
  return token;
}

export async function revokeJobShare(userId: string, jobId: string): Promise<void> {
  const job = await getCIQJob(userId, jobId);
  if (!job?.shareToken) return;
  await writeJson(shareIndexKey(job.shareToken), null);
  await updateCIQJob(userId, jobId, { shareToken: undefined, isPublic: false });
}

export async function getJobByShareToken(token: string): Promise<CIQJob | null> {
  const ref = await readJson<{ userId: string; jobId: string } | null>(shareIndexKey(token), null);
  if (!ref) return null;
  return getCIQJob(ref.userId, ref.jobId);
}

// ── Application tracker ──────────────────────────────────────────────────────

function appItemKey(userId: string, id: string) {
  return userScopedKey(`ciq_app:${id}`, userId);
}

function appIndexKey(userId: string) {
  return userScopedKey("ciq_app_index", userId);
}

export async function createApplication(
  userId: string,
  data: { company: string; role: string; status?: AppStatus; notes?: string; jobId?: string }
): Promise<CIQApplication> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const app: CIQApplication = {
    id, userId,
    company: data.company,
    role: data.role,
    status: data.status ?? "saved",
    notes: data.notes ?? "",
    jobId: data.jobId,
    createdAt: now,
    updatedAt: now,
  };
  await writeJson(appItemKey(userId, id), app);
  const index = await readJson<string[]>(appIndexKey(userId), []);
  index.unshift(id);
  if (index.length > 200) index.splice(200);
  await writeJson(appIndexKey(userId), index);
  return app;
}

export async function getApplication(userId: string, id: string): Promise<CIQApplication | null> {
  return readJson<CIQApplication | null>(appItemKey(userId, id), null);
}

export async function listApplications(userId: string): Promise<CIQApplication[]> {
  const index = await readJson<string[]>(appIndexKey(userId), []);
  const items = await Promise.all(index.map((id) => getApplication(userId, id)));
  return items.filter((x): x is CIQApplication => x !== null);
}

export async function updateApplication(
  userId: string,
  id: string,
  patch: Partial<Pick<CIQApplication, "company" | "role" | "status" | "notes" | "nextActionAt">>
): Promise<CIQApplication | null> {
  const current = await getApplication(userId, id);
  if (!current || current.userId !== userId) return null;
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await writeJson(appItemKey(userId, id), updated);
  return updated;
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
  const current = await getApplication(userId, id);
  if (!current || current.userId !== userId) return false;
  await writeJson(appItemKey(userId, id), null);
  const index = await readJson<string[]>(appIndexKey(userId), []);
  await writeJson(appIndexKey(userId), index.filter((x) => x !== id));
  return true;
}
