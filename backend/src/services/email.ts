const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.RESEND_FROM || "Sales Intel <onboarding@resend.dev>";

export function isEmailConfigured(): boolean {
  return Boolean(RESEND_API_KEY);
}

/**
 * Resend (free tier: 3,000 emails/month, no card) — used for password reset,
 * email verification, and the opt-in weekly digest. Every use of this is
 * either a direct response to a user action (reset request, signup) or an
 * explicit opt-in (digest), never a silent/unsolicited send. Fails silently
 * (logs, doesn't throw) when unconfigured so local dev/free deployments
 * without a Resend key don't break — callers should still work, just without
 * the email actually landing.
 */
export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn(`[email] RESEND_API_KEY not set — skipping email to ${to}: "${subject}"`);
    return false;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: FROM_ADDRESS, to, subject, html }),
    });

    if (!res.ok) {
      console.error("[email] Resend send failed", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] Resend request failed", err);
    return false;
  }
}
