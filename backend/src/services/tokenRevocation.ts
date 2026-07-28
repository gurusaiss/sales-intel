import { readJson, writeJson, withKeyLock } from "./kvStore";

/**
 * Token revocation list — the store side of logout / refresh-rotation.
 *
 * Session tokens are stateless HMAC tokens (see authToken.ts), so "logging
 * out" or "rotating" a token can't just delete a server-side session — there
 * isn't one. Instead we record a revoked token's unique id (jti) here until it
 * would have expired anyway, and resolveUser rejects any token whose jti is on
 * the list. Entries past their expiry are pruned on every write, so the list
 * stays small on its own.
 *
 * A 60s in-memory cache keeps this off the hot path: resolveUser runs on every
 * request, but revocations are rare, so we only re-read the KV list once a
 * minute (or immediately after a revoke, which refreshes the cache).
 */

interface RevokedEntry {
  jti: string;
  exp: number;
}

const KEY = "revoked_tokens";
const CACHE_TTL_MS = 60_000;

let cache: Set<string> | null = null;
let cacheAt = 0;

async function loadRevoked(): Promise<Set<string>> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
  const entries = await readJson<RevokedEntry[]>(KEY, []);
  cache = new Set(entries.filter((e) => e.exp > now).map((e) => e.jti));
  cacheAt = now;
  return cache;
}

export async function revokeToken(jti: string, exp: number): Promise<void> {
  await withKeyLock(KEY, async () => {
    const now = Date.now();
    const entries = await readJson<RevokedEntry[]>(KEY, []);
    const valid = entries.filter((e) => e.exp > now); // prune expired
    if (!valid.some((e) => e.jti === jti)) valid.push({ jti, exp });
    await writeJson(KEY, valid);
    cache = new Set(valid.map((e) => e.jti));
    cacheAt = now;
  });
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const set = await loadRevoked();
  return set.has(jti);
}
