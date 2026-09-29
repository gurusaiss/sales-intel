import { useState, type FormEvent } from "react";
import { resetPassword } from "./api";

export default function ResetPasswordPage({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app" style={{ maxWidth: 420, margin: "4rem auto" }}>
      <h1>Reset your password</h1>
      {done ? (
        <>
          <p className="subline">Your password has been reset. You're logged in — you can close this tab and go back to the app.</p>
          <a className="ghost-button accent" href="/">
            Go to app
          </a>
        </>
      ) : (
        <form className="search-form" onSubmit={handleSubmit} style={{ flexDirection: "column", alignItems: "stretch" }}>
          <input
            type="password"
            className="query-input"
            placeholder="New password"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? "Resetting…" : "Reset password"}
          </button>
          {error && <div className="error-banner">{error}</div>}
        </form>
      )}
    </div>
  );
}
