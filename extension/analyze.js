(function () {
  "use strict";

  // Don't inject on LinkedIn (handled by existing content.js / profile.js)
  if (window.location.hostname.includes("linkedin.com")) return;

  const BUTTON_ID = "sales-intel-analyze-btn";
  const PANEL_ID = "sales-intel-analyze-panel";
  const STYLE_ID = "sales-intel-analyze-styles";

  // ─── Inject styles ────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed;
        bottom: 1.5rem;
        right: 1.5rem;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 180px;
        padding: 0.65rem 1.25rem;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff;
        border: none;
        border-radius: 10px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 4px 18px rgba(37,99,235,0.4);
        font-family: system-ui, -apple-system, sans-serif;
        letter-spacing: 0.01em;
        transition: transform 0.18s ease, box-shadow 0.18s ease;
        justify-content: center;
        white-space: nowrap;
      }
      #${BUTTON_ID}:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 28px rgba(37,99,235,0.55);
      }
      #${BUTTON_ID}:active {
        transform: translateY(-1px);
      }
      #${PANEL_ID} {
        position: fixed;
        bottom: 5.5rem;
        right: 1.5rem;
        z-index: 2147483646;
        width: 360px;
        max-height: 75vh;
        overflow-y: auto;
        background: #fff;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        box-shadow: 0 12px 48px rgba(0,0,0,0.18);
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.85rem;
        line-height: 1.55;
        color: #1e293b;
      }
      #${PANEL_ID} .si-panel-header {
        background: linear-gradient(135deg, #0f172a, #1e3a5f);
        color: #fff;
        padding: 1rem 1.1rem 0.85rem;
        border-radius: 14px 14px 0 0;
        position: relative;
      }
      #${PANEL_ID} .si-panel-header h3 {
        margin: 0 1.5rem 0.2rem 0;
        font-size: 1rem;
        font-weight: 700;
        color: #f1f5f9;
        line-height: 1.3;
      }
      #${PANEL_ID} .si-panel-header p {
        margin: 0;
        font-size: 0.78rem;
        color: #94a3b8;
      }
      #${PANEL_ID} .si-close {
        position: absolute;
        top: 0.6rem;
        right: 0.75rem;
        background: rgba(255,255,255,0.12);
        border: none;
        color: #cbd5e1;
        font-size: 1.1rem;
        width: 1.6rem;
        height: 1.6rem;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
        transition: background 0.15s;
      }
      #${PANEL_ID} .si-close:hover { background: rgba(255,255,255,0.22); }
      #${PANEL_ID} .si-body {
        padding: 1rem 1.1rem;
      }
      #${PANEL_ID} .si-hook {
        background: #eff6ff;
        border-left: 3px solid #2563eb;
        border-radius: 0 6px 6px 0;
        padding: 0.6rem 0.8rem;
        margin-bottom: 0.75rem;
        font-size: 0.82rem;
        color: #1d4ed8;
        font-weight: 500;
      }
      #${PANEL_ID} .si-section-label {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #94a3b8;
        margin: 0.85rem 0 0.35rem;
      }
      #${PANEL_ID} .si-summary {
        font-size: 0.84rem;
        color: #334155;
        margin-bottom: 0.5rem;
        line-height: 1.6;
      }
      #${PANEL_ID} .si-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 0.3rem;
        margin-bottom: 0.5rem;
      }
      #${PANEL_ID} .si-tag {
        font-size: 0.7rem;
        padding: 0.18rem 0.55rem;
        border: 1px solid #e2e8f0;
        border-radius: 999px;
        color: #64748b;
        background: #f8fafc;
      }
      #${PANEL_ID} .si-meta-tag {
        font-size: 0.73rem;
        background: #f1f5f9;
        padding: 0.2rem 0.55rem;
        border-radius: 5px;
        color: #475569;
      }
      #${PANEL_ID} .si-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid #e2e8f0;
        margin: 0.85rem 0 0;
      }
      #${PANEL_ID} .si-tab {
        flex: 1;
        text-align: center;
        padding: 0.45rem 0.4rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        color: #94a3b8;
        border-bottom: 2px solid transparent;
        transition: color 0.15s, border-color 0.15s;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        font-family: inherit;
      }
      #${PANEL_ID} .si-tab:hover { color: #475569; }
      #${PANEL_ID} .si-tab.active {
        color: #2563eb;
        border-bottom-color: #2563eb;
      }
      #${PANEL_ID} .si-tab-pane { display: none; padding: 0.65rem 0 0.25rem; }
      #${PANEL_ID} .si-tab-pane.active { display: block; }
      #${PANEL_ID} .si-contact-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.5rem;
        border-radius: 6px;
        margin-bottom: 0.3rem;
        background: #f8fafc;
        font-size: 0.8rem;
        color: #334155;
        overflow: hidden;
      }
      #${PANEL_ID} .si-contact-item a {
        color: #2563eb;
        text-decoration: none;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      #${PANEL_ID} .si-contact-item a:hover { text-decoration: underline; }
      #${PANEL_ID} .si-badge {
        font-size: 0.65rem;
        padding: 0.12rem 0.45rem;
        border-radius: 999px;
        font-weight: 600;
        flex-shrink: 0;
      }
      #${PANEL_ID} .si-badge-email { background: #dbeafe; color: #1d4ed8; }
      #${PANEL_ID} .si-badge-booking { background: #dcfce7; color: #16a34a; }
      #${PANEL_ID} .si-badge-social { background: #fef3c7; color: #d97706; }
      #${PANEL_ID} .si-empty {
        font-size: 0.8rem;
        color: #94a3b8;
        text-align: center;
        padding: 0.75rem 0;
      }
      #${PANEL_ID} .si-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-top: 1rem;
        padding-top: 0.75rem;
        border-top: 1px solid #f1f5f9;
        flex-wrap: wrap;
      }
      #${PANEL_ID} .si-btn-primary {
        flex: 1;
        padding: 0.5rem 0.75rem;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff;
        border: none;
        border-radius: 7px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        font-family: inherit;
        text-align: center;
        text-decoration: none;
        display: inline-block;
        transition: opacity 0.15s;
      }
      #${PANEL_ID} .si-btn-primary:hover { opacity: 0.9; }
      #${PANEL_ID} .si-btn-link {
        font-size: 0.75rem;
        color: #64748b;
        text-decoration: none;
        padding: 0.3rem 0.5rem;
        border-radius: 5px;
        border: 1px solid #e2e8f0;
        transition: background 0.15s;
        white-space: nowrap;
      }
      #${PANEL_ID} .si-btn-link:hover { background: #f8fafc; }
      #${PANEL_ID} .si-progress-bar {
        height: 4px;
        background: #e2e8f0;
        border-radius: 999px;
        overflow: hidden;
        margin-top: 0.85rem;
      }
      #${PANEL_ID} .si-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #2563eb, #60a5fa);
        border-radius: 999px;
        animation: si-progress-anim 2s ease infinite;
      }
      @keyframes si-progress-anim {
        0%   { width: 5%; }
        50%  { width: 75%; }
        100% { width: 92%; }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Local contact extraction ──────────────────────────────────────────────
  function extractLocalContacts() {
    const html = document.documentElement.innerHTML;
    const text = document.documentElement.innerText || "";

    // Emails
    const emailSet = new Set();
    const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = html.match(emailRe) || [];
    emailMatches.forEach((e) => {
      // Skip image/asset extensions that look like emails
      if (!/\.(png|jpg|jpeg|gif|svg|ico|woff|ttf|css|js)$/i.test(e)) {
        emailSet.add(e.toLowerCase());
      }
    });

    // Booking / scheduling links
    const bookingSet = new Set();
    const bookingPatterns = [
      /https?:\/\/calendly\.com\/[^\s"'<>]+/gi,
      /https?:\/\/cal\.com\/[^\s"'<>]+/gi,
      /https?:\/\/savvycal\.com\/[^\s"'<>]+/gi,
      /https?:\/\/tidycal\.com\/[^\s"'<>]+/gi,
      /https?:\/\/hubspot\.com\/meetings\/[^\s"'<>]+/gi,
      /https?:\/\/meetings\.hubspot\.com\/[^\s"'<>]+/gi,
      /https?:\/\/doodle\.com\/[^\s"'<>]+/gi,
      /https?:\/\/zcal\.co\/[^\s"'<>]+/gi,
    ];
    bookingPatterns.forEach((re) => {
      const matches = html.match(re) || [];
      matches.forEach((m) => bookingSet.add(m.split(/['"]/)[0]));
    });

    // Social links
    const socialSet = new Set();
    const socialPatterns = [
      { re: /https?:\/\/(www\.)?linkedin\.com\/(?:company|in)\/[^\s"'<>/?#]+/gi, label: "LinkedIn" },
      { re: /https?:\/\/(www\.)?twitter\.com\/[^\s"'<>/?#]+/gi, label: "Twitter" },
      { re: /https?:\/\/x\.com\/[^\s"'<>/?#]+/gi, label: "X" },
      { re: /https?:\/\/(www\.)?github\.com\/[^\s"'<>/?#]+/gi, label: "GitHub" },
      { re: /https?:\/\/(www\.)?facebook\.com\/[^\s"'<>/?#]+/gi, label: "Facebook" },
      { re: /https?:\/\/(www\.)?instagram\.com\/[^\s"'<>/?#]+/gi, label: "Instagram" },
      { re: /https?:\/\/(www\.)?youtube\.com\/(?:c|channel|user|@)[^\s"'<>/?#]+/gi, label: "YouTube" },
    ];
    const skipPaths = /\/(share|intent|status|post|watch|feed|explore|hashtag)/i;
    socialPatterns.forEach(({ re, label }) => {
      const matches = html.match(re) || [];
      matches.forEach((m) => {
        const clean = m.split(/['"]/)[0];
        if (!skipPaths.test(clean)) socialSet.add(clean);
      });
    });

    return {
      emails: [...emailSet].slice(0, 20),
      booking: [...bookingSet].slice(0, 10),
      social: [...socialSet].slice(0, 15),
    };
  }

  // ─── Button ────────────────────────────────────────────────────────────────
  function getOrCreateButton() {
    if (document.getElementById(BUTTON_ID)) return null;
    const btn = document.createElement("button");
    btn.id = BUTTON_ID;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Analyze Website`;
    btn.addEventListener("click", startAnalysis);
    return btn;
  }

  // ─── Panel helpers ─────────────────────────────────────────────────────────
  function removePanel() {
    document.getElementById(PANEL_ID)?.remove();
  }

  function createPanel(headerHTML, bodyHTML) {
    removePanel();
    const panel = document.createElement("div");
    panel.id = PANEL_ID;

    const header = document.createElement("div");
    header.className = "si-panel-header";
    header.innerHTML = headerHTML;

    const closeBtn = document.createElement("button");
    closeBtn.className = "si-close";
    closeBtn.innerHTML = "×";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", removePanel);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "si-body";
    body.innerHTML = bodyHTML;

    panel.appendChild(header);
    panel.appendChild(body);
    document.body.appendChild(panel);
    return { panel, body };
  }

  // ─── Loading panel ─────────────────────────────────────────────────────────
  function showLoadingPanel(localContacts) {
    const { body } = createPanel(
      `<h3>Analyzing Website</h3><p>${window.location.hostname}</p>`,
      `
      <p style="color:#64748b;margin:0 0 0.5rem;">Detecting tech stack, scanning for intelligence, identifying contacts…</p>
      <div class="si-progress-bar"><div class="si-progress-fill"></div></div>
      `
    );

    // Show local contacts immediately if found
    const total = localContacts.emails.length + localContacts.booking.length + localContacts.social.length;
    if (total > 0) {
      const preview = document.createElement("div");
      preview.innerHTML = `
        <div class="si-section-label" style="margin-top:0.9rem;">Found on page so far</div>
        ${localContacts.emails.slice(0, 3).map((e) => `<div class="si-contact-item"><span class="si-badge si-badge-email">Email</span><a href="mailto:${e}">${e}</a></div>`).join("")}
        ${localContacts.booking.slice(0, 2).map((b) => `<div class="si-contact-item"><span class="si-badge si-badge-booking">Booking</span><a href="${b}" target="_blank" rel="noopener">${b.replace(/https?:\/\//, "")}</a></div>`).join("")}
        ${localContacts.social.slice(0, 2).map((s) => `<div class="si-contact-item"><span class="si-badge si-badge-social">Social</span><a href="${s}" target="_blank" rel="noopener">${s.replace(/https?:\/\/(www\.)?/, "")}</a></div>`).join("")}
        ${total > 7 ? `<div class="si-empty">+${total - 7} more contacts detected…</div>` : ""}
      `;
      body.appendChild(preview);
    }
  }

  // ─── Result panel ──────────────────────────────────────────────────────────
  function showResult(data, localContacts) {
    if (!data || data.status === "failed") {
      // Fall back to local contacts only
      showLocalOnlyPanel(localContacts, data?.errorMessage ?? "Backend analysis unavailable");
      return;
    }

    const ai = data.aiResult ?? {};
    const tech = data.techStack ?? {};
    const flatTech = Object.values(tech).flat();

    // Merge contacts: prefer backend if richer, else supplement with local
    const backendEmails = data.contacts?.emails ?? [];
    const backendBooking = data.contacts?.booking ?? [];
    const backendSocial = data.contacts?.social ?? [];

    const mergedEmails = backendEmails.length >= localContacts.emails.length
      ? backendEmails
      : [...new Set([...localContacts.emails, ...backendEmails])];
    const mergedBooking = backendBooking.length >= localContacts.booking.length
      ? backendBooking
      : [...new Set([...localContacts.booking, ...backendBooking])];
    const mergedSocial = backendSocial.length >= localContacts.social.length
      ? backendSocial
      : [...new Set([...localContacts.social, ...backendSocial])];

    const companyName = ai.company_name ?? data.pageTitle ?? data.url ?? window.location.hostname;
    const tagline = ai.tagline ?? "";

    const techHtml = flatTech.length
      ? `<div class="si-section-label">Tech Stack</div>
         <div class="si-tags">${flatTech.slice(0, 14).map((t) => `<span class="si-tag">${esc(t)}</span>`).join("")}</div>`
      : "";

    const hookHtml = ai.sales_hook
      ? `<div class="si-hook">💡 ${esc(ai.sales_hook)}</div>`
      : "";

    const summaryHtml = ai.executive_summary
      ? `<div class="si-section-label">Executive Summary</div>
         <div class="si-summary">${esc(ai.executive_summary)}</div>`
      : "";

    const metaTags = [ai.industry, ai.business_model, ai.pricing_model].filter(Boolean);
    const metaHtml = metaTags.length
      ? `<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.6rem;">${metaTags.map((t) => `<span class="si-meta-tag">${esc(t)}</span>`).join("")}</div>`
      : "";

    const contactsHtml = buildContactsHtml(mergedEmails, mergedBooking, mergedSocial);

    const FRONTEND_URL = "https://sales-intel-frontend.onrender.com";
    const dashUrl = data.id ? `${FRONTEND_URL}/analyze/${data.id}` : FRONTEND_URL;

    const jsonData = JSON.stringify(data, null, 2);
    const jsonBlob = "data:application/json;charset=utf-8," + encodeURIComponent(jsonData);

    // Build CSV
    const csvRows = [["type", "value"]];
    mergedEmails.forEach((e) => csvRows.push(["email", e]));
    mergedBooking.forEach((b) => csvRows.push(["booking", b]));
    mergedSocial.forEach((s) => csvRows.push(["social", s]));
    const csvContent = csvRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const csvBlob = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
    const csvFilename = (window.location.hostname.replace(/\./g, "_")) + "_contacts.csv";

    const { body } = createPanel(
      `<h3>${esc(companyName)}</h3>${tagline ? `<p>${esc(tagline)}</p>` : ""}`,
      `
      ${hookHtml}
      ${metaHtml}
      ${summaryHtml}
      ${techHtml}
      <div class="si-section-label" style="margin-top:0.85rem;">Contacts</div>
      ${contactsHtml}
      <div class="si-actions">
        <a class="si-btn-primary" href="${dashUrl}" target="_blank" rel="noopener">View Dashboard</a>
        <a class="si-btn-link" href="${jsonBlob}" download="analysis.json">JSON</a>
        <a class="si-btn-link" href="${csvBlob}" download="${csvFilename}">CSV</a>
      </div>
      `
    );

    // Wire up tabs
    body.querySelectorAll(".si-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.dataset.target;
        body.querySelectorAll(".si-tab").forEach((t) => t.classList.remove("active"));
        body.querySelectorAll(".si-tab-pane").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const targetPane = body.querySelector(`#${targetId}`);
        if (targetPane) targetPane.classList.add("active");
      });
    });
  }

  function showLocalOnlyPanel(localContacts, errorMsg) {
    const total = localContacts.emails.length + localContacts.booking.length + localContacts.social.length;
    const contactsHtml = buildContactsHtml(localContacts.emails, localContacts.booking, localContacts.social);

    const { body } = createPanel(
      `<h3>${window.location.hostname}</h3><p>Page scan complete</p>`,
      `
      ${errorMsg ? `<div style="background:#fef2f2;border-radius:6px;padding:0.55rem 0.75rem;margin-bottom:0.75rem;font-size:0.78rem;color:#dc2626;">Backend unavailable — showing page data only</div>` : ""}
      <div class="si-section-label">Contacts Found (${total})</div>
      ${contactsHtml}
      `
    );

    body.querySelectorAll(".si-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const targetId = tab.dataset.target;
        body.querySelectorAll(".si-tab").forEach((t) => t.classList.remove("active"));
        body.querySelectorAll(".si-tab-pane").forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        const targetPane = body.querySelector(`#${targetId}`);
        if (targetPane) targetPane.classList.add("active");
      });
    });
  }

  function buildContactsHtml(emails, booking, social) {
    const emailsHtml = emails.length
      ? emails.map((e) => `<div class="si-contact-item"><span class="si-badge si-badge-email">Email</span><a href="mailto:${esc(e)}">${esc(e)}</a></div>`).join("")
      : `<div class="si-empty">No emails detected</div>`;

    const bookingHtml = booking.length
      ? booking.map((b) => `<div class="si-contact-item"><span class="si-badge si-badge-booking">Book</span><a href="${esc(b)}" target="_blank" rel="noopener">${esc(b.replace(/https?:\/\/(www\.)?/, ""))}</a></div>`).join("")
      : `<div class="si-empty">No booking links detected</div>`;

    const socialHtml = social.length
      ? social.map((s) => `<div class="si-contact-item"><span class="si-badge si-badge-social">Social</span><a href="${esc(s)}" target="_blank" rel="noopener">${esc(s.replace(/https?:\/\/(www\.)?/, ""))}</a></div>`).join("")
      : `<div class="si-empty">No social links detected</div>`;

    const emailCount = emails.length ? `<span style="margin-left:0.3rem;font-size:0.68rem;background:rgba(37,99,235,0.12);color:#2563eb;border-radius:999px;padding:0.05rem 0.4rem;">${emails.length}</span>` : "";
    const bookCount = booking.length ? `<span style="margin-left:0.3rem;font-size:0.68rem;background:rgba(22,163,74,0.12);color:#16a34a;border-radius:999px;padding:0.05rem 0.4rem;">${booking.length}</span>` : "";
    const socCount = social.length ? `<span style="margin-left:0.3rem;font-size:0.68rem;background:rgba(217,119,6,0.12);color:#d97706;border-radius:999px;padding:0.05rem 0.4rem;">${social.length}</span>` : "";

    return `
      <div class="si-tabs">
        <button class="si-tab active" data-target="si-pane-emails">Emails${emailCount}</button>
        <button class="si-tab" data-target="si-pane-booking">Booking${bookCount}</button>
        <button class="si-tab" data-target="si-pane-social">Social${socCount}</button>
      </div>
      <div id="si-pane-emails" class="si-tab-pane active">${emailsHtml}</div>
      <div id="si-pane-booking" class="si-tab-pane">${bookingHtml}</div>
      <div id="si-pane-social" class="si-tab-pane">${socialHtml}</div>
    `;
  }

  // ─── Utility ───────────────────────────────────────────────────────────────
  function esc(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ─── Main flow ─────────────────────────────────────────────────────────────
  function startAnalysis() {
    // 1. Extract contacts from page immediately
    const localContacts = extractLocalContacts();

    // 2. Show loading panel with whatever we found locally
    showLoadingPanel(localContacts);

    // 3. Ask background.js to hit the backend
    chrome.runtime.sendMessage(
      { type: "ANALYZE_WEBSITE", url: window.location.href },
      (response) => {
        if (chrome.runtime.lastError) {
          showLocalOnlyPanel(localContacts, chrome.runtime.lastError.message);
          return;
        }
        if (response?.error) {
          showLocalOnlyPanel(localContacts, response.error);
          return;
        }
        // 4. Show full result, merging backend data with local contacts
        showResult(response, localContacts);
      }
    );
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  injectStyles();
  const btn = getOrCreateButton();
  if (btn) document.body.appendChild(btn);
})();
