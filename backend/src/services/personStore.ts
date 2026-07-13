import { CrmPerson, CapturePersonInput } from "../types/crm";
import { matchTemplateCategory } from "./templates";
import { readJson, writeJson, userScopedKey } from "./kvStore";

async function readAll(userId: string): Promise<Record<string, CrmPerson>> {
  return readJson<Record<string, CrmPerson>>(userScopedKey("persons", userId), {});
}

async function writeAll(userId: string, data: Record<string, CrmPerson>): Promise<void> {
  await writeJson(userScopedKey("persons", userId), data);
}

export function idFromUrl(linkedinUrl: string): string {
  return linkedinUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export async function listPersons(userId: string): Promise<CrmPerson[]> {
  const all = await readAll(userId);
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getPerson(userId: string, linkedinUrl: string): Promise<CrmPerson | undefined> {
  const all = await readAll(userId);
  return all[idFromUrl(linkedinUrl)];
}

/**
 * Cross-channel identity linking: finds a tracked LinkedIn person by public
 * email, company domain, or exact name — so the research tool can surface
 * "you're already tracking this person" instead of treating every channel
 * as a separate, disconnected contact.
 */
export async function findPersonByIdentity(
  userId: string,
  params: { email?: string; domain?: string; name?: string }
): Promise<CrmPerson | undefined> {
  const all = await listPersons(userId);
  const emailLower = params.email?.toLowerCase();
  const domainLower = params.domain?.toLowerCase();
  const nameLower = params.name?.trim().toLowerCase();

  return (
    all.find((p) => emailLower && p.publicEmail?.toLowerCase() === emailLower) ??
    all.find((p) => domainLower && p.companyDomain?.toLowerCase() === domainLower) ??
    all.find((p) => nameLower && p.name.trim().toLowerCase() === nameLower)
  );
}

/**
 * Finds other tracked people with the same name but a different LinkedIn
 * URL — a real gap this schema has no other way to catch: LinkedIn profile
 * URLs can change (vanity slug edits) or get captured with slightly
 * different formatting, silently splitting one person into two records.
 */
export async function findDuplicatesByName(
  userId: string,
  name: string,
  excludeId: string
): Promise<CrmPerson[]> {
  const all = await listPersons(userId);
  const nameLower = name.trim().toLowerCase();
  return all.filter((p) => p.id !== excludeId && p.name.trim().toLowerCase() === nameLower);
}

/**
 * Merges one duplicate record into another: combines message history, notes,
 * meetings, and follow-up count, keeps the more advanced status (e.g. a
 * "replied" record wins over a "no_reply" one), then deletes the duplicate.
 * Always an explicit user action — never triggered automatically, since a
 * name match alone isn't proof two records are actually the same person.
 */
export async function mergePersons(
  userId: string,
  keepLinkedinUrl: string,
  mergeLinkedinUrl: string
): Promise<CrmPerson | undefined> {
  const all = await readAll(userId);
  const keepId = idFromUrl(keepLinkedinUrl);
  const mergeId = idFromUrl(mergeLinkedinUrl);

  const keep = all[keepId];
  const merge = all[mergeId];
  if (!keep || !merge || keepId === mergeId) return undefined;

  const STATUS_RANK: Record<CrmPerson["status"], number> = {
    do_not_contact: 5,
    booked: 4,
    replied: 3,
    no_reply: 2,
    closed: 1,
  };

  const merged: CrmPerson = {
    ...keep,
    messages: [...keep.messages, ...merge.messages].sort(
      (a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime()
    ),
    notes: [...keep.notes, ...merge.notes],
    meetings: [...keep.meetings, ...merge.meetings],
    tags: Array.from(new Set([...keep.tags, ...merge.tags])),
    followUpCount: keep.followUpCount + merge.followUpCount,
    status: STATUS_RANK[merge.status] > STATUS_RANK[keep.status] ? merge.status : keep.status,
    companyDomain: keep.companyDomain ?? merge.companyDomain,
    publicEmail: keep.publicEmail ?? merge.publicEmail,
    emailConfidence: keep.emailConfidence ?? merge.emailConfidence,
    phone: keep.phone ?? merge.phone,
    contactPageUrl: keep.contactPageUrl ?? merge.contactPageUrl,
    bookingUrl: keep.bookingUrl ?? merge.bookingUrl,
    lastContactedAt: laterOf(keep.lastContactedAt, merge.lastContactedAt),
    lastReplyAt: laterOf(keep.lastReplyAt, merge.lastReplyAt),
    updatedAt: new Date().toISOString(),
  };

  delete all[mergeId];
  all[keepId] = merged;
  await writeAll(userId, all);
  return merged;
}

function laterOf(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() > new Date(b).getTime() ? a : b;
}

/**
 * Creates the person on first capture, or updates+appends on repeat captures.
 * This is the only write path for LinkedIn-derived data — always triggered by
 * an explicit user action, never a background process.
 */
export async function captureOrUpdatePerson(
  userId: string,
  input: CapturePersonInput
): Promise<CrmPerson> {
  const all = await readAll(userId);
  const id = idFromUrl(input.linkedinUrl);
  const now = new Date().toISOString();
  const existing = all[id];

  const person: CrmPerson = existing ?? {
    id,
    linkedinUrl: input.linkedinUrl,
    name: input.name,
    company: input.company,
    role: input.role,
    location: input.location,
    templateCategory: matchTemplateCategory(input.role),
    tags: [],
    priority: 3,
    messages: [],
    followUpCount: 0,
    status: "no_reply",
    meetings: [],
    notes: [],
    createdAt: now,
    updatedAt: now,
  };

  // Refresh fields that may have changed since last capture, without clobbering
  // manually-set fields like tags, priority, or templateCategory overrides.
  person.name = input.name || person.name;
  person.company = input.company ?? person.company;
  person.role = input.role ?? person.role;
  person.location = input.location ?? person.location;
  person.publicEmail = input.publicEmail ?? person.publicEmail;
  person.phone = input.phone ?? person.phone;
  if (input.publicEmail && !person.emailConfidence) {
    person.emailConfidence = "high"; // came straight off their own LinkedIn profile
  }
  person.updatedAt = now;

  if (input.visibleMessage) {
    person.messages.push({
      direction: input.visibleMessage.direction,
      text: input.visibleMessage.text,
      capturedAt: now,
      source: "user-viewed",
    });
    if (input.visibleMessage.direction === "outbound") {
      person.followUpCount += 1;
      person.lastContactedAt = now;
      if (person.status === "no_reply" || !existing) {
        person.status = "no_reply";
      }
    } else {
      person.lastReplyAt = now;
      person.status = "replied";
    }
  }

  all[id] = person;
  await writeAll(userId, all);
  return person;
}

export async function updatePerson(
  userId: string,
  linkedinUrl: string,
  patch: Partial<CrmPerson>
): Promise<CrmPerson | undefined> {
  const all = await readAll(userId);
  const id = idFromUrl(linkedinUrl);
  const existing = all[id];
  if (!existing) return undefined;

  all[id] = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await writeAll(userId, all);
  return all[id];
}
