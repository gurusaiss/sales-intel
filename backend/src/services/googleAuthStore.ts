import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const DATA_FILE = path.join(DATA_DIR, "googleAuth.json");

interface GoogleTokens {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number; // epoch ms
}

async function ensureStore(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "{}", "utf-8");
  }
}

export async function readTokens(): Promise<GoogleTokens | null> {
  await ensureStore();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  const parsed = JSON.parse(raw || "{}");
  return parsed.refreshToken ? parsed : null;
}

export async function writeTokens(tokens: GoogleTokens): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, JSON.stringify(tokens, null, 2), "utf-8");
}

export async function clearTokens(): Promise<void> {
  await ensureStore();
  await fs.writeFile(DATA_FILE, "{}", "utf-8");
}
