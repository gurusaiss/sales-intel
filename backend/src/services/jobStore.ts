import { JobApplication, AddJobInput, JobStatus } from "../types/jobs";
import { readJson, writeJson, userScopedKey } from "./kvStore";

async function readAll(userId: string): Promise<Record<string, JobApplication>> {
  return readJson<Record<string, JobApplication>>(userScopedKey("jobs", userId), {});
}

async function writeAll(userId: string, data: Record<string, JobApplication>): Promise<void> {
  await writeJson(userScopedKey("jobs", userId), data);
}

function generateId(company: string, role: string): string {
  const base = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${base}-${Date.now().toString(36)}`;
}

export async function listJobs(userId: string): Promise<JobApplication[]> {
  const all = await readAll(userId);
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function addJob(userId: string, input: AddJobInput): Promise<JobApplication> {
  const all = await readAll(userId);
  const now = new Date().toISOString();
  const id = generateId(input.company, input.role);

  const job: JobApplication = {
    id,
    company: input.company,
    role: input.role,
    jobDescription: input.jobDescription,
    status: "saved",
    referralContactName: input.referralContactName,
    referralContactEmail: input.referralContactEmail,
    referralPersonLinkedinUrl: input.referralPersonLinkedinUrl,
    notes: "",
    createdAt: now,
    updatedAt: now,
  };

  all[id] = job;
  await writeAll(userId, all);
  return job;
}

export async function updateJob(
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      JobApplication,
      "status" | "notes" | "appliedDate" | "referralContactName" | "referralContactEmail" | "referralPersonLinkedinUrl"
    >
  >
): Promise<JobApplication | undefined> {
  const all = await readAll(userId);
  const existing = all[id];
  if (!existing) return undefined;

  all[id] = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await writeAll(userId, all);
  return all[id];
}

export async function deleteJob(userId: string, id: string): Promise<boolean> {
  const all = await readAll(userId);
  if (!all[id]) return false;
  delete all[id];
  await writeAll(userId, all);
  return true;
}

export const VALID_JOB_STATUSES: JobStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];
