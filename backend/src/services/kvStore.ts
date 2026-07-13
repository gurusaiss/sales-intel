import { promises as fs } from "fs";
import path from "path";

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const DATA_DIR = path.join(__dirname, "..", "..", "data");

/**
 * Every store in this app (persons, leads, jobs, resume, googleAuth) used to
 * read/write its own local JSON file directly. That broke silently on Render:
 * free-tier web services have an EPHEMERAL disk — it resets on every
 * redeploy and on spin-down/spin-up after idling. Every git push this
 * session has been quietly wiping whatever data was captured since the last
 * deploy. This is the actual root cause of "data disappears."
 *
 * Fix: delegate all reads/writes through here. If Upstash Redis is
 * configured (free tier, no card — see .env.example), storage survives
 * deploys and restarts for real. If it isn't configured, this transparently
 * falls back to the local JSON file — same as local dev always worked, and
 * every store's own code is completely unaware of which backend is active.
 */
export async function readJson<T>(key: string, fallback: T): Promise<T> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const res = await fetch(`${UPSTASH_URL}/get/${encodeURIComponent(key)}`, {
      headers: { authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    if (!res.ok) {
      console.error(`Upstash GET ${key} failed`, res.status, await res.text());
      return fallback;
    }
    const body = (await res.json()) as { result: string | null };
    if (!body.result) return fallback;
    try {
      return JSON.parse(body.result) as T;
    } catch {
      return fallback;
    }
  }

  return readLocalFile<T>(key, fallback);
}

export async function writeJson<T>(key: string, value: T): Promise<void> {
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const res = await fetch(`${UPSTASH_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${UPSTASH_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      console.error(`Upstash SET ${key} failed`, res.status, await res.text());
      // Fall through to local file too, so a transient Upstash error doesn't
      // lose the write outright — best-effort durability, not a silent drop.
      await writeLocalFile(key, value);
    }
    return;
  }

  await writeLocalFile(key, value);
}

async function readLocalFile<T>(key: string, fallback: T): Promise<T> {
  const file = path.join(DATA_DIR, `${key}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeLocalFile<T>(key: string, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${key}.json`);
  await fs.writeFile(file, JSON.stringify(value, null, 2), "utf-8");
}

export function isDurablePersistenceConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}
