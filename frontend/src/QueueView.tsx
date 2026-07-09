import { useState, useEffect, useCallback } from "react";
import { fetchQueue, updatePersonStatus } from "./api";
import type { QueueItem } from "./types";

export default function QueueView() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQueue(15);
      setItems(data.queue);
      setTotalPending(data.totalPending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCopy(id: string, draft: string) {
    await navigator.clipboard.writeText(draft);
    setCopiedId(id);
    setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 2000);
  }

  async function handleStatus(linkedinUrl: string, status: "replied" | "do_not_contact") {
    await updatePersonStatus(linkedinUrl, status);
    setItems((current) => current.filter((item) => item.person.linkedinUrl !== linkedinUrl));
    setTotalPending((current) => current - 1);
  }

  if (loading) return <p className="empty-state">Generating drafts for everyone pending…</p>;
  if (error) return <div className="error-banner">{error}</div>;

  if (items.length === 0) {
    return (
      <p className="empty-state">
        No one pending follow-up right now. Capture people via the LinkedIn extension and they'll
        show up here once they haven't replied.
      </p>
    );
  }

  return (
    <div className="result">
      <p className="queue-meta">
        Showing {items.length} of {totalPending} pending — highest priority first. Nothing here
        sends automatically; copy each draft and paste it wherever you'd reach that person.
      </p>
      {items.map(({ person, draft }) => (
        <section className="card queue-card" key={person.id}>
          <div className="queue-card-header">
            <div>
              <h2>{person.name}</h2>
              <p className="subline">
                {person.role ?? "Unclassified role"}
                {person.company ? ` at ${person.company}` : ""}
              </p>
            </div>
            <span className="badge badge-medium">{person.templateCategory}</span>
          </div>
          <p className="queue-context">
            Follow-ups so far: {person.followUpCount}
            {person.publicEmail ? ` · Public email on file: ${person.publicEmail}` : ""}
          </p>
          <pre className="draft-body">{draft}</pre>
          <div className="queue-actions">
            <button className="ghost-button" onClick={() => handleCopy(person.id, draft)}>
              {copiedId === person.id ? "Copied!" : "Copy draft"}
            </button>
            <button
              className="ghost-button"
              onClick={() => handleStatus(person.linkedinUrl, "replied")}
            >
              Mark replied
            </button>
            <button
              className="ghost-button danger"
              onClick={() => handleStatus(person.linkedinUrl, "do_not_contact")}
            >
              Do not contact
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
