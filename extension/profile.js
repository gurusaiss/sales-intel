// Runs only on linkedin.com/in/* profile pages. Does nothing until clicked.
// Reads the "Contact info" panel — information the profile owner chose to
// make visible to viewers — exactly the way a human would: click "Contact
// info" to open it, read what's shown, close it. No bulk scraping, no
// background reading, one profile at a time.

const BUTTON_ID = "ria-followup-button";
const PANEL_ID = "ria-followup-panel";

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.textContent = "Get contact info";
  button.addEventListener("click", onButtonClick);
  document.body.appendChild(button);
}

async function onButtonClick() {
  renderPanel({ name: "", role: "", linkedinUrl: window.location.href.split("?")[0] }, { loading: true });

  // LinkedIn is a heavy client-rendered SPA — the profile header may not have
  // finished rendering yet even after document_idle. Poll briefly instead of
  // reading the DOM exactly once.
  await waitFor(() => document.querySelector("h1") || document.querySelector('meta[property="og:title"]'));

  const basics = extractProfileBasics();
  renderPanel(basics, { loading: true });

  const contactInfo = await extractContactInfo();
  renderPanel(basics, { loading: false, ...contactInfo });
}

function waitFor(predicate, timeoutMs = 3000, intervalMs = 150) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      if (predicate() || Date.now() - start > timeoutMs) {
        resolve();
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

/**
 * LinkedIn's CSS classes are hashed/obfuscated per deployment and change
 * without notice — relying on them (text-heading-xlarge, etc.) breaks
 * silently. Page metadata (og:title, meta description) is kept stable
 * because LinkedIn needs it for link previews/SEO, so it's a far more
 * durable signal. document.title is the final, always-present fallback.
 */
function extractProfileBasics() {
  const ogTitle = document.querySelector('meta[property="og:title"]')?.content ?? "";
  const description = document.querySelector('meta[name="description"]')?.content ?? "";
  const pageTitle = document.title;

  // og:title is typically "First Last - Headline | Company" or similar.
  const name =
    queryFirstText(["h1"]) ||
    ogTitle.split(/[-|]/)[0]?.trim() ||
    pageTitle.split(/[-|]/)[0]?.trim() ||
    "";

  const role =
    queryFirstText([".text-body-medium.break-words", ".text-body-medium"]) ||
    ogTitle.split(/[-|]/).slice(1).join("-").trim() ||
    description.split(".")[0]?.trim() ||
    "";

  return {
    name,
    role,
    linkedinUrl: window.location.href.split("?")[0],
  };
}

function queryFirstText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

/**
 * Opens the Contact Info overlay if it isn't already open, waits briefly for
 * it to render, then reads whatever email/phone is shown. LinkedIn's DOM
 * isn't a stable public API — this is deliberately best-effort with a
 * generic mailto:/tel: scan as a fallback, and every extracted value stays
 * editable in the panel so a bad extraction never blocks the user.
 */
async function extractContactInfo() {
  const alreadyOpen = document.querySelector('a[href^="mailto:"], a[href^="tel:"]');
  if (!alreadyOpen) {
    const contactLink = findContactInfoLink();
    if (contactLink) {
      contactLink.click();
      await waitFor(() => document.querySelector('a[href^="mailto:"], a[href^="tel:"], .artdeco-modal'));
      await wait(300); // let the modal finish rendering its contents after it appears
    }
  }

  const email = document.querySelector('a[href^="mailto:"]')?.href.replace("mailto:", "") ?? "";
  const phone = findPhoneNumber();

  return { email, phone };
}

function findContactInfoLink() {
  // LinkedIn has used the id "top-card-text-details-contact-info" on this
  // link for years — accessibility-oriented ids tend to survive CSS/class
  // refactors far better than styling classes do. Try that first.
  const byId = document.getElementById("top-card-text-details-contact-info");
  if (byId) return byId;

  const candidates = document.querySelectorAll("a, button, [role='button']");
  for (const el of candidates) {
    const label = `${el.textContent ?? ""} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`;
    if (/contact info/i.test(label)) return el;
  }
  return null;
}

function findPhoneNumber() {
  const telLink = document.querySelector('a[href^="tel:"]');
  if (telLink) return telLink.href.replace("tel:", "");

  const headings = document.querySelectorAll("h3, span, div");
  for (const el of headings) {
    if (/^phone$/i.test(el.textContent?.trim() ?? "")) {
      const container = el.closest("section") ?? el.parentElement;
      const match = container?.textContent?.match(/[+\d][\d\s\-().]{7,}\d/);
      if (match) return match[0].trim();
    }
  }
  return "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderPanel(basics, info) {
  document.getElementById(PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="ria-panel-header">
      <span>Profile contact info</span>
      <button class="ria-close" aria-label="Close">×</button>
    </div>
    <div class="ria-panel-body">
      <label>Name<input class="ria-name" type="text" value="${escapeAttr(basics.name)}" /></label>
      <label>LinkedIn URL<input class="ria-url" type="text" value="${escapeAttr(basics.linkedinUrl)}" /></label>
      <label>Role / headline<input class="ria-role" type="text" value="${escapeAttr(basics.role)}" /></label>
      <label>Email<input class="ria-email" type="text" value="${escapeAttr(info.email)}" placeholder="${info.loading ? "Reading Contact Info panel…" : "Not found — edit if you see it manually"}" /></label>
      <label>Phone<input class="ria-phone" type="text" value="${escapeAttr(info.phone)}" placeholder="${info.loading ? "Reading Contact Info panel…" : "Not found — edit if you see it manually"}" /></label>
      <button class="ria-save-contact" ${info.loading ? "disabled" : ""}>${info.loading ? "Reading…" : "Save to CRM"}</button>
      <div class="ria-status"></div>
    </div>
  `;

  document.body.appendChild(panel);

  panel.querySelector(".ria-close").addEventListener("click", () => panel.remove());
  const saveBtn = panel.querySelector(".ria-save-contact");
  if (!info.loading) {
    saveBtn.addEventListener("click", () => handleSave(panel));
  }
}

function handleSave(panel) {
  const statusEl = panel.querySelector(".ria-status");
  const linkedinUrl = panel.querySelector(".ria-url").value.trim();
  const name = panel.querySelector(".ria-name").value.trim();

  if (!linkedinUrl || !name) {
    statusEl.textContent = "Name and LinkedIn URL are required.";
    return;
  }

  const payload = {
    linkedinUrl,
    name,
    role: panel.querySelector(".ria-role").value.trim() || undefined,
    publicEmail: panel.querySelector(".ria-email").value.trim() || undefined,
    phone: panel.querySelector(".ria-phone").value.trim() || undefined,
  };

  statusEl.textContent = "Saving…";

  chrome.runtime.sendMessage({ type: "CAPTURE_PROFILE", payload }, (response) => {
    statusEl.textContent = response?.ok
      ? "Saved to CRM."
      : response?.error || "Failed to save.";
  });
}

function escapeAttr(s) {
  return (s ?? "").replace(/"/g, "&quot;");
}

injectButton();

const observer = new MutationObserver(() => injectButton());
observer.observe(document.body, { childList: true, subtree: true });
