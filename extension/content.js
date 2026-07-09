// Runs only on linkedin.com/messaging/* pages. Does nothing until the user
// clicks the floating button — no background polling, no auto-reading of
// the inbox, no auto-send. Every extraction and every draft is a single,
// explicit, reviewable action.

const BUTTON_ID = "ria-followup-button";
const PANEL_ID = "ria-followup-panel";
const ESCALATE_THRESHOLD = 2;

function injectButton() {
  if (document.getElementById(BUTTON_ID)) return;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.textContent = "Draft follow-up";
  button.addEventListener("click", onButtonClick);
  document.body.appendChild(button);
}

function onButtonClick() {
  const extracted = extractCurrentConversation();
  renderPanel(extracted);
}

// Best-effort extraction from whatever conversation thread is currently open.
// LinkedIn's DOM structure is not a stable public API and changes over time —
// these selectors are deliberately defensive with fallbacks, and every field
// is editable in the panel so a failed extraction never blocks the user.
function extractCurrentConversation() {
  const nameCandidates = [
    ".msg-entity-lockup__entity-title",
    ".msg-thread__link-to-profile .t-16",
    "h2.msg-entity-lockup__entity-title",
  ];
  const name = queryFirstText(nameCandidates);

  const profileLinkEl = document.querySelector(
    ".msg-thread__link-to-profile, a.msg-entity-lockup__entity-title, .msg-conversation-card__link-to-profile-link"
  );
  const linkedinUrl = profileLinkEl?.href?.split("?")[0] ?? "";

  const roleCandidates = [".msg-entity-lockup__entity-subtitle", ".msg-thread__subtitle"];
  const role = queryFirstText(roleCandidates);

  const messageNodes = document.querySelectorAll(
    ".msg-s-event-listitem, .msg-s-message-list__event"
  );
  let lastMessageText = "";
  let lastMessageDirection = "outbound";

  if (messageNodes.length > 0) {
    const lastNode = messageNodes[messageNodes.length - 1];
    const textEl = lastNode.querySelector(
      ".msg-s-event-listitem__body, .msg-s-event-with-indicator, p"
    );
    lastMessageText = textEl?.textContent?.trim() ?? "";
    lastMessageDirection = lastNode.classList.contains("msg-s-event-listitem--other")
      ? "inbound"
      : "outbound";
  }

  return { name, linkedinUrl, role, lastMessageText, lastMessageDirection };
}

function queryFirstText(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    const text = el?.textContent?.trim();
    if (text) return text;
  }
  return "";
}

function renderPanel(extracted) {
  document.getElementById(PANEL_ID)?.remove();

  const panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.innerHTML = `
    <div class="ria-panel-header">
      <span>Follow-up draft</span>
      <button class="ria-close" aria-label="Close">×</button>
    </div>
    <div class="ria-panel-body">
      <label>Name<input class="ria-name" type="text" value="${escapeAttr(extracted.name)}" /></label>
      <label>LinkedIn URL<input class="ria-url" type="text" value="${escapeAttr(extracted.linkedinUrl)}" /></label>
      <label>Role / headline<input class="ria-role" type="text" value="${escapeAttr(extracted.role)}" /></label>
      <label>Company<input class="ria-company" type="text" value="" /></label>
      <label>Last visible message
        <textarea class="ria-message" rows="3">${escapeHtml(extracted.lastMessageText)}</textarea>
      </label>
      <label class="ria-inline">
        Direction
        <select class="ria-direction">
          <option value="outbound" ${extracted.lastMessageDirection === "outbound" ? "selected" : ""}>I sent this</option>
          <option value="inbound" ${extracted.lastMessageDirection === "inbound" ? "selected" : ""}>They sent this</option>
        </select>
      </label>
      <button class="ria-generate">Generate draft</button>
      <div class="ria-status"></div>
      <div class="ria-result" hidden>
        <textarea class="ria-draft-text" rows="4" readonly></textarea>
        <button class="ria-copy">Copy draft</button>
        <p class="ria-hint">Review, then paste into LinkedIn's message box yourself. This tool never sends on your behalf.</p>
        <div class="ria-quick-actions">
          <button class="ria-dnc">Mark do-not-contact</button>
        </div>
      </div>
      <div class="ria-escalate" hidden>
        <p class="ria-hint">Still no reply after ${ESCALATE_THRESHOLD}+ follow-ups. Check their company's public site for another way to reach them?</p>
        <label>Company domain<input class="ria-escalate-domain" type="text" placeholder="acme.com" /></label>
        <button class="ria-escalate-btn">Check other channels</button>
        <div class="ria-escalate-result"></div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);

  panel.querySelector(".ria-close").addEventListener("click", () => panel.remove());
  panel.querySelector(".ria-generate").addEventListener("click", () => handleGenerate(panel));
  panel.querySelector(".ria-copy").addEventListener("click", () => handleCopy(panel));
  panel.querySelector(".ria-dnc").addEventListener("click", () => handleDoNotContact(panel));
  panel.querySelector(".ria-escalate-btn").addEventListener("click", () => handleEscalate(panel));
}

function handleGenerate(panel) {
  const statusEl = panel.querySelector(".ria-status");
  const resultEl = panel.querySelector(".ria-result");
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
    company: panel.querySelector(".ria-company").value.trim() || undefined,
    visibleMessage: panel.querySelector(".ria-message").value.trim()
      ? {
          direction: panel.querySelector(".ria-direction").value,
          text: panel.querySelector(".ria-message").value.trim(),
        }
      : undefined,
  };

  statusEl.textContent = "Generating…";
  resultEl.hidden = true;

  chrome.runtime.sendMessage({ type: "GENERATE_DRAFT", payload }, (response) => {
    if (!response?.ok) {
      statusEl.textContent = response?.error || "Failed to generate draft.";
      return;
    }
    statusEl.textContent = `Template used: ${response.data.templateUsed}`;
    resultEl.hidden = false;
    resultEl.querySelector(".ria-draft-text").value = response.data.draft;
    panel.dataset.linkedinUrl = linkedinUrl;

    const escalateEl = panel.querySelector(".ria-escalate");
    const followUpCount = response.data.person?.followUpCount ?? 0;
    escalateEl.hidden = followUpCount < ESCALATE_THRESHOLD;
    if (response.data.person?.companyDomain) {
      panel.querySelector(".ria-escalate-domain").value = response.data.person.companyDomain;
    }
  });
}

function handleEscalate(panel) {
  const linkedinUrl = panel.dataset.linkedinUrl;
  const domain = panel.querySelector(".ria-escalate-domain").value.trim();
  const resultEl = panel.querySelector(".ria-escalate-result");

  if (!linkedinUrl) {
    resultEl.textContent = "Generate a draft first so this person is on file.";
    return;
  }
  if (!domain) {
    resultEl.textContent = "Enter a company domain to check.";
    return;
  }

  resultEl.textContent = "Checking public contact info…";

  chrome.runtime.sendMessage({ type: "ESCALATE", linkedinUrl, domain }, (response) => {
    if (!response?.ok) {
      resultEl.textContent = response?.error || "Failed to check other channels.";
      return;
    }

    const { suggestedAction, contactPageUrl, bookingUrl, emailDraft, person } = response.data;

    if (suggestedAction === "booking_available") {
      resultEl.innerHTML = `Found a public booking page: <a href="${escapeAttr(bookingUrl)}" target="_blank">${escapeHtml(bookingUrl)}</a>. Review and book manually — nothing here submits on your behalf.`;
    } else if (suggestedAction === "email_available") {
      resultEl.innerHTML = `Found a public email: <strong>${escapeHtml(person?.publicEmail ?? "")}</strong>${contactPageUrl ? ` · <a href="${escapeAttr(contactPageUrl)}" target="_blank">contact page</a>` : ""}${
        emailDraft
          ? `<br/><br/><em>${escapeHtml(emailDraft.subject)}</em><br/>${escapeHtml(emailDraft.body).replace(/\n/g, "<br/>")}`
          : ""
      }`;
    } else {
      resultEl.textContent = "No public contact page, email, or booking link found on their site.";
    }
  });
}

function handleCopy(panel) {
  const text = panel.querySelector(".ria-draft-text").value;
  navigator.clipboard.writeText(text).then(() => {
    panel.querySelector(".ria-status").textContent = "Copied to clipboard.";
  });
}

function handleDoNotContact(panel) {
  const linkedinUrl = panel.dataset.linkedinUrl;
  if (!linkedinUrl) return;

  chrome.runtime.sendMessage(
    { type: "PATCH_PERSON", linkedinUrl, patch: { status: "do_not_contact" } },
    (response) => {
      const statusEl = panel.querySelector(".ria-status");
      statusEl.textContent = response?.ok
        ? "Marked do-not-contact. No further drafts will be generated for this person."
        : response?.error || "Failed to update status.";
    }
  );
}

function escapeAttr(s) {
  return (s ?? "").replace(/"/g, "&quot;");
}

function escapeHtml(s) {
  return (s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

injectButton();

// LinkedIn is a single-page app — messaging navigation doesn't reload the
// page, so re-inject the button if it's ever removed by a DOM re-render.
const observer = new MutationObserver(() => injectButton());
observer.observe(document.body, { childList: true, subtree: true });
