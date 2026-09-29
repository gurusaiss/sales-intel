import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { readJson, writeJson } from "./kvStore";

export type BillingTier = "free" | "pro" | "team";

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string; // "salt:hash", both hex
  createdAt: string;
  emailVerified: boolean;
  tier: BillingTier;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  referredBy?: string; // referral code of whoever referred this signup
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  tier: BillingTier;
}

async function readUsers(): Promise<Record<string, StoredUser>> {
  return readJson<Record<string, StoredUser>>("users", {});
}

async function writeUsers(data: Record<string, StoredUser>): Promise<void> {
  await writeJson("users", data);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
    emailVerified: user.emailVerified,
    tier: user.tier,
  };
}

/**
 * Signup: any email/password creates an account. Starts unverified on the
 * free tier — email verification is a soft gate (the app stays usable, a
 * banner nudges verification) rather than blocking signup outright.
 */
export async function signup(
  email: string,
  password: string,
  referredBy?: string
): Promise<PublicUser> {
  const emailLower = email.trim().toLowerCase();
  const users = await readUsers();

  if (users[emailLower]) {
    throw new Error("An account with this email already exists.");
  }

  const user: StoredUser = {
    id: randomUUID(),
    email: emailLower,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    emailVerified: false,
    tier: "free",
    referredBy,
  };

  users[emailLower] = user;
  await writeUsers(users);
  return toPublicUser(user);
}

export async function login(email: string, password: string): Promise<PublicUser | null> {
  const users = await readUsers();
  const user = users[email.trim().toLowerCase()];
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return toPublicUser(user);
}

export async function getUserById(userId: string): Promise<PublicUser | null> {
  const users = await readUsers();
  const match = Object.values(users).find((u) => u.id === userId);
  return match ? toPublicUser(match) : null;
}

export async function findUserIdByEmail(email: string): Promise<string | null> {
  const users = await readUsers();
  return users[email.trim().toLowerCase()]?.id ?? null;
}

export async function getUserEmailById(userId: string): Promise<string | null> {
  const users = await readUsers();
  return Object.values(users).find((u) => u.id === userId)?.email ?? null;
}

export async function markEmailVerified(userId: string): Promise<void> {
  const users = await readUsers();
  const match = Object.values(users).find((u) => u.id === userId);
  if (!match) return;
  match.emailVerified = true;
  await writeUsers(users);
}

export async function setPassword(userId: string, newPassword: string): Promise<boolean> {
  const users = await readUsers();
  const match = Object.values(users).find((u) => u.id === userId);
  if (!match) return false;
  match.passwordHash = hashPassword(newPassword);
  await writeUsers(users);
  return true;
}

export async function setUserTier(
  userId: string,
  tier: BillingTier,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
): Promise<void> {
  const users = await readUsers();
  const match = Object.values(users).find((u) => u.id === userId);
  if (!match) return;
  match.tier = tier;
  if (stripeCustomerId) match.stripeCustomerId = stripeCustomerId;
  if (stripeSubscriptionId !== undefined) match.stripeSubscriptionId = stripeSubscriptionId || undefined;
  await writeUsers(users);
}

export async function getUserByStripeCustomerId(stripeCustomerId: string): Promise<PublicUser | null> {
  const users = await readUsers();
  const match = Object.values(users).find((u) => u.stripeCustomerId === stripeCustomerId);
  return match ? toPublicUser(match) : null;
}

export async function getStripeCustomerId(userId: string): Promise<string | undefined> {
  const users = await readUsers();
  return Object.values(users).find((u) => u.id === userId)?.stripeCustomerId;
}

/** For the admin view and the weekly digest job — both need every account. */
export async function listAllUsers(): Promise<PublicUser[]> {
  const users = await readUsers();
  return Object.values(users).map(toPublicUser);
}

export async function deleteUser(userId: string): Promise<void> {
  const users = await readUsers();
  const emailKey = Object.keys(users).find((k) => users[k].id === userId);
  if (!emailKey) return;
  delete users[emailKey];
  await writeUsers(users);
}
