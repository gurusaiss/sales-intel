export default function LegalView() {
  return (
    <div className="result">
      <section className="card highlight">
        <span className="card-label">What this app does and does not automate</span>
        <p>
          Sales Intel captures LinkedIn contact info and messages only when you click a button on a
          page you already have open — never on page load, never in the background, never across
          multiple profiles in one action. It never logs into LinkedIn on your behalf, never
          simulates browsing, and never sends anything without you clicking "send." This is a
          permanent design constraint, not a limitation we plan to lift.
        </p>
      </section>

      <section className="card">
        <h2>Privacy Policy</h2>
        <p className="subline">Last updated: reflects the current codebase.</p>
        <p>
          <strong>What we store:</strong> the LinkedIn contacts, company leads, job applications, and
          resume text you explicitly capture or enter, tied to your account. If you connect Google,
          we store an OAuth refresh token to send email/create Calendar events on your behalf when
          you click those buttons — never automatically.
        </p>
        <p>
          <strong>Where it's stored:</strong> a Redis-compatible key-value store (Upstash), scoped
          per account. We do not sell or share your data with third parties, except the AI provider
          (Groq) and enrichment providers (Hunter.io/Snov.io) strictly to serve your own requests.
        </p>
        <p>
          <strong>Your rights:</strong> export everything we have on your account, or permanently
          delete your account and all associated data, anytime from Account settings.
        </p>
      </section>

      <section className="card">
        <h2>Terms of Service</h2>
        <p>
          You're responsible for how you use captured contact information — this tool assists
          manual, compliant outreach; it does not grant permission to violate LinkedIn's or any
          other platform's terms of service. Accounts are billed via Stripe on a monthly
          subscription, cancellable anytime through the billing portal. We offer no uptime SLA on
          the free tier.
        </p>
      </section>
    </div>
  );
}
