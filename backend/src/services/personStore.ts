import { promises as fs } from "fs";
import path from "path";
import { CrmPerson, CapturePersonInput } from "../types/crm";
import { matchTemplateCategory } from "./templates";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "persons.json");

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "{}", "utf-8");
  }
}

async function readAll(): Promise<Record<string, CrmPerson>> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw || "{}");
}

async function writeAll(data: Record<string, CrmPerson>): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export function idFromUrl(linkedinUrl: string): string {
  return linkedinUrl
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

export async function listPersons(): Promise<CrmPerson[]> {
  const all = await readAll();
  return Object.values(all).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function getPerson(linkedinUrl: string): Promise<CrmPerson | undefined> {
  const all = await readAll();
  return all[idFromUrl(linkedinUrl)];
}

/**
 * Creates the person on first capture, or updates+appends on repeat captures.
 * This is the only write path for LinkedIn-derived data — always triggered by
 * an explicit user action, never a background process.
 */
export async function captureOrUpdatePerson(input: CapturePersonInput): Promise<CrmPerson> {
  const all = await readAll();
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
  await writeAll(all);
  return person;
}

export async function updatePerson(
  linkedinUrl: string,
  patch: Partial<CrmPerson>
): Promise<CrmPerson | undefined> {
  const all = await readAll();
  const id = idFromUrl(linkedinUrl);
  const existing = all[id];
  if (!existing) return undefined;

  all[id] = { ...existing, ...patch, id, updatedAt: new Date().toISOString() };
  await writeAll(all);
  return all[id];
}
