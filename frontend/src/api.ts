import type { ResearchResponse, QueueResponse, ContactStatus, CrmPerson } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  return res.json();
}

export async function searchQuery(query: string, domain?: string): Promise<ResearchResponse> {
  const res = await fetch(`${API_BASE}/api/search`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, domain }),
  });
  return handleResponse(res);
}

export async function fetchQueue(limit = 15): Promise<QueueResponse> {
  const res = await fetch(`${API_BASE}/api/queue?limit=${limit}`);
  return handleResponse(res);
}

export async function updatePersonStatus(
  linkedinUrl: string,
  status: ContactStatus
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/persons/${encodeURIComponent(linkedinUrl)}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  await handleResponse(res);
}

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
}

export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  const res = await fetch(`${API_BASE}/api/auth/google/status`);
  return handleResponse(res);
}

export function getGoogleConnectUrl(): string {
  return `${API_BASE}/api/auth/google`;
}

export async function findLinkedPerson(params: {
  email?: string;
  domain?: string;
  name?: string;
}): Promise<CrmPerson | null> {
  const query = new URLSearchParams();
  if (params.email) query.set("email", params.email);
  if (params.domain) query.set("domain", params.domain);
  if (params.name) query.set("name", params.name);

  const res = await fetch(`${API_BASE}/api/persons/lookup?${query.toString()}`);
  const data = await handleResponse<{ person: CrmPerson | null }>(res);
  return data.person;
}

export async function sendViaGmail(
  to: string,
  subject: string,
  body: string,
  linkedinUrl?: string
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/send-email`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ to, subject, body, linkedinUrl }),
  });
  await handleResponse(res);
}
