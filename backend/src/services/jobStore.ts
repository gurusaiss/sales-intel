import { JobApplication, AddJobInput, JobStatus } from "../types/jobs";
import { readJson, writeJson } from "./kvStore";

async function readAll(): Promise<Record<string, JobApplication>> {
  return readJson<Record<string, JobApplication>>("jobs", {});
}

async function writeAll(data: Record<string, JobApplication>): Promise<void> {
  await writeJson("jobs", data);
}

function generateId(company: string, role: string): string {
  const base = `${company}-${role}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${base}-${Date.now().toString(36)}`;
}

export async function listJobs(): Promise<JobApplication[]> {
  const all = await readAll();
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function addJob(input: AddJobInput): Promise<JobApplication> {
  const all = await readAll();
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
    notes: "",
    createdAt: now,
    updatedAt: now,
  };

  all[id] = job;
  await writeAll(all);
  return job;
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<JobApplication, "status" | "notes" | "appliedDate" | "referralContactName" | "referralContactEmail">>
): Promise<JobApplication | undefined> {
  const all = await readAll();
  const existing = all[id];
  if (!existing) return undefined;

  all[id] = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[id];
}

export async function deleteJob(id: string): Promise<boolean> {
  const all = await readAll();
  if (!all[id]) return false;
  delete all[id];
  await writeAll(all);
  return true;
}

export const VALID_JOB_STATUSES: JobStatus[] = ["saved", "applied", "interviewing", "offer", "rejected"];
