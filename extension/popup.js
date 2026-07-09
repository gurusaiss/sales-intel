async function loadPersons() {
  const listEl = document.getElementById("list");
  try {
    const res = await fetch(`${API_BASE}/api/persons`);
    const { persons } = await res.json();

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
        <span class="status-pill">${p.status.replace("_", " ")}</span>
      </div>
    `
      )
      .join("");
  } catch (err) {
    listEl.innerHTML = `<div class="empty">Backend not reachable. Is it running on localhost:4000?</div>`;
  }
}

function escapeHtml(s) {
  return (s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

loadPersons();
