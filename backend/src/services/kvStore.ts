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

// Windows treats ":" in a filename as the NTFS Alternate Data Stream
// separator, not a literal character — "persons:abc123" silently becomes a
// stream on a file named "persons" instead of its own file. Per-user keys
// (userScopedKey) use ":" as their separator, so local-file mode must not
// pass that through raw. This only affects the local fs fallback — Upstash
// Redis keys allow colons natively — but it's a real cross-platform bug.
function safeFilename(key: string): string {
  return key.replace(/[:<>"|?*]/g, "__");
}

async function readLocalFile<T>(key: string, fallback: T): Promise<T> {
  const file = path.join(DATA_DIR, `${safeFilename(key)}.json`);
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeLocalFile<T>(key: string, value: T): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const file = path.join(DATA_DIR, `${safeFilename(key)}.json`);
  // Atomic write: serialize to a temp file then rename over the target.
  // rename() is atomic on the same filesystem, so a concurrent reader never
  // sees a half-written file (which would JSON.parse-fail and silently return
  // the fallback — the root cause of "data randomly empty" under concurrent
  // polls). The temp name is per-write-unique to avoid two writers colliding.
  const tmp = `${file}.${process.pid}.${writeCounter++}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), "utf-8");
  await fs.rename(tmp, file);
}

let writeCounter = 0;

export function isDurablePersistenceConfigured(): boolean {
  return Boolean(UPSTASH_URL && UPSTASH_TOKEN);
}

/**
 * Per-key async mutex. Stores that do read-modify-write on a single key
 * (append an article, upsert a trend) must run under this so two concurrent
 * pollers can't both read the old value, each append, and clobber each other's
 * writes (lost updates). Serializes only same-key work; different keys stay
 * fully parallel.
 */
const keyLocks = new Map<string, Promise<unknown>>();

export function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = keyLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  // Keep the chain alive but don't let a rejection poison the next waiter.
  keyLocks.set(key, next.catch(() => undefined));
  return next;
}

export const DEFAULT_USER_ID = "default";

/**
 * Every store's key is scoped by user so logged-in accounts get fully
 * isolated data. "default" (the namespace used when nobody's logged in)
 * maps to the exact same key every store already used before accounts
 * existed — so using the app without logging in keeps working unchanged,
 * and nothing needs migrating for existing data.
 */
export function userScopedKey(base: string, userId: string): string {
  return userId === DEFAULT_USER_ID ? base : `${base}:${userId}`;
}
