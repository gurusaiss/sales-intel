import type { ResearchResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function searchQuery(query: string, domain?: string): Promise<ResearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, domain }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }

  return res.json();
}
