import { Router } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { writeJson, userScopedKey, DEFAULT_USER_ID } from "../services/kvStore";
import { listPersons } from "../services/personStore";
import { listLeads } from "../services/leadStore";
import { listJobs } from "../services/jobStore";
import { getResume } from "../services/resumeStore";
import { listAudit } from "../services/auditLog";
import { login, deleteUser, getUserEmailById } from "../services/userStore";
import { logAction } from "../services/auditLog";
import { getUserSettings, updateUserSettings } from "../services/userSettings";
import { getReferralStats } from "../services/referralStore";

const router = Router();

router.get("/account/settings", requireApiKey, async (req, res) => {
  res.json(await getUserSettings(req.userId));
});

const settingsSchema = z.object({
  digestEnabled: z.boolean().optional(),
  slackWebhookUrl: z.string().trim().url().optional().or(z.literal("")),
});

router.patch("/account/settings", requireApiKey, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });

  const updated = await updateUserSettings(req.userId, {
    ...parsed.data,
    slackWebhookUrl: parsed.data.slackWebhookUrl || undefined,
  });
  res.json(updated);
});

router.get("/account/referral", requireApiKey, async (req, res) => {
  if (req.userId === DEFAULT_USER_ID) return res.status(401).json({ error: "Log in first." });
  res.json(await getReferralStats(req.userId));
});

/**
 * Full self-serve export of everything this app stores about the account —
 * required for basic trust/GDPR compliance once this is a paid product, not
 * just the LinkedIn-contacts export that /api/export/all already covers.
 */
router.get("/account/export", requireApiKey, async (req, res) => {
  if (req.userId === DEFAULT_USER_ID) {
    return res.status(400).json({ error: "Log in to export your account data." });
  }

  const [persons, leads, jobs, resume, audit] = await Promise.all([
    listPersons(req.userId),
    listLeads(req.userId),
    listJobs(req.userId),
    getResume(req.userId),
    listAudit(req.userId),
  ]);

  res.setHeader("Content-Disposition", "attachment; filename=my-account-data.json");
  res.json({
    exportedAt: new Date().toISOString(),
    persons,
    leads,
    jobs,
    resume,
    auditLog: audit,
  });
});

const KV_KEY_BASES = ["persons", "leads", "jobs", "resume", "googleAuth"];

const deleteSchema = z.object({ password: z.string().min(1) });

/**
 * Irreversibly wipes every user-scoped key this account owns, then deletes
 * the account record itself. Requires re-entering the password (not just a
 * click) since this can't be undone — same bar as any other destructive
 * action a real SaaS gates behind re-authentication.
 */
router.delete("/account", requireApiKey, async (req, res) => {
  if (req.userId === DEFAULT_USER_ID) {
    return res.status(400).json({ error: "Log in to delete your account." });
  }

  const parsed = deleteSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Password is required to confirm deletion." });

  const email = await getUserEmailById(req.userId);
  if (!email) return res.status(404).json({ error: "Account not found." });

  const verified = await login(email, parsed.data.password);
  if (!verified) return res.status(401).json({ error: "Incorrect password." });

  await Promise.all(KV_KEY_BASES.map((base) => writeJson(userScopedKey(base, req.userId), {})));
  await logAction(req.userId, "account_deleted", `Account ${email} deleted all data.`);
  await deleteUser(req.userId);

  res.json({ deleted: true });
});

export default router;
