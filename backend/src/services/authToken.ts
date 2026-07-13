import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET || "dev-only-insecure-session-secret-change-in-production";
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — same-device sessions, not high-security banking

interface TokenPayload {
  userId: string;
  exp: number;
}

/**
 * Stateless signed token (HMAC-SHA256), not a database-backed session — no
 * new dependency, no session store to keep in sync across the KV migration.
 * Same shape as a JWT without the extra library: base64url(payload) +
 * "." + signature, so it can't be tampered with client-side without the
 * signature check failing.
 */
export function issueToken(userId: string): string {
  const payload: TokenPayload = { userId, exp: Date.now() + TOKEN_TTL_MS };
  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyToken(token: string): string | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(base64urlDecode(encoded)) as TokenPayload;
    if (payload.exp < Date.now()) return null;
    return payload.userId;
  } catch {
    return null;
  }
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
