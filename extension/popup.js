// No background polling — this only runs when the user opens the popup, and
// just reads data already captured. It surfaces who replied recently so the
// user notices next time they check, instead of needing to remember to look.
const REPLY_NUDGE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

function getSessionToken() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["sessionToken"], (result) => resolve(result.sessionToken || null));
  });
}

function setSessionToken(token) {
  return new Promise((resolve) => {
    if (token) chrome.storage.local.set({ sessionToken: token }, resolve);
    else chrome.storage.local.remove("sessionToken", resolve);
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

async function loadPersons() {
  const nudgeEl = document.getElementById("nudge");
  const listEl = document.getElementById("list");
  try {
    const res = await fetch(`${API_BASE}/api/persons`, { headers: await authHeaders() });
    const { persons } = await res.json();

    renderNudge(nudgeEl, persons);

    if (!persons.length) {
      listEl.innerHTML = `<div class="empty">No one tracked yet.</div>`;
      return;
    }

    listEl.innerHTML = persons
      .map(
        (p) => `
      <div class="person-row">
        <span class="name">${escapeHtml(p.name)}</span>
        <span class="meta">${escapeHtml(p.role || "")}${p.company ? " · " + escapeHtml(p.company) : ""}</span>
        <span class="meta">Follow-ups: ${p.followUpCount} · Template: ${p.templateCategory}</span>
        ${p.publicEmail || p.phone ? `<span class="meta">${escapeHtml(p.publicEmail || "")}${p.publicEmail && p.phone ? " · " : ""}${escapeHtml(p.phone || "")}</span>` : ""}
        <span class="status-pill">${p.status.replace("_", " ")}</span>
      </div>
    `
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<div class="empty">Backend not reachable. Is it running on localhost:4000?</div>`;
  }
}

function renderNudge(nudgeEl, persons) {
  const now = Date.now();
  const recentlyReplied = persons.filter(
    (p) => p.status === "replied" && p.lastReplyAt && now - new Date(p.lastReplyAt).getTime() < REPLY_NUDGE_WINDOW_MS
  );

  if (recentlyReplied.length === 0) {
    nudgeEl.innerHTML = "";
    return;
  }

  const names = recentlyReplied.map((p) => escapeHtml(p.name)).join(", ");
  nudgeEl.innerHTML = `<div class="nudge-banner">${recentlyReplied.length} replied in the last 3 days: ${names}</div>`;
  maybeNotifyReplies(recentlyReplied);
}

/**
 * Fires a real OS notification the moment the popup opens and finds fresh
 * replies — still zero background polling, it only runs inside this
 * user-initiated popup load. Dedupes per person via chrome.storage.local so
 * reopening the popup repeatedly doesn't re-notify for the same reply.
 */
async function maybeNotifyReplies(recentlyReplied) {
  if (!chrome.notifications) return;
  const { notifiedReplyIds = [] } = await new Promise((resolve) =>
    chrome.storage.local.get(["notifiedReplyIds"], resolve)
  );
  const fresh = recentlyReplied.filter((p) => !notifiedReplyIds.includes(p.id));
  if (fresh.length === 0) return;

  chrome.notifications.create(`reply-nudge-${Date.now()}`, {
    type: "basic",
    iconUrl: "icon128.png",
    title: fresh.length === 1 ? `${fresh[0].name} replied` : `${fresh.length} people replied recently`,
    message: fresh.map((p) => p.name).join(", "),
  });

  chrome.storage.local.set({
    notifiedReplyIds: [...notifiedReplyIds, ...fresh.map((p) => p.id)].slice(-200),
  });
}

function escapeHtml(s) {
  return (s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function loadBookingProfile() {
  chrome.storage.local.get(["bookingProfile"], (result) => {
    const profile = result.bookingProfile || {};
    document.getElementById("booking-name").value = profile.name || "";
    document.getElementById("booking-email").value = profile.email || "";
  });
}

function saveBookingProfile() {
  const profile = {
    name: document.getElementById("booking-name").value.trim(),
    email: document.getElementById("booking-email").value.trim(),
  };
  chrome.storage.local.set({ bookingProfile: profile }, () => {
    const statusEl = document.getElementById("booking-save-status");
    statusEl.textContent = "Saved";
    setTimeout(() => (statusEl.textContent = ""), 2000);
  });
}

async function exportPersons(format) {
  try {
    const res = await fetch(`${API_BASE}/api/persons/export?format=${format}`, {
      headers: await authHeaders(),
    });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `linkedin-contacts.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    document.getElementById("nudge").innerHTML = `<div class="nudge-banner">${err.message}</div>`;
  }
}

/**
 * Same account as the web app — signup/login hit the identical backend
 * endpoints, and the resulting session token is stored in
 * chrome.storage.local, which survives extension/browser/computer restarts
 * (unlike in-memory state), satisfying the "no data loss on restart"
 * requirement for the login session itself.
 */
async function refreshAuthUI() {
  const loggedOutEl = document.getElementById("auth-logged-out");
  const loggedInEl = document.getElementById("auth-logged-in");
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, { headers: await authHeaders() });
    const data = await res.json();
    loggedOutEl.hidden = data.loggedIn;
    loggedInEl.hidden = !data.loggedIn;
  } catch {
    loggedOutEl.hidden = false;
    loggedInEl.hidden = true;
  }
}

async function handleAuthSubmit(endpoint) {
  const statusEl = document.getElementById("auth-status");
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  if (!email || password.length < 6) {
    statusEl.textContent = "Enter a valid email and a password of 6+ characters.";
    return;
  }

  statusEl.textContent = "…";
  try {
    const res = await fetch(`${API_BASE}/api/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = data.error || "Failed.";
      return;
    }
    await setSessionToken(data.token);
    statusEl.textContent = "";
    await refreshAuthUI();
    await loadPersons();
  } catch (err) {
    statusEl.textContent = err.message || "Network error.";
  }
}

async function handleLogout() {
  await setSessionToken(null);
  await refreshAuthUI();
  await loadPersons();
}

/**
 * Reads visible contact info off whatever page is active when the user
 * clicks this button in the popup. chrome.scripting.executeScript here runs
 * under the "activeTab" grant, which Chrome only hands out for the tab the
 * user is looking at *because* they just invoked the extension — the same
 * one-click, user-initiated model as the LinkedIn/profile capture buttons,
 * just generalized to any site instead of being limited to LinkedIn.
 */
async function captureCurrentPage() {
  const statusEl = document.getElementById("capture-status");
  statusEl.textContent = "Reading page…";

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    statusEl.textContent = "No active tab.";
    return;
  }

  let extracted;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContactInfo,
    });
    extracted = result;
  } catch (err) {
    statusEl.textContent = "Couldn't read this page (it may be a restricted browser page).";
    return;
  }

  document.getElementById("cap-name").value = extracted.name || "";
  document.getElementById("cap-url").value = extracted.url || "";
  document.getElementById("cap-role").value = extracted.role || "";
  document.getElementById("cap-email").value = extracted.email || "";
  document.getElementById("cap-phone").value = extracted.phone || "";
  document.getElementById("capture-form").hidden = false;
  statusEl.textContent = "Review and edit before saving.";
}

/**
 * Runs INSIDE the target page (via chrome.scripting.executeScript), not in
 * the extension itself — reads mailto:/tel: links and page metadata already
 * visible on screen, the same information any visitor could read manually.
 * No storage writes happen here; it only returns data back to the popup for
 * the user to review.
 */
function extractPageContactInfo() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content ?? "";
  const description =
    document.querySelector('meta[name="description"]')?.content ??
    document.querySelector('meta[property="og:description"]')?.content ??
    "";

  const name =
    document.querySelector("h1")?.textContent?.trim() ||
    ogTitle.split(/[-|]/)[0]?.trim() ||
    document.title.split(/[-|]/)[0]?.trim() ||
    "";

  const email = document.querySelector('a[href^="mailto:"]')?.href.replace("mailto:", "") || "";
  const phone = document.querySelector('a[href^="tel:"]')?.href.replace("tel:", "") || "";

  return {
    name,
    url: window.location.href.split("?")[0],
    role: description.slice(0, 140),
    email,
    phone,
  };
}

async function saveCapturedPage() {
  const statusEl = document.getElementById("capture-status");
  const linkedinUrl = document.getElementById("cap-url").value.trim();
  const name = document.getElementById("cap-name").value.trim();

  if (!linkedinUrl || !name) {
    statusEl.textContent = "Name and source URL are required.";
    return;
  }

  const payload = {
    linkedinUrl,
    name,
    role: document.getElementById("cap-role").value.trim() || undefined,
    publicEmail: document.getElementById("cap-email").value.trim() || undefined,
    phone: document.getElementById("cap-phone").value.trim() || undefined,
  };

  statusEl.textContent = "Saving…";
  const headers = await authHeaders({ "content-type": "application/json" });
  try {
    const res = await fetch(`${API_BASE}/api/persons/capture`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      statusEl.textContent = data.error || "Failed to save.";
      return;
    }
    statusEl.textContent = "Saved to CRM.";
    loadPersons();
  } catch (err) {
    statusEl.textContent = err.message || "Network error.";
  }
}

document.getElementById("capture-page-btn").addEventListener("click", captureCurrentPage);
document.getElementById("capture-save-btn").addEventListener("click", saveCapturedPage);
document.getElementById("export-csv").addEventListener("click", () => exportPersons("csv"));
document.getElementById("export-json").addEventListener("click", () => exportPersons("json"));
document.getElementById("booking-save").addEventListener("click", saveBookingProfile);
document.getElementById("auth-login").addEventListener("click", () => handleAuthSubmit("auth/login"));
document.getElementById("auth-signup").addEventListener("click", () => handleAuthSubmit("auth/signup"));
document.getElementById("auth-logout").addEventListener("click", handleLogout);

loadBookingProfile();
refreshAuthUI();
loadPersons();
