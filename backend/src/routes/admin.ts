import { Router } from "express";
import { requireApiKey } from "../middleware/apiKey";
import { listAllUsers, getUserEmailById } from "../services/userStore";

const router = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Gated by a hardcoded env-var allowlist rather than a new role/permission
 * system — this is an operator view for the person running the business,
 * not a customer-facing feature, so it doesn't need general RBAC.
 */
async function requireAdmin(req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) {
  if (req.userId === "default") return res.status(403).json({ error: "Admin access required." });
  const email = await getUserEmailById(req.userId);
  if (!email || !ADMIN_EMAILS.includes(email.toLowerCase())) {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}

router.get("/admin/summary", requireApiKey, requireAdmin, async (_req, res) => {
  const users = await listAllUsers();

  const tierCounts = { free: 0, pro: 0, team: 0 };
  const signupsByDay: Record<string, number> = {};

  for (const user of users) {
    tierCounts[user.tier] += 1;
    const day = user.createdAt.slice(0, 10);
    signupsByDay[day] = (signupsByDay[day] ?? 0) + 1;
  }

  res.json({
    totalUsers: users.length,
    tierCounts,
    verifiedCount: users.filter((u) => u.emailVerified).length,
    signupsByDay,
    payingUsers: tierCounts.pro + tierCounts.team,
  });
});

export default router;
