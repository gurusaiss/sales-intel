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

export interface AddJobInput {
  company: string;
  role: string;
  jobDescription?: string;
  referralContactName?: string;
  referralContactEmail?: string;
}
