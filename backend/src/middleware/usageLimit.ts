import { Request, Response, NextFunction } from "express";
import { readJson, writeJson, userScopedKey } from "../services/kvStore";
import { TIER_LIMITS, isBillingConfigured } from "../services/billing";

type LimitedResource = "draftsPerMonth" | "reportsPerMonth";

async function getUserTierCached(userId: string): Promise<"free" | "pro" | "team"> {
  const { getUserById } = await import("../services/userStore");
  const user = await getUserById(userId);
  return user?.tier ?? "free";
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}`;
}

/**
 * Counts a monthly-reset resource (AI drafts, reports) and blocks with 402
 * once the tier's cap is hit. Contacts (a running total, not monthly) are
 * checked separately in crm.ts against listPersons().length directly, since
 * that's a simple current-count check rather than an incrementing counter.
 *
 * Skips enforcement entirely when billing isn't configured (no Stripe keys
 * set) — a self-hosted/free deployment without billing shouldn't have
 * artificial caps with no way to pay past them.
 */
export function enforceMonthlyLimit(resource: LimitedResource) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!isBillingConfigured()) return next();
    if (req.userId === "default") return next(); // shared/no-login namespace stays uncapped

    const tier = await getUserTierCached(req.userId);
    const limit = TIER_LIMITS[tier][resource];

    const key = userScopedKey(`usage:${resource}:${currentMonthKey()}`, req.userId);
    const count = await readJson<number>(key, 0);

    if (count >= limit) {
      return res.status(402).json({
        error: `You've reached your ${tier} plan's monthly limit (${limit}) for this feature. Upgrade to continue.`,
        upgradeRequired: true,
        tier,
        limit,
      });
    }

    await writeJson(key, count + 1);
    next();
  };
}
