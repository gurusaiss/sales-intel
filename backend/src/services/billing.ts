import { createHmac, timingSafeEqual } from "crypto";
import type { BillingTier } from "./userStore";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_PRO = process.env.STRIPE_PRICE_PRO;
const STRIPE_PRICE_TEAM = process.env.STRIPE_PRICE_TEAM;
const APP_URL = process.env.APP_URL || "http://localhost:5173";

export function isBillingConfigured(): boolean {
  return Boolean(STRIPE_SECRET_KEY && STRIPE_PRICE_PRO && STRIPE_PRICE_TEAM);
}

/**
 * Per-tier usage caps, enforced server-side in usageLimit.ts — the free tier
 * is genuinely usable (not a crippled trial) but capped enough that anyone
 * doing real outreach volume hits the ceiling and has a reason to upgrade.
 */
export const TIER_LIMITS: Record<BillingTier, { contacts: number; draftsPerMonth: number; reportsPerMonth: number }> = {
  free: { contacts: 25, draftsPerMonth: 20, reportsPerMonth: 2 },
  pro: { contacts: 500, draftsPerMonth: 300, reportsPerMonth: 30 },
  team: { contacts: 5000, draftsPerMonth: 2000, reportsPerMonth: 200 },
};

function priceIdForTier(tier: "pro" | "team"): string {
  const id = tier === "pro" ? STRIPE_PRICE_PRO : STRIPE_PRICE_TEAM;
  if (!id) throw new Error(`Stripe price ID for ${tier} is not configured.`);
  return id;
}

interface StripeErrorResponse {
  error?: { message?: string };
  [key: string]: unknown;
}

async function stripeRequest(path: string, body: Record<string, string>): Promise<StripeErrorResponse> {
  if (!STRIPE_SECRET_KEY) throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing).");

  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
  });

  const data = (await res.json()) as StripeErrorResponse;
  if (!res.ok) {
    throw new Error(`Stripe API error (${path}): ${data?.error?.message || res.status}`);
  }
  return data;
}

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  tier: "pro" | "team",
  existingCustomerId?: string
): Promise<string> {
  const body: Record<string, string> = {
    mode: "subscription",
    "line_items[0][price]": priceIdForTier(tier),
    "line_items[0][quantity]": "1",
    success_url: `${APP_URL}/?billing=success`,
    cancel_url: `${APP_URL}/?billing=cancelled`,
    "metadata[userId]": userId,
    "metadata[tier]": tier,
  };
  if (existingCustomerId) body.customer = existingCustomerId;
  else body.customer_email = userEmail;

  const session = await stripeRequest("checkout/sessions", body);
  return session.url as string;
}

export async function createPortalSession(customerId: string): Promise<string> {
  const session = await stripeRequest("billing_portal/sessions", {
    customer: customerId,
    return_url: `${APP_URL}/`,
  });
  return session.url as string;
}

/**
 * Verifies Stripe's webhook signature by hand (HMAC-SHA256 over
 * "timestamp.payload", per Stripe's documented scheme) — avoids pulling in
 * the full stripe SDK just for signature checking, consistent with the rest
 * of this codebase's fetch-only approach to third-party APIs.
 */
export function verifyStripeWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  if (!STRIPE_WEBHOOK_SECRET) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((kv) => {
      const [k, v] = kv.split("=");
      return [k, v];
    })
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const expected = createHmac("sha256", STRIPE_WEBHOOK_SECRET)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
