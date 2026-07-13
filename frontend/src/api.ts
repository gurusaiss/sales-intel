import type { ResearchResponse, QueueResponse, ContactStatus, CrmPerson } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";
const API_KEY = import.meta.env.VITE_APP_API_KEY;

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    ...(API_KEY ? { "x-api-key": API_KEY } : {}),
    ...extra,
  };
}

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
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ query, domain }),
  });
  return handleResponse(res);
}

export async function fetchQueue(limit = 15): Promise<QueueResponse> {
  const res = await fetch(`${API_BASE}/api/queue?limit=${limit}`, { headers: authHeaders() });
  return handleResponse(res);
}

export async function updatePersonStatus(
  linkedinUrl: string,
  status: ContactStatus
): Promise<void> {
  const res = await fetch(`${API_BASE}/api/persons/${encodeURIComponent(linkedinUrl)}`, {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json" }),
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

  const res = await fetch(`${API_BASE}/api/persons/lookup?${query.toString()}`, {
    headers: authHeaders(),
  });
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
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ to, subject, body, linkedinUrl }),
  });
  await handleResponse(res);
}

export async function addNote(linkedinUrl: string, text: string): Promise<CrmPerson> {
  const res = await fetch(`${API_BASE}/api/persons/${encodeURIComponent(linkedinUrl)}/notes`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse<{ person: CrmPerson }>(res);
  return data.person;
}

export async function logMeeting(
  linkedinUrl: string,
  date: string,
  type?: string,
  notes?: string
): Promise<CrmPerson> {
  const res = await fetch(`${API_BASE}/api/persons/${encodeURIComponent(linkedinUrl)}/meetings`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ date, type, notes }),
  });
  const data = await handleResponse<{ person: CrmPerson }>(res);
  return data.person;
}

export interface TemplateStat {
  category: string;
  attempted: number;
  replied: number;
  booked: number;
  replyRate: number;
}

export interface AnalyticsResponse {
  totalTracked: number;
  statusCounts: Record<string, number>;
  templateStats: TemplateStat[];
}

export async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const res = await fetch(`${API_BASE}/api/analytics`, { headers: authHeaders() });
  return handleResponse(res);
}

export interface CandidateLead {
  name: string;
  title?: string;
  email?: string;
  emailConfidence?: "high" | "medium" | "low" | "unverified";
  sourceUrl?: string;
  tier?: "leadership" | "hiring" | "employee" | "unclassified";
  department?: string;
}

export interface CompanySearchResult {
  company: {
    name: string;
    domain: string;
    website?: string;
    description?: string;
    industry?: string;
    employeeRange?: string;
    socials?: { platform: string; url: string }[];
  };
  people: CandidateLead[];
  source: string;
}

export async function searchCompany(company: string, domain: string): Promise<CompanySearchResult> {
  const res = await fetch(`${API_BASE}/api/company-search`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ company, domain }),
  });
  return handleResponse(res);
}

export type LeadStatus = "new" | "contacted" | "archived";

export interface Lead {
  id: string;
  name: string;
  company?: string;
  companyDomain?: string;
  title?: string;
  linkedinUrl?: string;
  website?: string;
  publicEmail?: string;
  emailConfidence?: string;
  phone?: string;
  tags: string[];
  notes: string;
  status: LeadStatus;
  priority: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export async function addLeadsToCrm(
  company: string,
  companyDomain: string,
  source: string,
  people: CandidateLead[]
): Promise<Lead[]> {
  const res = await fetch(`${API_BASE}/api/leads`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ company, companyDomain, source, people }),
  });
  const data = await handleResponse<{ leads: Lead[] }>(res);
  return data.leads;
}

export async function fetchLeads(): Promise<Lead[]> {
  const res = await fetch(`${API_BASE}/api/leads`, { headers: authHeaders() });
  const data = await handleResponse<{ leads: Lead[] }>(res);
  return data.leads;
}

export async function updateLeadStatus(id: string, status: LeadStatus): Promise<void> {
  const res = await fetch(`${API_BASE}/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  await handleResponse(res);
}

export async function deleteLeadById(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/leads/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}

/**
 * Downloads an export as a Blob rather than a plain link — a plain <a href>
 * navigation can't carry the x-api-key header, so it would 401 the moment
 * APP_API_KEY is set on the backend.
 */
async function downloadExport(path: string, filename: string): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Export failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function downloadLeadsExport(format: "csv" | "json"): Promise<void> {
  return downloadExport(`/api/leads/export?format=${format}`, `leads.${format}`);
}

export function downloadPersonsExport(format: "csv" | "json"): Promise<void> {
  return downloadExport(`/api/persons/export?format=${format}`, `linkedin-contacts.${format}`);
}

export interface Resume {
  text: string;
  updatedAt: string;
}

export async function fetchResume(): Promise<Resume | null> {
  const res = await fetch(`${API_BASE}/api/resume`, { headers: authHeaders() });
  const data = await handleResponse<{ resume: Resume | null }>(res);
  return data.resume;
}

export async function saveResumeText(text: string): Promise<Resume> {
  const res = await fetch(`${API_BASE}/api/resume`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ text }),
  });
  const data = await handleResponse<{ resume: Resume }>(res);
  return data.resume;
}

export interface JobMatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
}

export async function scoreJobMatch(jobDescription: string): Promise<JobMatchResult> {
  const res = await fetch(`${API_BASE}/api/job-match`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ jobDescription }),
  });
  return handleResponse(res);
}

export async function generateCoverLetter(
  jobDescription: string,
  company: string,
  role: string
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/cover-letter`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ jobDescription, company, role }),
  });
  const data = await handleResponse<{ coverLetter: string }>(res);
  return data.coverLetter;
}

export type JobStatus = "saved" | "applied" | "interviewing" | "offer" | "rejected";

export interface JobApplication {
  id: string;
  company: string;
  role: string;
  jobDescription?: string;
  status: JobStatus;
  referralContactName?: string;
  referralContactEmail?: string;
  appliedDate?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export async function fetchJobs(): Promise<JobApplication[]> {
  const res = await fetch(`${API_BASE}/api/jobs`, { headers: authHeaders() });
  const data = await handleResponse<{ jobs: JobApplication[] }>(res);
  return data.jobs;
}

export async function addJobApplication(
  company: string,
  role: string,
  referralContactName?: string
): Promise<JobApplication> {
  const res = await fetch(`${API_BASE}/api/jobs`, {
    method: "POST",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ company, role, referralContactName }),
  });
  const data = await handleResponse<{ job: JobApplication }>(res);
  return data.job;
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  await handleResponse(res);
}

export async function deleteJobApplication(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/jobs/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  await handleResponse(res);
}
