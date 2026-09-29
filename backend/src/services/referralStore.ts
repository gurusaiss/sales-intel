import { randomBytes } from "crypto";
import { readJson, writeJson, withKeyLock } from "./kvStore";

interface ReferralRecord {
  code: string;
  ownerUserId: string;
  referredUserIds: string[];
  convertedUserIds: string[]; // referred users who became paying customers
  createdAt: string;
}

async function readAll(): Promise<Record<string, ReferralRecord>> {
  return readJson<Record<string, ReferralRecord>>("referrals", {});
}

async function writeAll(data: Record<string, ReferralRecord>): Promise<void> {
  await writeJson("referrals", data);
}

/**
 * Every user gets a stable referral code, created lazily on first request
 * rather than at signup — keeps signup itself simple and this only runs for
 * users who actually open the "invite" UI.
 */
export async function getOrCreateReferralCode(userId: string): Promise<string> {
  const all = await readAll();
  const existing = Object.values(all).find((r) => r.ownerUserId === userId);
  if (existing) return existing.code;

  const code = randomBytes(4).toString("hex");
  all[code] = { code, ownerUserId: userId, referredUserIds: [], convertedUserIds: [], createdAt: new Date().toISOString() };
  await writeAll(all);
  return code;
}

export async function recordReferralSignup(code: string, newUserId: string): Promise<void> {
  await withKeyLock("referrals", async () => {
    const all = await readAll();
    const record = all[code];
    if (!record || record.ownerUserId === newUserId) return; // unknown code, or self-referral
    if (!record.referredUserIds.includes(newUserId)) record.referredUserIds.push(newUserId);
    await writeAll(all);
  });
}

/**
 * Called from the Stripe webhook when a referred user's subscription goes
 * active. Marking conversion here (rather than granting a reward
 * automatically) keeps this a simple, auditable ledger for now — payout/free
 * month logic is a manual step until volume justifies automating it.
 */
export async function recordReferralConversion(convertedUserId: string): Promise<string | null> {
  return withKeyLock("referrals", async () => {
    const all = await readAll();
    const record = Object.values(all).find((r) => r.referredUserIds.includes(convertedUserId));
    if (!record) return null;
    if (!record.convertedUserIds.includes(convertedUserId)) record.convertedUserIds.push(convertedUserId);
    await writeAll(all);
    return record.ownerUserId;
  });
}

export async function getReferralStats(userId: string): Promise<{
  code: string;
  referredCount: number;
  convertedCount: number;
}> {
  const code = await getOrCreateReferralCode(userId);
  const all = await readAll();
  const record = all[code];
  return {
    code,
    referredCount: record?.referredUserIds.length ?? 0,
    convertedCount: record?.convertedUserIds.length ?? 0,
  };
}
