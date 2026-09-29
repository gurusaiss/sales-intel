import { readJson, writeJson, userScopedKey } from "./kvStore";

export interface UserSettings {
  digestEnabled: boolean;
  slackWebhookUrl?: string;
}

const DEFAULTS: UserSettings = { digestEnabled: false };

export async function getUserSettings(userId: string): Promise<UserSettings> {
  return readJson<UserSettings>(userScopedKey("settings", userId), DEFAULTS);
}

export async function updateUserSettings(userId: string, patch: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getUserSettings(userId);
  const updated = { ...current, ...patch };
  await writeJson(userScopedKey("settings", userId), updated);
  return updated;
}
