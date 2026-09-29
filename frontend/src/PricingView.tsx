import { useState, useEffect } from "react";
import { fetchBillingStatus, startCheckout, type BillingStatus } from "./api";

const TIERS: { id: "free" | "pro" | "team"; name: string; price: string }[] = [
  { id: "free", name: "Free", price: "$0" },
  { id: "pro", name: "Pro", price: "$19/mo" },
  { id: "team", name: "Team", price: "$49/mo" },
];

export default function PricingView() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingTier, setStartingTier] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingStatus()
      .then(setStatus)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load pricing"));
  }, []);

  async function handleUpgrade(tier: "pro" | "team") {
    setStartingTier(tier);
    setError(null);
    try {
      const url = await startCheckout(tier);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start checkout");
    } finally {
      setStartingTier(null);
    }
  }

  return (
    <div className="result">
      <section className="card highlight">
        <span className="card-label">Why this, not a scraper</span>
        <p>
          Most LinkedIn outreach tools get banned or shut down — they automate clicks and page reads
          in ways that violate LinkedIn's terms and trigger detection. This app never automates
          LinkedIn interaction beyond a single click you make yourself. That's not a limitation, it's
          the whole point: your account stays yours.
        </p>
      </section>

      {error && <div className="error-banner">{error}</div>}
      {!status?.configured && (
        <div className="card">
          <p className="subline">
            Billing isn't configured on this deployment yet — every tier is unlimited until Stripe
            keys are set.
          </p>
        </div>
      )}

      <div className="field-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {TIERS.map((tier) => {
          const limits = status?.limits[tier.id];
          return (
            <section className="card" key={tier.id}>
              <h2>{tier.name}</h2>
              <p className="subline" style={{ fontSize: "1.4rem", fontWeight: 700 }}>{tier.price}</p>
              {limits && (
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.85rem", lineHeight: 1.7 }}>
                  <li>{limits.contacts} tracked contacts</li>
                  <li>{limits.draftsPerMonth} AI drafts/month</li>
                  <li>{limits.reportsPerMonth} site analyses/month</li>
                </ul>
              )}
              {tier.id !== "free" && status?.configured && (
                <button
                  className="ghost-button accent"
                  disabled={startingTier === tier.id}
                  onClick={() => handleUpgrade(tier.id as "pro" | "team")}
                >
                  {startingTier === tier.id ? "Redirecting…" : `Upgrade to ${tier.name}`}
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
