import { readJson, writeJson, userScopedKey } from "./kvStore";

interface GoogleTokens {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number; // epoch ms
}

export async function readTokens(userId: string): Promise<GoogleTokens | null> {
  const tokens = await readJson<GoogleTokens | null>(userScopedKey("googleAuth", userId), null);
  return tokens?.refreshToken ? tokens : null;
}

export async function writeTokens(userId: string, tokens: GoogleTokens): Promise<void> {
  await writeJson(userScopedKey("googleAuth", userId), tokens);
}

export async function clearTokens(userId: string): Promise<void> {
  await writeJson(userScopedKey("googleAuth", userId), {});
}
