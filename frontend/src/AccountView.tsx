import { useState, useEffect, type FormEvent } from "react";
import {
  fetchAccountSettings,
  updateAccountSettings,
  fetchReferralStats,
  downloadAccountExport,
  deleteAccount,
  openBillingPortal,
  resendVerificationEmail,
  fetchCurrentUser,
  type UserSettings,
  type ReferralStats,
} from "./api";

export default function AccountView() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [referral, setReferral] = useState<ReferralStats | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [emailVerified, setEmailVerified] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((data) => {
        setLoggedIn(data.loggedIn);
        setEmailVerified(data.emailVerified ?? true);
      })
      .catch(() => {});
    fetchAccountSettings().then(setSettings).catch(() => {});
    fetchReferralStats()
      .then(setReferral)
      .catch(() => {}); // fails silently when not logged in
  }, []);

  async function handleSettingsSave(patch: Partial<UserSettings>) {
    setError(null);
    try {
      const updated = await updateAccountSettings(patch);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function handlePortal() {
    try {
      const url = await openBillingPortal();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open billing portal");
    }
  }

  async function handleResendVerification() {
    try {
      await resendVerificationEmail();
      setVerificationSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification email");
    }
  }

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await deleteAccount(deletePassword);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    }
  }

  if (!loggedIn) {
    return <p className="empty-state">Log in to manage your account, billing, and data.</p>;
  }

  const referralLink = referral ? `${window.location.origin}/?ref=${referral.code}` : "";

  return (
    <div className="result">
      {error && <div className="error-banner">{error}</div>}

      {!emailVerified && (
        <div className="card highlight">
          <p className="subline">Your email isn't verified yet.</p>
          <button className="ghost-button" onClick={handleResendVerification} disabled={verificationSent}>
            {verificationSent ? "Verification email sent" : "Resend verification email"}
          </button>
        </div>
      )}

      <section className="card">
        <h2>Billing</h2>
        <p className="subline">Manage your plan, payment method, or cancel — handled entirely by Stripe.</p>
        <button className="ghost-button" onClick={handlePortal}>
          Open billing portal
        </button>
      </section>

      <section className="card">
        <h2>Notifications</h2>
        {settings && (
          <>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}>
              <input
                type="checkbox"
                checked={settings.digestEnabled}
                onChange={(e) => handleSettingsSave({ digestEnabled: e.target.checked })}
              />
              Weekly email digest (who replied, who needs follow-up)
            </label>
            <label className="field-label" htmlFor="slack-webhook" style={{ marginTop: "0.6rem", display: "block" }}>
              Slack webhook URL (optional)
            </label>
            <input
              id="slack-webhook"
              type="text"
              className="query-input"
              placeholder="https://hooks.slack.com/services/…"
              defaultValue={settings.slackWebhookUrl ?? ""}
              onBlur={(e) => handleSettingsSave({ slackWebhookUrl: e.target.value.trim() })}
            />
            {saved && <span className="form-hint">Saved.</span>}
          </>
        )}
      </section>

      <section className="card">
        <h2>Invite others</h2>
        {referral ? (
          <>
            <p className="subline">
              {referral.referredCount} people signed up with your link, {referral.convertedCount} became paying
              customers.
            </p>
            <input type="text" className="query-input" readOnly value={referralLink} onFocus={(e) => e.target.select()} />
          </>
        ) : (
          <p className="subline">Loading…</p>
        )}
      </section>

      <section className="card">
        <h2>Your data</h2>
        <div className="queue-actions">
          <button className="ghost-button" onClick={() => downloadAccountExport().catch((err) => setError(err.message))}>
            Export all my data
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Delete account</h2>
        <p className="subline">
          Permanently deletes every contact, lead, job application, and setting tied to this
          account. Cannot be undone.
        </p>
        {!confirmingDelete ? (
          <button className="ghost-button danger" onClick={() => setConfirmingDelete(true)}>
            Delete my account
          </button>
        ) : (
          <form className="search-form" onSubmit={handleDelete}>
            <input
              type="password"
              className="query-input"
              placeholder="Confirm your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
            />
            <button type="submit" className="ghost-button danger">
              Permanently delete
            </button>
            <button type="button" className="ghost-button" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
