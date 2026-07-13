import { Router } from "express";
import { z } from "zod";
import {
  isConfigured,
  getAuthUrl,
  exchangeCodeForTokens,
  isConnected,
  sendEmail,
} from "../services/gmail";
import { clearTokens } from "../services/googleAuthStore";
import { getPerson, updatePerson } from "../services/personStore";
import { requireApiKey } from "../middleware/apiKey";

const router = Router();

router.get("/auth/google", (_req, res) => {
  if (!isConfigured()) {
    return res
      .status(500)
      .send("Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.");
  }
  res.redirect(getAuthUrl());
});

router.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string") {
    return res.status(400).send("Missing authorization code.");
  }

  try {
    await exchangeCodeForTokens(code);
    res.send(
      "<html><body style='font-family:sans-serif;padding:2rem'><h2>Gmail connected.</h2><p>You can close this tab and go back to the app.</p></body></html>"
    );
  } catch (err) {
    console.error("Google OAuth callback failed", err);
    res.status(500).send(`Failed to connect Gmail: ${err instanceof Error ? err.message : "unknown error"}`);
  }
});

router.get("/auth/google/status", async (_req, res) => {
  res.json({ configured: isConfigured(), connected: await isConnected() });
});

router.post("/auth/google/disconnect", requireApiKey, async (_req, res) => {
  await clearTokens();
  res.json({ connected: false });
});

const sendEmailSchema = z.object({
  to: z.string().trim().email(),
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  linkedinUrl: z.string().trim().url().optional(),
});

/**
 * The one place real send automation is legitimate: this is the user's own
 * Gmail account, sending with their explicit OAuth grant. Still requires a
 * manual click from the queue view — never triggered on a timer or in bulk
 * without a click per email.
 */
router.post("/send-email", requireApiKey, async (req, res) => {
  const parsed = sendEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    await sendEmail(parsed.data.to, parsed.data.subject, parsed.data.body);

    if (parsed.data.linkedinUrl) {
      const person = await getPerson(parsed.data.linkedinUrl);
      if (person) {
        await updatePerson(parsed.data.linkedinUrl, {
          notes: [
            ...person.notes,
            { text: `Sent email to ${parsed.data.to} via Gmail.`, createdAt: new Date().toISOString() },
          ],
        });
      }
    }

    res.json({ sent: true });
  } catch (err) {
    console.error("Send email failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to send email." });
  }
});

export default router;
