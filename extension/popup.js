// No background polling — this only runs when the user opens the popup, and
// just reads data already captured. It surfaces who replied recently so the
// user notices next time they check, instead of needing to remember to look.
const REPLY_NUDGE_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

async function loadPersons() {
  const nudgeEl = document.getElementById("nudge");
  const listEl = document.getElementById("list");
  try {
    const res = await fetch(`${API_BASE}/api/persons`, {
      headers: API_KEY ? { "x-api-key": API_KEY } : {},
    });
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

document.getElementById("booking-save").addEventListener("click", saveBookingProfile);
loadBookingProfile();
loadPersons();
