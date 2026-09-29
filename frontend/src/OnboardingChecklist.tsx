import { useState, useEffect } from "react";
import { fetchAllPersons, fetchJobs, fetchCurrentUser } from "./api";

const DISMISS_KEY = "onboardingDismissed";

interface Step {
  label: string;
  done: boolean;
  tab: string;
}

export default function OnboardingChecklist({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === "1");
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setLoggedIn(u.loggedIn))
      .catch(() => {});

    Promise.all([fetchAllPersons().catch(() => []), fetchJobs().catch(() => [])]).then(
      ([persons, jobs]) => {
        setSteps([
          { label: "Capture a LinkedIn contact (via the extension)", done: persons.length > 0, tab: "queue" },
          { label: "Run a company search", done: false, tab: "companies" },
          { label: "Analyze a website", done: false, tab: "analyze" },
          { label: "Track a job application", done: jobs.length > 0, tab: "career" },
        ]);
      }
    );
  }, []);

  if (dismissed || !steps || !loggedIn) return null;
  const remaining = steps.filter((s) => !s.done);
  if (remaining.length === 0) return null;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="card highlight" style={{ marginBottom: "1rem" }}>
      <div className="queue-card-header">
        <span className="card-label">Get started — {steps.length - remaining.length}/{steps.length} done</span>
        <button className="ghost-button" onClick={dismiss} aria-label="Dismiss">
          Dismiss
        </button>
      </div>
      <div className="tag-row" style={{ marginTop: "0.5rem" }}>
        {steps.map((s) => (
          <button
            key={s.label}
            className="ghost-button"
            style={s.done ? { opacity: 0.5, textDecoration: "line-through" } : undefined}
            onClick={() => onNavigate(s.tab)}
          >
            {s.done ? "✓ " : ""}
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
