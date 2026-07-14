// Service worker: the only place that talks to our backend. Content scripts
// proxy through here because fetch() from a content script is subject to the
// host page's CSP — LinkedIn's CSP can silently block a direct call.

importScripts("config.js");

function getSessionToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sessionToken"], (result) => resolve(result.sessionToken || null));
  });
}

async function authHeaders(extra) {
  const token = await getSessionToken();
  return {
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function forwardRequest(url, options, sendResponse) {
  try {
    const headers = await authHeaders(options.headers);
    const res = await fetch(url, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      sendResponse({ ok: false, error: body.error || `Request failed (${res.status})` });
      return;
    }
    sendResponse({ ok: true, data: body });
  } catch (err) {
    sendResponse({ ok: false, error: err.message || "Network error reaching backend" });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GENERATE_DRAFT") {
    forwardRequest(
      `${API_BASE}/api/draft`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message.payload),
      },
      sendResponse
    );
    return true; // keep the message channel open for the async response
  }

  if (message.type === "ESCALATE") {
    const encodedUrl = encodeURIComponent(message.linkedinUrl);
    forwardRequest(
      `${API_BASE}/api/persons/${encodedUrl}/escalate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain: message.domain }),
      },
      sendResponse
    );
    return true;
  }

  if (message.type === "MERGE_PERSONS") {
    forwardRequest(
      `${API_BASE}/api/persons/merge`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          keepLinkedinUrl: message.keepLinkedinUrl,
          mergeLinkedinUrl: message.mergeLinkedinUrl,
        }),
      },
      sendResponse
    );
    return true;
  }

  if (message.type === "CAPTURE_PROFILE") {
    forwardRequest(
      `${API_BASE}/api/persons/capture`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message.payload),
      },
      sendResponse
    );
    return true;
  }

  if (message.type === "PATCH_PERSON") {
    const encodedUrl = encodeURIComponent(message.linkedinUrl);
    forwardRequest(
      `${API_BASE}/api/persons/${encodedUrl}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(message.patch),
      },
      sendResponse
    );
    return true;
  }

  if (message.type === "ANALYZE_WEBSITE") {
    (async () => {
      try {
        const { token, apiKey } = await chrome.storage.local.get(["token", "apiKey"]);
        const headers = { "content-type": "application/json" };
        if (apiKey) headers["x-api-key"] = apiKey;
        if (token) headers["authorization"] = "Bearer " + token;

        // POST to start analysis
        const startRes = await fetch(API_BASE + "/api/analyze", {
          method: "POST",
          headers,
          body: JSON.stringify({ url: message.url }),
        });
        if (!startRes.ok) {
          sendResponse({ error: "Failed to start: " + startRes.status });
          return;
        }
        const { id } = await startRes.json();

        // Poll until done (max 60s)
        let attempts = 0;
        while (attempts < 30) {
          await new Promise((r) => setTimeout(r, 2000));
          const pollRes = await fetch(API_BASE + "/api/analyze/" + id, { headers });
          if (!pollRes.ok) break;
          const data = await pollRes.json();
          if (data.status === "done" || data.status === "failed") {
            sendResponse(data);
            return;
          }
          attempts++;
        }
        sendResponse({ error: "Analysis timed out after 60 seconds" });
      } catch (err) {
        sendResponse({ error: err.message ?? "Unknown error" });
      }
    })();
    return true; // keep port open for async sendResponse
  }

  return false;
});
