// Service worker: the only place that talks to our backend. Content scripts
// proxy through here because fetch() from a content script is subject to the
// host page's CSP — LinkedIn's CSP can silently block a direct call.

importScripts("config.js");

function authHeaders(extra) {
  return {
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    ...extra,
  };
}

function forwardResponse(promise, sendResponse) {
  promise
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
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GENERATE_DRAFT") {
    forwardResponse(
      fetch(`${API_BASE}/api/draft`, {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(message.payload),
      }),
      sendResponse
    );
    return true; // keep the message channel open for the async response
  }

  if (message.type === "ESCALATE") {
    const encodedUrl = encodeURIComponent(message.linkedinUrl);
    forwardResponse(
      fetch(`${API_BASE}/api/persons/${encodedUrl}/escalate`, {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({ domain: message.domain }),
      }),
      sendResponse
    );
    return true;
  }

  if (message.type === "MERGE_PERSONS") {
    forwardResponse(
      fetch(`${API_BASE}/api/persons/merge`, {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          keepLinkedinUrl: message.keepLinkedinUrl,
          mergeLinkedinUrl: message.mergeLinkedinUrl,
        }),
      }),
      sendResponse
    );
    return true;
  }

  if (message.type === "CAPTURE_PROFILE") {
    forwardResponse(
      fetch(`${API_BASE}/api/persons/capture`, {
        method: "POST",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(message.payload),
      }),
      sendResponse
    );
    return true;
  }

  if (message.type === "PATCH_PERSON") {
    const encodedUrl = encodeURIComponent(message.linkedinUrl);
    forwardResponse(
      fetch(`${API_BASE}/api/persons/${encodedUrl}`, {
        method: "PATCH",
        headers: authHeaders({ "content-type": "application/json" }),
        body: JSON.stringify(message.patch),
      }),
      sendResponse
    );
    return true;
  }

  return false;
});
