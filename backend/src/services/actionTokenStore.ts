import { randomBytes } from "crypto";
import { readJson, writeJson } from "./kvStore";

interface ActionTokenRecord {
  userId: string;
  purpose: "password_reset" | "email_verify";
  expiresAt: number;
}

/**
 * Short-lived, single-purpose tokens for password reset and email
 * verification links — separate from authToken.ts's session tokens on
 * purpose: these must be one-time-use and short-TTL (1 hour), not a 30-day
 * session credential.
 */
async function readAll(): Promise<Record<string, ActionTokenRecord>> {
  return readJson<Record<string, ActionTokenRecord>>("actionTokens", {});
}

async function writeAll(data: Record<string, ActionTokenRecord>): Promise<void> {
  await writeJson("actionTokens", data);
}

export async function createActionToken(
  userId: string,
  purpose: ActionTokenRecord["purpose"],
  ttlMs = 60 * 60 * 1000
): Promise<string> {
  const token = randomBytes(24).toString("hex");
  const all = await readAll();
  all[token] = { userId, purpose, expiresAt: Date.now() + ttlMs };
  await writeAll(all);
  return token;
}

/** Consumes (deletes) the token on successful lookup — enforces one-time use. */
export async function consumeActionToken(
  token: string,
  purpose: ActionTokenRecord["purpose"]
): Promise<string | null> {
  const all = await readAll();
  const record = all[token];
  if (!record || record.purpose !== purpose || record.expiresAt < Date.now()) return null;

  delete all[token];
  await writeAll(all);
  return record.userId;
}
