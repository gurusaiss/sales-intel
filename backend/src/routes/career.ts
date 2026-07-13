import { Router } from "express";
import { z } from "zod";
import { getResume, saveResume } from "../services/resumeStore";
import { scoreJobMatch, generateCoverLetter, optimizeResume } from "../services/careerAi";
import { listJobs, addJob, updateJob, deleteJob, VALID_JOB_STATUSES } from "../services/jobStore";
import { getPerson } from "../services/personStore";
import { requireApiKey } from "../middleware/apiKey";
import { logAction } from "../services/auditLog";

const router = Router();

router.get("/resume", requireApiKey, async (req, res) => {
  const resume = await getResume(req.userId);
  res.json({ resume });
});

const resumeSchema = z.object({ text: z.string().trim().min(1) });

router.post("/resume", requireApiKey, async (req, res) => {
  const parsed = resumeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const resume = await saveResume(req.userId, parsed.data.text);
  res.json({ resume });
});

const jobMatchSchema = z.object({ jobDescription: z.string().trim().min(10) });

router.post("/job-match", requireApiKey, async (req, res) => {
  const parsed = jobMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const resume = await getResume(req.userId);
  if (!resume) {
    return res.status(400).json({ error: "Save your resume first." });
  }

  try {
    const result = await scoreJobMatch(resume.text, parsed.data.jobDescription);
    res.json(result);
  } catch (err) {
    console.error("Job match failed", err);
    res.status(500).json({ error: "Failed to score job match." });
  }
});

const coverLetterSchema = z.object({
  jobDescription: z.string().trim().min(10),
  company: z.string().trim().min(1),
  role: z.string().trim().min(1),
});

router.post("/cover-letter", requireApiKey, async (req, res) => {
  const parsed = coverLetterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const resume = await getResume(req.userId);
  if (!resume) {
    return res.status(400).json({ error: "Save your resume first." });
  }

  try {
    const coverLetter = await generateCoverLetter(
      resume.text,
      parsed.data.jobDescription,
      parsed.data.company,
      parsed.data.role
    );
    res.json({ coverLetter });
  } catch (err) {
    console.error("Cover letter generation failed", err);
    res.status(500).json({ error: "Failed to generate cover letter." });
  }
});

const optimizeSchema = z.object({ targetRole: z.string().trim().optional() });

router.post("/resume/optimize", requireApiKey, async (req, res) => {
  const parsed = optimizeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const resume = await getResume(req.userId);
  if (!resume) {
    return res.status(400).json({ error: "Save your resume first." });
  }

  try {
    const optimized = await optimizeResume(resume.text, parsed.data.targetRole);
    res.json({ optimized });
  } catch (err) {
    console.error("Resume optimization failed", err);
    res.status(500).json({ error: "Failed to optimize resume." });
  }
});

router.get("/jobs", requireApiKey, async (req, res) => {
  const jobs = await listJobs(req.userId);
  res.json({ jobs });
});

const addJobSchema = z.object({
  company: z.string().trim().min(1),
  role: z.string().trim().min(1),
  jobDescription: z.string().trim().optional(),
  referralContactName: z.string().trim().optional(),
  referralContactEmail: z.string().trim().email().optional(),
  referralPersonLinkedinUrl: z.string().trim().url().optional(),
});

/**
 * Links a job application's referral contact to an actual tracked CrmPerson
 * by LinkedIn URL, pulling their name/email in automatically instead of
 * requiring the user to retype what's already captured.
 */
router.post("/jobs/:id/link-referral", requireApiKey, async (req, res) => {
  const parsed = z.object({ linkedinUrl: z.string().trim().url() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const person = await getPerson(req.userId, parsed.data.linkedinUrl);
  if (!person) return res.status(404).json({ error: "Person not found" });

  const job = await updateJob(req.userId, req.params.id, {
    referralContactName: person.name,
    referralContactEmail: person.publicEmail,
    referralPersonLinkedinUrl: person.linkedinUrl,
  } as never);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ job });
});

router.post("/jobs", requireApiKey, async (req, res) => {
  const parsed = addJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const job = await addJob(req.userId, parsed.data);
  res.json({ job });
});

const patchJobSchema = z.object({
  status: z.enum(VALID_JOB_STATUSES as [string, ...string[]]).optional(),
  notes: z.string().optional(),
  appliedDate: z.string().optional(),
  referralContactName: z.string().trim().optional(),
  referralContactEmail: z.string().trim().email().optional(),
});

router.patch("/jobs/:id", requireApiKey, async (req, res) => {
  const parsed = patchJobSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const job = await updateJob(req.userId, req.params.id, parsed.data as never);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ job });
});

router.delete("/jobs/:id", requireApiKey, async (req, res) => {
  const deleted = await deleteJob(req.userId, req.params.id);
  if (!deleted) return res.status(404).json({ error: "Job not found" });
  await logAction(req.userId, "job_deleted", `Deleted job application ${req.params.id}`);
  res.json({ deleted: true });
});

export default router;
