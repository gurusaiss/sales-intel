import { Router } from "express";
import multer from "multer";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string; numpages: number }>;
import { resolveUser } from "../middleware/auth";
import { createRateLimit } from "../middleware/rateLimit";
import {
  createCIQJob, getCIQJob, listCIQJobs, updateCIQJob, deleteCIQJob,
  setJobShare, revokeJobShare, getJobByShareToken,
  createApplication, getApplication, listApplications, updateApplication, deleteApplication,
  type AppStatus,
} from "../services/companyIntelStore";
import {
  generateCompanyIntelReport,
  generateCoverLetterCIQ,
  analyzeJobDescription,
  compareCompanies,
  getSalaryIntelligence,
} from "../services/companyIntelService";
import { generateMarkdown } from "../services/markdownGenerator";
import { generatePptPrompt } from "../services/pptPromptGenerator";

const router = Router();
const limiter = createRateLimit(20, 3_600_000);

// multer — memory storage for PDF uploads (max 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

const DEFAULT_USER = process.env.DEFAULT_USER_ID ?? "default";
function uid(req: Express.Request): string {
  return (req as unknown as { userId?: string }).userId ?? DEFAULT_USER;
}

// ── PDF Resume Upload ────────────────────────────────────────────────────────

/** POST /api/ciq/resume/parse — upload PDF, get back plain text */
router.post("/ciq/resume/parse", upload.single("resume"), async (req, res) => {
  const file = (req as unknown as { file?: Express.Multer.File }).file;
  if (!file) return res.status(400).json({ error: "No PDF file uploaded (field name: resume)" });
  try {
    const data = await pdfParse(file.buffer);
    const text = data.text?.trim();
    if (!text || text.length < 50) {
      return res.status(422).json({ error: "PDF has no extractable text (try a text-based PDF, not a scanned image)" });
    }
    res.json({ text, pages: data.numpages, chars: text.length });
  } catch (err) {
    res.status(422).json({ error: "Could not parse PDF: " + (err instanceof Error ? err.message : "unknown error") });
  }
});

// ── Company Intelligence Report ─────────────────────────────────────────────

/** POST /api/ciq/reports — start async job */
router.post("/ciq/reports", limiter, async (req, res) => {
  const { companyName, resumeText } = req.body as { companyName?: string; resumeText?: string };
  if (!companyName?.trim() || !resumeText?.trim()) {
    return res.status(400).json({ error: "companyName and resumeText are required" });
  }

  const userId = uid(req);
  const job = await createCIQJob(userId, companyName.trim(), resumeText.trim());
  res.json({ jobId: job.id, status: job.status });

  void (async () => {
    try {
      await updateCIQJob(userId, job.id, { status: "researching" });
      const report = await generateCompanyIntelReport(companyName.trim(), resumeText.trim());
      if (report) {
        await updateCIQJob(userId, job.id, { status: "done", report });
      } else {
        await updateCIQJob(userId, job.id, { status: "failed", errorMessage: "AI unavailable — add an API key" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await updateCIQJob(userId, job.id, { status: "failed", errorMessage: msg });
    }
  })();
});

/** GET /api/ciq/reports/:id/status — poll job */
router.get("/ciq/reports/:id/status", async (req, res) => {
  const job = await getCIQJob(uid(req), req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ status: job.status, errorMessage: job.errorMessage });
});

/** GET /api/ciq/reports/:id/flashcards — interview question flashcards */
router.get("/ciq/reports/:id/flashcards", async (req, res) => {
  const job = await getCIQJob(uid(req), req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "done") return res.status(409).json({ error: "Report not ready yet" });

  const questions = job.report?.interviewQuestions ?? [];
  const cards = questions.map((q, i) => ({
    id: i + 1,
    question: q,
    tip: `Prepare a specific STAR-format example. Focus on: ${q.toLowerCase().includes("challenge") ? "obstacles you overcame" : q.toLowerCase().includes("team") ? "collaboration and your role" : "measurable outcomes and your direct impact"}.`,
  }));

  res.json({ company: job.companyName, cards, total: cards.length });
});

/** GET /api/ciq/reports/:id/export — export as markdown or pptx prompt */
router.get("/ciq/reports/:id/export", async (req, res) => {
  const { format } = req.query as { format?: string };
  const job = await getCIQJob(uid(req), req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "done" || !job.report) return res.status(409).json({ error: "Report not ready yet" });

  if (format === "pptx") {
    const prompt = generatePptPrompt(job.companyName, job.report);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${job.companyName.replace(/[^a-z0-9]/gi, "_")}_ppt_prompt.txt"`);
    return res.send(prompt);
  }

  // Default: markdown
  const md = generateMarkdown(job.companyName, job.report);
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${job.companyName.replace(/[^a-z0-9]/gi, "_")}_report.md"`);
  res.send(md);
});

/** GET /api/ciq/reports/:id — get completed report */
router.get("/ciq/reports/:id", async (req, res) => {
  const job = await getCIQJob(uid(req), req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

/** GET /api/ciq/reports — list user's history */
router.get("/ciq/reports", async (req, res) => {
  const jobs = await listCIQJobs(uid(req));
  res.json(jobs.map((j) => ({
    id: j.id, companyName: j.companyName, status: j.status,
    isPublic: j.isPublic, shareToken: j.shareToken,
    createdAt: j.createdAt, updatedAt: j.updatedAt,
  })));
});

/** DELETE /api/ciq/reports/:id */
router.delete("/ciq/reports/:id", async (req, res) => {
  await deleteCIQJob(uid(req), req.params.id);
  res.json({ ok: true });
});

// ── Share Links ──────────────────────────────────────────────────────────────

/** POST /api/ciq/reports/:id/share — generate public share link */
router.post("/ciq/reports/:id/share", async (req, res) => {
  try {
    const token = await setJobShare(uid(req), req.params.id);
    res.json({ shareToken: token, sharePath: `/share/${token}` });
  } catch (err) {
    res.status(404).json({ error: err instanceof Error ? err.message : "Failed to share" });
  }
});

/** DELETE /api/ciq/reports/:id/share — revoke share link */
router.delete("/ciq/reports/:id/share", async (req, res) => {
  await revokeJobShare(uid(req), req.params.id);
  res.json({ ok: true });
});

/** GET /api/ciq/share/:token — public read (no auth required) */
router.get("/ciq/share/:token", async (req, res) => {
  const job = await getJobByShareToken(req.params.token);
  if (!job || !job.isPublic) return res.status(404).json({ error: "Report not found or no longer public" });
  if (job.status !== "done") return res.status(409).json({ error: "Report not ready yet" });
  res.json({
    companyName: job.companyName,
    report: job.report,
    createdAt: job.createdAt,
  });
});

// ── Cover Letter ─────────────────────────────────────────────────────────────

router.post("/ciq/cover-letter", limiter, async (req, res) => {
  const { companyName, role, resumeText, jobDescription } = req.body as {
    companyName?: string; role?: string; resumeText?: string; jobDescription?: string;
  };
  if (!companyName?.trim() || !role?.trim() || !resumeText?.trim()) {
    return res.status(400).json({ error: "companyName, role and resumeText are required" });
  }
  const letter = await generateCoverLetterCIQ(companyName, role, resumeText, jobDescription);
  res.json({ letter });
});

// ── JD Fit Analysis ──────────────────────────────────────────────────────────

router.post("/ciq/jd-fit", limiter, async (req, res) => {
  const { resumeText, jobDescription, companyName } = req.body as {
    resumeText?: string; jobDescription?: string; companyName?: string;
  };
  if (!resumeText?.trim() || !jobDescription?.trim()) {
    return res.status(400).json({ error: "resumeText and jobDescription are required" });
  }
  const result = await analyzeJobDescription(resumeText, jobDescription, companyName);
  if (!result) return res.status(503).json({ error: "AI unavailable" });
  res.json(result);
});

// ── Company Comparison ───────────────────────────────────────────────────────

router.post("/ciq/compare", limiter, async (req, res) => {
  const { company1, company2, resumeText } = req.body as {
    company1?: string; company2?: string; resumeText?: string;
  };
  if (!company1?.trim() || !company2?.trim() || !resumeText?.trim()) {
    return res.status(400).json({ error: "company1, company2 and resumeText are required" });
  }
  const result = await compareCompanies(company1, company2, resumeText);
  if (!result) return res.status(503).json({ error: "AI unavailable" });
  res.json(result);
});

// ── Salary Intelligence ──────────────────────────────────────────────────────

router.post("/ciq/salary", limiter, async (req, res) => {
  const { role, companyName, resumeText, location } = req.body as {
    role?: string; companyName?: string; resumeText?: string; location?: string;
  };
  if (!role?.trim() || !companyName?.trim() || !resumeText?.trim()) {
    return res.status(400).json({ error: "role, companyName and resumeText are required" });
  }
  const result = await getSalaryIntelligence(role, companyName, resumeText, location);
  if (!result) return res.status(503).json({ error: "AI unavailable" });
  res.json(result);
});

// ── Application Tracker ──────────────────────────────────────────────────────

const VALID_STATUSES: AppStatus[] = ["saved", "applied", "interview", "offer", "rejected"];

router.get("/ciq/applications", async (req, res) => {
  const apps = await listApplications(uid(req));
  res.json(apps);
});

router.post("/ciq/applications", async (req, res) => {
  const { company, role, status, notes, jobId } = req.body as {
    company?: string; role?: string; status?: string; notes?: string; jobId?: string;
  };
  if (!company?.trim() || !role?.trim()) {
    return res.status(400).json({ error: "company and role are required" });
  }
  const validStatus: AppStatus = VALID_STATUSES.includes(status as AppStatus) ? (status as AppStatus) : "saved";
  const app = await createApplication(uid(req), { company: company.trim(), role: role.trim(), status: validStatus, notes: notes ?? "", jobId });
  res.status(201).json(app);
});

router.patch("/ciq/applications/:id", async (req, res) => {
  const { company, role, status, notes, nextActionAt } = req.body as {
    company?: string; role?: string; status?: string; notes?: string; nextActionAt?: string;
  };
  const patch: Parameters<typeof updateApplication>[2] = {};
  if (company !== undefined) patch.company = company.trim();
  if (role !== undefined) patch.role = role.trim();
  if (status !== undefined && VALID_STATUSES.includes(status as AppStatus)) patch.status = status as AppStatus;
  if (notes !== undefined) patch.notes = notes;
  if (nextActionAt !== undefined) patch.nextActionAt = nextActionAt;

  const updated = await updateApplication(uid(req), req.params.id, patch);
  if (!updated) return res.status(404).json({ error: "Application not found" });
  res.json(updated);
});

router.delete("/ciq/applications/:id", async (req, res) => {
  const ok = await deleteApplication(uid(req), req.params.id);
  if (!ok) return res.status(404).json({ error: "Application not found" });
  res.json({ ok: true });
});

export default router;
