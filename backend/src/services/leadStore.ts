import { promises as fs } from "fs";
import path from "path";
import { Lead, AddLeadsInput, LeadStatus } from "../types/leads";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "leads.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "{}", "utf-8");
  }
}

async function readAll(): Promise<Record<string, Lead>> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw || "{}");
}

async function writeAll(data: Record<string, Lead>): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

function idFor(name: string, email?: string, domain?: string): string {
  const key = email ? email.toLowerCase() : `${name}@${domain ?? "unknown"}`.toLowerCase();
  return key.trim().replace(/[^a-z0-9@.]+/g, "-");
}

export async function listLeads(): Promise<Lead[]> {
  const all = await readAll();
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getLead(id: string): Promise<Lead | undefined> {
  const all = await readAll();
  return all[id];
}

/**
 * Saves candidate leads found via company search — always an explicit user
 * action (they review the candidate list and pick who to add), never an
 * automatic bulk import of every result.
 */
export async function addLeads(input: AddLeadsInput): Promise<Lead[]> {
  const all = await readAll();
  const now = new Date().toISOString();
  const saved: Lead[] = [];

  for (const candidate of input.people) {
    const id = idFor(candidate.name, candidate.email, input.companyDomain);
    const existing = all[id];

    const lead: Lead = existing ?? {
      id,
      name: candidate.name,
      company: input.company,
      companyDomain: input.companyDomain,
      title: candidate.title,
      publicEmail: candidate.email,
      emailConfidence: candidate.emailConfidence,
      tags: [],
      notes: "",
      status: "new",
      priority: 3,
      source: input.source,
      createdAt: now,
      updatedAt: now,
    };

    lead.title = candidate.title ?? lead.title;
    lead.publicEmail = candidate.email ?? lead.publicEmail;
    lead.emailConfidence = candidate.emailConfidence ?? lead.emailConfidence;
    lead.updatedAt = now;

    all[id] = lead;
    saved.push(lead);
  }

  await writeAll(all);
  return saved;
}

export async function updateLead(
  id: string,
  patch: Partial<Pick<Lead, "tags" | "notes" | "status" | "priority" | "linkedinUrl" | "phone">>
): Promise<Lead | undefined> {
  const all = await readAll();
  const existing = all[id];
  if (!existing) return undefined;

  all[id] = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[id];
}

export async function deleteLead(id: string): Promise<boolean> {
  const all = await readAll();
  if (!all[id]) return false;
  delete all[id];
  await writeAll(all);
  return true;
}

export const VALID_STATUSES: LeadStatus[] = ["new", "contacted", "archived"];
