import { readJson, writeJson } from "./kvStore";

interface ResumeRecord {
  text: string;
  updatedAt: string;
}

export async function getResume(): Promise<ResumeRecord | null> {
  const record = await readJson<ResumeRecord | null>("resume", null);
  return record?.text ? record : null;
}

export async function saveResume(text: string): Promise<ResumeRecord> {
  const record: ResumeRecord = { text, updatedAt: new Date().toISOString() };
  await writeJson("resume", record);
  return record;
}
