import { useState, useEffect } from "react";
import { verifyEmail } from "./api";

export default function VerifyEmailPage({ token }: { token: string }) {
  const [status, setStatus] = useState<"verifying" | "done" | "error">("verifying");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifyEmail(token)
      .then(() => setStatus("done"))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Verification failed");
        setStatus("error");
      });
  }, [token]);

  return (
    <div className="app" style={{ maxWidth: 420, margin: "4rem auto" }}>
      <h1>Email verification</h1>
      {status === "verifying" && <p className="subline">Verifying…</p>}
      {status === "done" && (
        <>
          <p className="subline">Your email is verified.</p>
          <a className="ghost-button accent" href="/">
            Go to app
          </a>
        </>
      )}
      {status === "error" && <div className="error-banner">{error}</div>}
    </div>
  );
}
