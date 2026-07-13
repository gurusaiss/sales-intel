import { readJson, writeJson } from "./kvStore";

interface GoogleTokens {
  refreshToken: string;
  accessToken?: string;
  expiresAt?: number; // epoch ms
}

export async function readTokens(): Promise<GoogleTokens | null> {
  const tokens = await readJson<GoogleTokens | null>("googleAuth", null);
  return tokens?.refreshToken ? tokens : null;
}

export async function writeTokens(tokens: GoogleTokens): Promise<void> {
  await writeJson("googleAuth", tokens);
}

export async function clearTokens(): Promise<void> {
  await writeJson("googleAuth", {});
}
