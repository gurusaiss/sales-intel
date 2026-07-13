import { Lead, AddLeadsInput, LeadStatus } from "../types/leads";
import { readJson, writeJson, userScopedKey } from "./kvStore";

async function readAll(userId: string): Promise<Record<string, Lead>> {
  return readJson<Record<string, Lead>>(userScopedKey("leads", userId), {});
}

async function writeAll(userId: string, data: Record<string, Lead>): Promise<void> {
  await writeJson(userScopedKey("leads", userId), data);
}

function idFor(name: string, email?: string, domain?: string): string {
  const key = email ? email.toLowerCase() : `${name}@${domain ?? "unknown"}`.toLowerCase();
  return key.trim().replace(/[^a-z0-9@.]+/g, "-");
}

export async function listLeads(userId: string): Promise<Lead[]> {
  const all = await readAll(userId);
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getLead(userId: string, id: string): Promise<Lead | undefined> {
  const all = await readAll(userId);
  return all[id];
}

/**
 * Saves candidate leads found via company search — always an explicit user
 * action (they review the candidate list and pick who to add), never an
 * automatic bulk import of every result.
 */
export async function addLeads(userId: string, input: AddLeadsInput): Promise<Lead[]> {
  const all = await readAll(userId);
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

  await writeAll(userId, all);
  return saved;
}

export async function updateLead(
  userId: string,
  id: string,
  patch: Partial<Pick<Lead, "tags" | "notes" | "status" | "priority" | "linkedinUrl" | "phone">>
): Promise<Lead | undefined> {
  const all = await readAll(userId);
  const existing = all[id];
  if (!existing) return undefined;

  all[id] = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await writeAll(userId, all);
  return all[id];
}

export async function deleteLead(userId: string, id: string): Promise<boolean> {
  const all = await readAll(userId);
  if (!all[id]) return false;
  delete all[id];
  await writeAll(userId, all);
  return true;
}

export const VALID_STATUSES: LeadStatus[] = ["new", "contacted", "archived"];
