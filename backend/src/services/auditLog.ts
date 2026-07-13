import { readJson, writeJson, userScopedKey } from "./kvStore";

export interface AuditEntry {
  action: string;
  detail: string;
  at: string;
}

const MAX_ENTRIES = 200;

export async function logAction(userId: string, action: string, detail: string): Promise<void> {
  const key = userScopedKey("audit", userId);
  const entries = await readJson<AuditEntry[]>(key, []);
  entries.unshift({ action, detail, at: new Date().toISOString() });
  await writeJson(key, entries.slice(0, MAX_ENTRIES));
}

export async function listAudit(userId: string): Promise<AuditEntry[]> {
  return readJson<AuditEntry[]>(userScopedKey("audit", userId), []);
}
