import { Router } from "express";
import { z } from "zod";
import {
  isBillingConfigured,
  TIER_LIMITS,
  createCheckoutSession,
  createPortalSession,
  verifyStripeWebhookSignature,
} from "../services/billing";
import {
  getUserEmailById,
  getStripeCustomerId,
  getUserByStripeCustomerId,
  setUserTier,
} from "../services/userStore";
import { recordReferralConversion } from "../services/referralStore";
import { requireApiKey } from "../middleware/apiKey";

const router = Router();

router.get("/billing/status", async (req, res) => {
  res.json({
    configured: isBillingConfigured(),
    limits: TIER_LIMITS,
  });
});

const checkoutSchema = z.object({ tier: z.enum(["pro", "team"]) });

router.post("/billing/checkout", requireApiKey, async (req, res) => {
  if (req.userId === "default") return res.status(401).json({ error: "Log in first." });
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid tier." });

  const email = await getUserEmailById(req.userId);
  if (!email) return res.status(404).json({ error: "User not found." });

  try {
    const existingCustomerId = await getStripeCustomerId(req.userId);
    const url = await createCheckoutSession(req.userId, email, parsed.data.tier, existingCustomerId);
    res.json({ url });
  } catch (err) {
    console.error("Checkout session creation failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to start checkout." });
  }
});

router.post("/billing/portal", requireApiKey, async (req, res) => {
  if (req.userId === "default") return res.status(401).json({ error: "Log in first." });
  const customerId = await getStripeCustomerId(req.userId);
  if (!customerId) return res.status(400).json({ error: "No billing account yet — subscribe first." });

  try {
    const url = await createPortalSession(customerId);
    res.json({ url });
  } catch (err) {
    console.error("Portal session creation failed", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to open billing portal." });
  }
});

/**
 * Stripe webhook — mounted with express.raw() in index.ts BEFORE the global
 * express.json() middleware, because signature verification needs the exact
 * raw request bytes, not a re-serialized JSON object.
 */
router.post("/billing/webhook", async (req, res) => {
  const signature = req.header("stripe-signature");
  const rawBody = (req.body as Buffer)?.toString("utf-8") ?? "";

  if (!signature || !verifyStripeWebhookSignature(rawBody, signature)) {
    return res.status(400).send("Invalid signature");
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).send("Invalid payload");
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const tier = session.metadata?.tier;
      if (userId && (tier === "pro" || tier === "team")) {
        await setUserTier(userId, tier, session.customer, session.subscription);
        await recordReferralConversion(userId);
      }
    }

    // Tier assignment happens at checkout.session.completed above; this only
    // handles the downgrade path (cancellation or payment failure) — a plan
    // change (free tier upsell handled by a new checkout, not a Stripe
    // portal plan switch) would need a price->tier lookup this app doesn't
    // need yet with only two paid tiers.
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const user = await getUserByStripeCustomerId(subscription.customer);
      if (user) await setUserTier(user.id, "free", subscription.customer, undefined);
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const user = await getUserByStripeCustomerId(subscription.customer);
      const inactive = !["active", "trialing"].includes(subscription.status);
      if (user && inactive) await setUserTier(user.id, "free", subscription.customer, undefined);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handler failed", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
});

export default router;
