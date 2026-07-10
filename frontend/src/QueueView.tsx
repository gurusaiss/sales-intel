import { useState, useEffect, useCallback } from "react";
import {
  fetchQueue,
  updatePersonStatus,
  fetchGoogleStatus,
  getGoogleConnectUrl,
  sendViaGmail,
  type GoogleStatus,
} from "./api";
import type { QueueItem } from "./types";

export default function QueueView() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentId, setSentId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queueData, status] = await Promise.all([fetchQueue(15), fetchGoogleStatus()]);
      setItems(queueData.queue);
      setTotalPending(queueData.totalPending);
      setGoogleStatus(status);
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

  async function handleSendEmail(item: QueueItem) {
    if (!item.person.publicEmail) return;
    setSendingId(item.person.id);
    try {
      await sendViaGmail(
        item.person.publicEmail,
        `Following up${item.person.company ? ` — ${item.person.company}` : ""}`,
        item.draft,
        item.person.linkedinUrl
      );
      setSentId(item.person.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setSendingId(null);
    }
  }

  if (loading) return <p className="empty-state">Generating drafts for everyone pending…</p>;
  if (error) return <div className="error-banner">{error}</div>;

  return (
    <div className="result">
      {googleStatus?.configured && !googleStatus.connected && (
        <div className="gmail-banner">
          <span>Connect Gmail to send emails directly from the queue instead of copy-paste.</span>
          <a className="ghost-button" href={getGoogleConnectUrl()} target="_blank" rel="noreferrer">
            Connect Gmail
          </a>
        </div>
      )}

      {items.length === 0 ? (
        <p className="empty-state">
          No one pending follow-up right now. Capture people via the LinkedIn extension and
          they'll show up here once they haven't replied.
        </p>
      ) : (
        <>
          <p className="queue-meta">
            Showing {items.length} of {totalPending} pending — highest priority first. LinkedIn
            drafts are copy-paste only; email sends only when you click Send and Gmail is
            connected.
          </p>
          {items.map((item) => {
            const { person, draft } = item;
            const canSendEmail = Boolean(person.publicEmail && googleStatus?.connected);
            return (
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
                  {person.publicEmail && (
                    <button
                      className="ghost-button accent"
                      disabled={!canSendEmail || sendingId === person.id}
                      title={!canSendEmail ? "Connect Gmail above to enable sending" : undefined}
                      onClick={() => handleSendEmail(item)}
                    >
                      {sentId === person.id
                        ? "Sent!"
                        : sendingId === person.id
                          ? "Sending…"
                          : "Send via Gmail"}
                    </button>
                  )}
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
            );
          })}
        </>
      )}
    </div>
  );
}
