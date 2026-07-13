// Runs only on public booking pages (Calendly, Cal.com) that a link from the
// escalation flow led the user to. Does nothing until clicked — reads the
// user's own saved name/email from local storage and fills the visible form
// fields, exactly like a password manager would. Never submits the form;
// the user reviews and books it themselves.

const BOOKING_BUTTON_ID = "ria-bookingfill-button";

function injectButton() {
  if (document.getElementById(BOOKING_BUTTON_ID)) return;

  const button = document.createElement("button");
  button.id = BOOKING_BUTTON_ID;
  button.textContent = "Fill my details";
  button.addEventListener("click", onFillClick);
  document.body.appendChild(button);
}

function onFillClick() {
  chrome.storage.local.get(["bookingProfile"], (result) => {
    const profile = result.bookingProfile;
    if (!profile?.name && !profile?.email) {
      showStatus("Set your name/email in the extension popup first.");
      return;
    }

    const filled = fillVisibleFields(profile);
    showStatus(
      filled > 0
        ? `Filled ${filled} field${filled === 1 ? "" : "s"}. Review before booking.`
        : "Couldn't find matching name/email fields on this page."
    );
  });
}

function fillVisibleFields(profile) {
  let filledCount = 0;
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input:not([type])');

  inputs.forEach((input) => {
    if (!isVisible(input) || input.value) return;

    const hints = [input.name, input.id, input.placeholder, input.getAttribute("aria-label")]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (profile.email && (input.type === "email" || /email/.test(hints))) {
      setValue(input, profile.email);
      filledCount++;
    } else if (profile.name && /(full ?name|your ?name|^name$)/.test(hints)) {
      setValue(input, profile.name);
      filledCount++;
    }
  });

  return filledCount;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && !el.disabled;
}

function setValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function showStatus(message) {
  let statusEl = document.getElementById("ria-bookingfill-status");
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "ria-bookingfill-status";
    document.body.appendChild(statusEl);
  }
  statusEl.textContent = message;
  clearTimeout(showStatus._timer);
  showStatus._timer = setTimeout(() => statusEl.remove(), 4000);
}

injectButton();

const observer = new MutationObserver(() => injectButton());
observer.observe(document.body, { childList: true, subtree: true });
