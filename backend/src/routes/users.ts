import { Router } from "express";
import { z } from "zod";
import {
  signup,
  login,
  getUserById,
  getUserEmailById,
  findUserIdByEmail,
  markEmailVerified,
  setPassword,
} from "../services/userStore";
import { issueToken, verifyTokenFull } from "../services/authToken";
import { revokeToken } from "../services/tokenRevocation";
import { createRateLimit } from "../middleware/rateLimit";
import { createActionToken, consumeActionToken } from "../services/actionTokenStore";
import { sendTransactionalEmail, isEmailConfigured } from "../services/email";
import { recordReferralSignup } from "../services/referralStore";

const signupLimiter = createRateLimit(10, 3_600_000);
const loginLimiter = createRateLimit(20, 60_000);
const resetLimiter = createRateLimit(5, 3_600_000);

const APP_URL = process.env.APP_URL || "http://localhost:5173";

async function sendVerificationEmail(userId: string, email: string): Promise<void> {
  const token = await createActionToken(userId, "email_verify", 24 * 60 * 60 * 1000);
  const link = `${APP_URL}/verify-email?token=${token}`;
  await sendTransactionalEmail(
    email,
    "Verify your Sales Intel email",
    `<p>Confirm your email to finish setting up your account.</p><p><a href="${link}">Verify email</a></p><p>This link expires in 24 hours.</p>`
  );
}

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
const signupSchema = credentialsSchema.extend({ ref: z.string().trim().optional() });

router.post("/auth/signup", signupLimiter, async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const user = await signup(parsed.data.email, parsed.data.password, parsed.data.ref);
    const token = issueToken(user.id);
    if (parsed.data.ref) await recordReferralSignup(parsed.data.ref, user.id);
    void sendVerificationEmail(user.id, user.email); // best-effort, doesn't block signup
    res.json({ user, token });
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : "Signup failed." });
  }
});

router.get("/auth/email-configured", (_req, res) => {
  res.json({ configured: isEmailConfigured() });
});

router.post("/auth/verify-email", async (req, res) => {
  const parsed = z.object({ token: z.string().min(1) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Missing token" });

  const userId = await consumeActionToken(parsed.data.token, "email_verify");
  if (!userId) return res.status(400).json({ error: "This verification link is invalid or expired." });

  await markEmailVerified(userId);
  res.json({ verified: true });
});

router.post("/auth/resend-verification", async (req, res) => {
  if (req.userId === "default") return res.status(401).json({ error: "Log in first." });
  const email = await getUserEmailById(req.userId);
  if (!email) return res.status(404).json({ error: "User not found." });
  await sendVerificationEmail(req.userId, email);
  res.json({ sent: true });
});

const forgotPasswordSchema = z.object({ email: z.string().trim().email() });

/**
 * Always responds the same way whether or not the email exists — prevents
 * using this endpoint to enumerate registered accounts.
 */
router.post("/auth/forgot-password", resetLimiter, async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Enter a valid email." });

  const userId = await findUserIdByEmail(parsed.data.email);
  if (userId) {
    const token = await createActionToken(userId, "password_reset", 60 * 60 * 1000);
    const link = `${APP_URL}/reset-password?token=${token}`;
    await sendTransactionalEmail(
      parsed.data.email,
      "Reset your Sales Intel password",
      `<p>Click below to set a new password. This link expires in 1 hour.</p><p><a href="${link}">Reset password</a></p><p>If you didn't request this, ignore this email.</p>`
    );
  }

  res.json({ sent: true });
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
});

router.post("/auth/reset-password", resetLimiter, async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const userId = await consumeActionToken(parsed.data.token, "password_reset");
  if (!userId) return res.status(400).json({ error: "This reset link is invalid or expired." });

  const ok = await setPassword(userId, parsed.data.newPassword);
  if (!ok) return res.status(404).json({ error: "Account not found." });

  const token = issueToken(userId);
  res.json({ reset: true, token });
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
  const loggedIn = req.userId !== "default";
  if (!loggedIn) return res.json({ userId: req.userId, loggedIn });

  const user = await getUserById(req.userId);
  res.json({
    userId: req.userId,
    loggedIn,
    emailVerified: user?.emailVerified ?? false,
    tier: user?.tier ?? "free",
  });
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
