import { listAllUsers } from "./userStore";
import { getUserSettings } from "./userSettings";
import { listPersons } from "./personStore";
import { sendTransactionalEmail } from "./email";

const REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // last 7 days

/**
 * Opt-in only (checks settings.digestEnabled per user) — this is the one
 * genuinely "automatic" email in the app, and it's explicitly gated behind
 * a user toggle rather than on by default, consistent with every other
 * outbound-action rule in this codebase (no silent sends).
 */
export async function sendWeeklyDigests(): Promise<void> {
  const users = await listAllUsers();

  for (const user of users) {
    const settings = await getUserSettings(user.id);
    if (!settings.digestEnabled) continue;

    const persons = await listPersons(user.id);
    const now = Date.now();
    const repliedRecently = persons.filter(
      (p) => p.lastReplyAt && now - new Date(p.lastReplyAt).getTime() < REPLY_WINDOW_MS
    );
    const needsFollowUp = persons.filter((p) => p.status === "no_reply" && p.followUpCount > 0);

    if (repliedRecently.length === 0 && needsFollowUp.length === 0) continue;

    const html = `
      <h2>Your weekly Sales Intel digest</h2>
      <p><strong>${repliedRecently.length}</strong> people replied this week: ${repliedRecently.map((p) => p.name).join(", ") || "none"}</p>
      <p><strong>${needsFollowUp.length}</strong> people are waiting on a follow-up.</p>
      <p><a href="${process.env.APP_URL || "http://localhost:5173"}">Open your queue</a></p>
    `;
    await sendTransactionalEmail(user.email, "Your weekly Sales Intel digest", html);

    if (settings.slackWebhookUrl) {
      await postSlackDigest(settings.slackWebhookUrl, repliedRecently.length, needsFollowUp.length);
    }
  }
}

async function postSlackDigest(webhookUrl: string, repliedCount: number, pendingCount: number): Promise<void> {
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `📊 Weekly digest: ${repliedCount} replies this week, ${pendingCount} people waiting on follow-up.`,
      }),
    });
  } catch (err) {
    console.error("[digest] Slack webhook post failed", err);
  }
}
