import { createHmac, timingSafeEqual, randomUUID } from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-only-insecure-session-secret-change-in-production";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — same-device sessions, not high-security banking

export interface TokenPayload {
  userId: string;
  jti: string; // unique token id — lets a specific token be revoked (logout/refresh)
  exp: number;
}

/**
 * Stateless signed token (HMAC-SHA256), not a database-backed session — no
 * new dependency, no session store to keep in sync across the KV migration.
 * Same shape as a JWT without the extra library: base64url(payload) +
 * "." + signature, so it can't be tampered with client-side without the
 * signature check failing. Each token carries a random `jti` so it can be
 * individually revoked via the token-revocation list (logout / refresh).
 */
export function issueToken(userId: string): string {
  const payload: TokenPayload = { userId, jti: randomUUID(), exp: Date.now() + TOKEN_TTL_MS };
  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

/** Verify signature + expiry and return the full payload (jti included). */
export function verifyTokenFull(token: string): TokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded)) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Backward-compatible helper: returns just the userId (no revocation check). */
export function verifyToken(token: string): string | null {
  return verifyTokenFull(token)?.userId ?? null;
}

function sign(data: string): string {
  return createHmac("sha256", SECRET).update(data).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

function base64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf-8");
}
