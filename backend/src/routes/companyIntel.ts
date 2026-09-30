import { Router } from "express";
import { resolveUser } from "../middleware/auth";
import { createRateLimit } from "../middleware/rateLimit";
import {
  createCIQJob, getCIQJob, listCIQJobs, updateCIQJob, deleteCIQJob,
} from "../services/companyIntelStore";
import {
  generateCompanyIntelReport,
  generateCoverLetterCIQ,
  analyzeJobDescription,
  compareCompanies,
  getSalaryIntelligence,
} from "../services/companyIntelService";

const router = Router();
const limiter = createRateLimit(20, 3_600_000);

const DEFAULT_USER = process.env.DEFAULT_USER_ID ?? "default";
function uid(req: Express.Request): string {
  return (req as unknown as { userId?: string }).userId ?? DEFAULT_USER;
}

// ── Company Intelligence Report ─────────────────────────────────────────────

/** POST /api/ciq/reports — start async job */
router.post("/ciq/reports", limiter, async (req, res) => {
  const { companyName, resumeText } = req.body as { companyName?: string; resumeText?: string };
  if (!companyName?.trim() || !resumeText?.trim()) {
    return res.status(400).json({ error: "companyName and resumeText are required" });
  }

  const job = await createCIQJob(uid(req), companyName.trim(), resumeText.trim());
  res.json({ jobId: job.id, status: job.status });

  // Background processing
  void (async () => {
    try {
      await updateCIQJob(uid(req), job.id, { status: "researching" });
      const report = await generateCompanyIntelReport(companyName.trim(), resumeText.trim());
      if (report) {
        await updateCIQJob(uid(req), job.id, { status: "done", report });
      } else {
        await updateCIQJob(uid(req), job.id, { status: "failed", errorMessage: "AI unavailable — add an API key" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await updateCIQJob(uid(req), job.id, { status: "failed", errorMessage: msg });
    }
  })();
});

/** GET /api/ciq/reports/:id/status — poll job */
router.get("/ciq/reports/:id/status", async (req, res) => {
  const job = await getCIQJob(uid(req), req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json({ status: job.status, errorMessage: job.errorMessage });
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
    createdAt: j.createdAt, updatedAt: j.updatedAt,
  })));
});

/** DELETE /api/ciq/reports/:id */
router.delete("/ciq/reports/:id", async (req, res) => {
  await deleteCIQJob(uid(req), req.params.id);
  res.json({ ok: true });
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

export default router;
