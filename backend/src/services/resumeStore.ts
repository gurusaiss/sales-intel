import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "resume.json");

interface ResumeRecord {
  text: string;
  updatedAt: string;
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "{}", "utf-8");
  }
}

export async function getResume(): Promise<ResumeRecord | null> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw || "{}");
  return parsed.text ? parsed : null;
}

export async function saveResume(text: string): Promise<ResumeRecord> {
  await ensureStore();
  const record: ResumeRecord = { text, updatedAt: new Date().toISOString() };
  await fs.writeFile(DATA_FILE, JSON.stringify(record, null, 2), "utf-8");
  return record;
}
