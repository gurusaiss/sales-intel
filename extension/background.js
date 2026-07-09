// Service worker: the only place that talks to our backend. Content scripts
// proxy through here because fetch() from a content script is subject to the
// host page's CSP — LinkedIn's CSP can silently block a direct call.

importScripts("config.js");

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GENERATE_DRAFT") {
    fetch(`${API_BASE}/api/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message.payload),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({ ok: false, error: body.error || `Request failed (${res.status})` });
          return;
        }
        sendResponse({ ok: true, data: body });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || "Network error reaching backend" });
      });
    return true; // keep the message channel open for the async response
  }

  if (message.type === "ESCALATE") {
    const encodedUrl = encodeURIComponent(message.linkedinUrl);
    fetch(`${API_BASE}/api/persons/${encodedUrl}/escalate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: message.domain }),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({ ok: false, error: body.error || `Request failed (${res.status})` });
          return;
        }
        sendResponse({ ok: true, data: body });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || "Network error reaching backend" });
      });
    return true;
  }

  if (message.type === "PATCH_PERSON") {
    const encodedUrl = encodeURIComponent(message.linkedinUrl);
    fetch(`${API_BASE}/api/persons/${encodedUrl}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message.patch),
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          sendResponse({ ok: false, error: body.error || `Request failed (${res.status})` });
          return;
        }
        sendResponse({ ok: true, data: body });
      })
      .catch((err) => {
        sendResponse({ ok: false, error: err.message || "Network error reaching backend" });
      });
    return true;
  }

  return false;
});
