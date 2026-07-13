import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "crypto";
import { readJson, writeJson } from "./kvStore";

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string; // "salt:hash", both hex
  createdAt: string;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: string;
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
  return { id: user.id, email: user.email, createdAt: user.createdAt };
}

/**
 * Development-mode signup: any email/password creates an account, exactly
 * as specified. No email verification, no password strength enforcement
 * beyond a sane minimum length — this is intentionally permissive for now.
 */
export async function signup(email: string, password: string): Promise<PublicUser> {
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
