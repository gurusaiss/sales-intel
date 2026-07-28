import { Router } from "express";
import { z } from "zod";
import { signup, login } from "../services/userStore";
import { issueToken, verifyTokenFull } from "../services/authToken";
import { revokeToken } from "../services/tokenRevocation";
import { createRateLimit } from "../middleware/rateLimit";

const signupLimiter = createRateLimit(10, 3_600_000);
const loginLimiter = createRateLimit(20, 60_000);

const router = Router();

const credentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

/**
 * Development-mode signup: any email/password works, exactly as specified.
 * Not gated by requireApiKey — signing up is how a new account gets created
 * in the first place, so there's nothing to authenticate against yet.
 */
router.post("/auth/signup", signupLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const user = await signup(parsed.data.email, parsed.data.password);
    const token = issueToken(user.id);
    res.json({ user, token });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : "Signup failed." });
  }
});

router.post("/auth/login", loginLimiter, async (req, res) => {
  const parsed = credentialsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const user = await login(parsed.data.email, parsed.data.password);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = issueToken(user.id);
  res.json({ user, token });
});

router.get("/auth/me", async (req, res) => {
  res.json({ userId: req.userId, loggedIn: req.userId !== "default" });
});

function bearer(req: import("express").Request): string | undefined {
  const h = req.header("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : undefined;
}

/**
 * Logout — revoke the presented token so it can no longer authenticate, even
 * though it's still cryptographically valid and unexpired. Idempotent: a
 * missing/invalid token is treated as already-logged-out.
 */
router.post("/auth/logout", async (req, res) => {
  const token = bearer(req);
  const payload = token ? verifyTokenFull(token) : null;
  if (payload) await revokeToken(payload.jti, payload.exp);
  res.json({ ok: true });
});

/**
 * Refresh with rotation — issue a fresh token and revoke the old one, so a
 * leaked-but-rotated token stops working. Requires a still-valid, non-revoked
 * token (resolveUser has already rejected revoked ones, leaving req.userId as
 * the account only when the token is genuinely current).
 */
router.post("/auth/refresh", async (req, res) => {
  const token = bearer(req);
  const payload = token ? verifyTokenFull(token) : null;
  if (!payload || req.userId === "default") {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
  await revokeToken(payload.jti, payload.exp); // rotate: kill the old token
  const fresh = issueToken(payload.userId);
  res.json({ token: fresh });
});

export default router;
