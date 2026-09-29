import { useState, useEffect, type FormEvent } from "react";
import { signupUser, loginUser, logoutUser, fetchCurrentUser, requestPasswordReset } from "./api";

export default function AuthBar() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((data) => setLoggedIn(data.loggedIn))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "forgot") {
        await requestPasswordReset(email);
        setResetSent(true);
      } else if (mode === "signup") {
        const ref = localStorage.getItem("referralCode") ?? undefined;
        await signupUser(email, password, ref);
        setLoggedIn(true);
        setShowForm(false);
      } else {
        await loginUser(email, password);
        setLoggedIn(true);
        setShowForm(false);
      }
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    logoutUser();
    setLoggedIn(false);
  }

  if (loggedIn) {
    return (
      <div className="auth-bar">
        <span className="form-hint">Logged in — this data is private to your account.</span>
        <button className="ghost-button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      {!showForm ? (
        <>
          <span className="form-hint">
            Not logged in — using shared data. Log in for your own private account.
          </span>
          <button className="ghost-button" onClick={() => setShowForm(true)}>
            Log in / Sign up
          </button>
        </>
      ) : (
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {mode !== "forgot" && (
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          )}
          {resetSent ? (
            <span className="form-hint">Check your email for a reset link.</span>
          ) : (
            <button type="submit" disabled={loading}>
              {loading ? "…" : mode === "login" ? "Log in" : mode === "signup" ? "Sign up" : "Send reset link"}
            </button>
          )}
          {mode !== "forgot" && (
            <button
              type="button"
              className="ghost-button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
            >
              {mode === "login" ? "Need an account?" : "Have an account?"}
            </button>
          )}
          {mode === "login" && (
            <button type="button" className="ghost-button" onClick={() => setMode("forgot")}>
              Forgot password?
            </button>
          )}
          {mode === "forgot" && (
            <button type="button" className="ghost-button" onClick={() => { setMode("login"); setResetSent(false); }}>
              Back to log in
            </button>
          )}
          <button type="button" className="ghost-button" onClick={() => setShowForm(false)}>
            Cancel
          </button>
          {error && <span className="error-banner">{error}</span>}
        </form>
      )}
    </div>
  );
}
