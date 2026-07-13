import { readJson, writeJson, userScopedKey } from "./kvStore";

interface ResumeRecord {
  text: string;
  updatedAt: string;
}

export async function getResume(userId: string): Promise<ResumeRecord | null> {
  const record = await readJson<ResumeRecord | null>(userScopedKey("resume", userId), null);
  return record?.text ? record : null;
}

export async function saveResume(userId: string, text: string): Promise<ResumeRecord> {
  const record: ResumeRecord = { text, updatedAt: new Date().toISOString() };
  await writeJson(userScopedKey("resume", userId), record);
  return record;
}
