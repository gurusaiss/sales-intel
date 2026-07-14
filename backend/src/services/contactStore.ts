import { readJson, writeJson, userScopedKey } from "./kvStore";
import { ExtractedContacts } from "./contactExtractor";

export interface StoredContacts extends ExtractedContacts {
  id: string;
  analysisId: string;
  userId: string;
  url: string;
  domain: string;
  extractedAt: string;
}

function listKey(userId: string): string { return userScopedKey("contacts", userId); }
function itemKey(userId: string, id: string): string { return userScopedKey("contacts:" + id, userId); }
function byAnalysisKey(userId: string, analysisId: string): string { return userScopedKey("contacts:by_analysis:" + analysisId, userId); }

export async function saveContacts(userId: string, analysisId: string, url: string, contacts: ExtractedContacts): Promise<StoredContacts> {
  const id = crypto.randomUUID();
  const domain = (() => { try { return new URL(url).hostname; } catch { return url; } })();
  const stored: StoredContacts = { ...contacts, id, analysisId, userId, url, domain, extractedAt: new Date().toISOString() };
  await writeJson(itemKey(userId, id), stored);
  await writeJson(byAnalysisKey(userId, analysisId), id);
  const index = await readJson<string[]>(listKey(userId), []);
  index.unshift(id);
  if (index.length > 500) index.splice(500);
  await writeJson(listKey(userId), index);
  return stored;
}

export async function getContactsByAnalysis(userId: string, analysisId: string): Promise<StoredContacts | null> {
  const cid = await readJson<string | null>(byAnalysisKey(userId, analysisId), null);
  if (!cid) return null;
  return readJson<StoredContacts | null>(itemKey(userId, cid), null);
}

export async function getContacts(userId: string, id: string): Promise<StoredContacts | null> {
  return readJson<StoredContacts | null>(itemKey(userId, id), null);
}

export async function listContacts(userId: string, limit = 50): Promise<StoredContacts[]> {
  const index = await readJson<string[]>(listKey(userId), []);
  const items = await Promise.all(index.slice(0, limit).map((id) => getContacts(userId, id)));
  return items.filter((x): x is StoredContacts => x !== null);
}

export function exportContactsAsCsv(contacts: StoredContacts): string {
  const rows = ["type,subtype,value,context"];
  contacts.emails.forEach((e) => rows.push("email," + e.type + "," + JSON.stringify(e.email) + "," + JSON.stringify(e.context)));
  contacts.phones.forEach((p) => rows.push("phone," + p.type + "," + JSON.stringify(p.number) + "," + JSON.stringify(p.raw)));
  contacts.socialLinks.forEach((s) => rows.push("social," + s.platform + "," + JSON.stringify(s.url) + "," + JSON.stringify(s.username ?? "")));
  contacts.bookingLinks.forEach((b) => rows.push("booking," + b.platform + "," + JSON.stringify(b.url) + ","));
  contacts.contactPages.forEach((u) => rows.push("contact_page,page," + JSON.stringify(u) + ","));
  return rows.join("\n");
}

export function exportContactsAsMarkdown(contacts: StoredContacts): string {
  const lines: string[] = ["## Extracted Contacts", "", "**Domain:** " + contacts.domain, ""];
  if (contacts.emails.length) {
    lines.push("### Emails");
    contacts.emails.forEach((e) => lines.push("- **[" + e.type + "]** " + e.email));
    lines.push("");
  }
  if (contacts.phones.length) {
    lines.push("### Phone Numbers");
    contacts.phones.forEach((p) => lines.push("- **[" + p.type + "]** " + p.raw));
    lines.push("");
  }
  if (contacts.socialLinks.length) {
    lines.push("### Social Links");
    contacts.socialLinks.forEach((s) => lines.push("- **" + s.platform + ":** " + s.url));
    lines.push("");
  }
  if (contacts.bookingLinks.length) {
    lines.push("### Booking / Meeting Links");
    contacts.bookingLinks.forEach((b) => lines.push("- **[" + b.platform + "]** " + b.url));
    lines.push("");
  }
  if (contacts.contactPages.length) {
    lines.push("### Contact Pages");
    contacts.contactPages.forEach((u) => lines.push("- " + u));
    lines.push("");
  }
  return lines.join("\n");
}
