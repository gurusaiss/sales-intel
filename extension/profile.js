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
  const basics = extractProfileBasics();
  renderPanel(basics, { loading: true });

  const contactInfo = await extractContactInfo();
  renderPanel(basics, { loading: false, ...contactInfo });
}

function extractProfileBasics() {
  const nameCandidates = ["h1.text-heading-xlarge", "h1"];
  const name = queryFirstText(nameCandidates);

  const roleCandidates = [
    ".text-body-medium.break-words",
    ".text-body-medium",
    ".pv-text-details__left-panel .text-body-medium",
  ];
  const role = queryFirstText(roleCandidates);

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
  const alreadyOpen = document.querySelector('[href*="contact-info"], .pv-contact-info');
  if (!alreadyOpen) {
    const contactLink = findContactInfoLink();
    if (contactLink) {
      contactLink.click();
      await wait(900);
    }
  }

  const email = document.querySelector('a[href^="mailto:"]')?.href.replace("mailto:", "") ?? "";
  const phone = findPhoneNumber();

  return { email, phone };
}

function findContactInfoLink() {
  const candidates = document.querySelectorAll("a, button");
  for (const el of candidates) {
    if (/contact info/i.test(el.textContent ?? "")) return el;
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
