import { Router } from "express";
import { z } from "zod";
import { searchCompanyPeople } from "../services/enrichment";
import { addLeads, deleteLead, listLeads, updateLead, VALID_STATUSES } from "../services/leadStore";
import { requireApiKey } from "../middleware/apiKey";
import { classifyRole, leadershipRank } from "../services/roleClassifier";

const TIER_ORDER = { leadership: 0, hiring: 1, employee: 2, unclassified: 3 } as const;

const router = Router();

const companySearchSchema = z.object({
  company: z.string().trim().min(1),
  domain: z
    .string()
    .trim()
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/i, "Domain must look like example.com"),
});

/**
 * "Enter a company, find relevant professionals" — always sourced from a
 * compliant data provider (Hunter/Snov domain search, or the mock fallback),
 * never from scraping LinkedIn's own search or company pages directly.
 * Returns candidates only; nothing is saved until the user picks who to add.
 */
router.post("/company-search", requireApiKey, async (req, res) => {
  const parsed = companySearchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const result = await searchCompanyPeople(parsed.data.company, parsed.data.domain);

    // Classify + sort into tiers (leadership first, then hiring/management,
    // then everyone else) — same rule-based approach as the LinkedIn
    // template-category matcher, applied to compliant provider data.
    const classified = result.people
      .map((person) => ({ ...person, ...classifyRole(person.title) }))
      .sort((a, b) => {
        const tierDiff = TIER_ORDER[a.tier ?? "unclassified"] - TIER_ORDER[b.tier ?? "unclassified"];
        if (tierDiff !== 0) return tierDiff;
        if (a.tier === "leadership") return leadershipRank(a.title) - leadershipRank(b.title);
        return 0;
      });

    res.json({ ...result, people: classified });
  } catch (err) {
    console.error("Company search failed", err);
    res.status(500).json({ error: "Company search failed. Please try again." });
  }
});

const candidateSchema = z.object({
  name: z.string().trim().min(1),
  title: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  emailConfidence: z.enum(["high", "medium", "low", "unverified"]).optional(),
  sourceUrl: z.string().trim().url().optional(),
});

const addLeadsSchema = z.object({
  company: z.string().trim().optional(),
  companyDomain: z.string().trim().optional(),
  source: z.string().trim().min(1),
  people: z.array(candidateSchema).min(1),
});

/**
 * Saves user-selected candidates from a company search into the leads CRM.
 * Always explicit: the frontend only calls this for candidates the user
 * checked, never the full result set automatically.
 */
router.post("/leads", requireApiKey, async (req, res) => {
  const parsed = addLeadsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const leads = await addLeads(parsed.data);
    res.json({ leads });
  } catch (err) {
    console.error("Adding leads failed", err);
    res.status(500).json({ error: "Failed to save leads." });
  }
});

router.get("/leads", requireApiKey, async (_req, res) => {
  const leads = await listLeads();
  res.json({ leads });
});

const patchLeadSchema = z.object({
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.enum(VALID_STATUSES as [string, ...string[]]).optional(),
  priority: z.number().min(1).max(5).optional(),
  linkedinUrl: z.string().trim().url().optional(),
  phone: z.string().trim().optional(),
});

router.patch("/leads/:id", requireApiKey, async (req, res) => {
  const parsed = patchLeadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const lead = await updateLead(req.params.id, parsed.data as never);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  res.json({ lead });
});

router.delete("/leads/:id", requireApiKey, async (req, res) => {
  const deleted = await deleteLead(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Lead not found" });
  res.json({ deleted: true });
});

router.get("/leads/export", requireApiKey, async (req, res) => {
  const format = (req.query.format as string) || "csv";
  const leads = await listLeads();

  if (format === "json") {
    res.setHeader("Content-Disposition", "attachment; filename=leads.json");
    return res.json(leads);
  }

  const columns = [
    "name",
    "title",
    "company",
    "companyDomain",
    "linkedinUrl",
    "website",
    "publicEmail",
    "emailConfidence",
    "phone",
    "tags",
    "status",
    "priority",
    "source",
    "notes",
    "createdAt",
  ] as const;

  const rows = leads.map((lead) =>
    columns
      .map((col) => {
        const value =
          col === "tags" ? lead.tags.join(";") : (lead as unknown as Record<string, unknown>)[col];
        return csvEscape(value == null ? "" : String(value));
      })
      .join(",")
  );

  const csv = [columns.join(","), ...rows].join("\r\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=leads.csv");
  res.send(csv);
});

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export default router;
