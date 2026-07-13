import { Router } from "express";
import { z } from "zod";
import {
  captureOrUpdatePerson,
  findPersonByIdentity,
  getPerson,
  listPersons,
  updatePerson,
} from "../services/personStore";
import { generateFollowUpDraft, generateChannelSwitchEmail } from "../services/ai";
import { matchTemplateCategory } from "../services/templates";
import { getEnrichmentProvider } from "../services/enrichment";
import { scanCompanySite } from "../services/siteScanner";
import { requireApiKey } from "../middleware/apiKey";

const router = Router();

const visibleMessageSchema = z.object({
  direction: z.enum(["outbound", "inbound"]),
  text: z.string().trim().min(1),
});

const captureSchema = z.object({
  linkedinUrl: z.string().trim().url(),
  name: z.string().trim().min(1),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  location: z.string().trim().optional(),
  visibleMessage: visibleMessageSchema.optional(),
});

router.get("/persons", requireApiKey, async (_req, res) => {
  const persons = await listPersons();
  res.json({ persons });
});

/**
 * Cross-channel identity linking: lets the research tool ask "is this person
 * already tracked from LinkedIn?" by email, company domain, or name — must be
 * registered before the /:linkedinUrl route below or Express will treat
 * "lookup" as a linkedinUrl param.
 */
router.get("/persons/lookup", requireApiKey, async (req, res) => {
  const { email, domain, name } = req.query;
  const match = await findPersonByIdentity({
    email: typeof email === "string" ? email : undefined,
    domain: typeof domain === "string" ? domain : undefined,
    name: typeof name === "string" ? name : undefined,
  });
  res.json({ person: match ?? null });
});

router.get("/persons/:linkedinUrl", requireApiKey, async (req, res) => {
  const person = await getPerson(decodeURIComponent(req.params.linkedinUrl));
  if (!person) return res.status(404).json({ error: "Person not found" });
  res.json({ person });
});

router.post("/persons/capture", requireApiKey, async (req, res) => {
  const parsed = captureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const person = await captureOrUpdatePerson(parsed.data);
    res.json({ person });
  } catch (err) {
    console.error("Capture failed", err);
    res.status(500).json({ error: "Failed to capture person." });
  }
});

const patchSchema = z.object({
  tags: z.array(z.string()).optional(),
  priority: z.number().min(1).max(5).optional(),
  status: z.enum(["no_reply", "replied", "booked", "closed", "do_not_contact"]).optional(),
  templateCategory: z
    .enum(["ceo", "founder", "recruiter", "hr", "investor", "sir", "madam", "unclassified"])
    .optional(),
  notes: z
    .array(z.object({ text: z.string(), createdAt: z.string(), author: z.string().optional() }))
    .optional(),
});

router.patch("/persons/:linkedinUrl", requireApiKey, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const person = await updatePerson(decodeURIComponent(req.params.linkedinUrl), parsed.data);
  if (!person) return res.status(404).json({ error: "Person not found" });
  res.json({ person });
});

const draftSchema = captureSchema.extend({
  templateOverride: z
    .enum(["ceo", "founder", "recruiter", "hr", "investor", "sir", "madam", "unclassified"])
    .optional(),
});

router.post("/draft", requireApiKey, async (req, res) => {
  const parsed = draftSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  try {
    const { templateOverride, ...captureInput } = parsed.data;
    const person = await captureOrUpdatePerson(captureInput);

    if (person.status === "do_not_contact") {
      return res
        .status(409)
        .json({ error: "This person is marked do_not_contact. No draft generated." });
    }

    if (templateOverride) {
      person.templateCategory = templateOverride;
      await updatePerson(person.linkedinUrl, { templateCategory: templateOverride });
    } else if (person.templateCategory === "unclassified" && person.role) {
      const matched = matchTemplateCategory(person.role);
      if (matched !== "unclassified") {
        person.templateCategory = matched;
        await updatePerson(person.linkedinUrl, { templateCategory: matched });
      }
    }

    const draft = await generateFollowUpDraft(person);
    res.json({ person, templateUsed: person.templateCategory, draft });
  } catch (err) {
    console.error("Draft generation failed", err);
    res.status(500).json({ error: "Failed to generate draft." });
  }
});

const escalateSchema = z.object({
  domain: z.string().trim().optional(),
});

/**
 * No-reply escalation (Section 4 of the LinkedIn MVP plan): manually triggered
 * per person, never automatic. Checks the company's own public site for a
 * contact page or booking link — the same info any visitor to that site could
 * find — and recommends the next channel instead of guessing or scraping
 * anything not already public.
 */
router.post("/persons/:linkedinUrl/escalate", requireApiKey, async (req, res) => {
  const parsed = escalateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }

  const linkedinUrl = decodeURIComponent(req.params.linkedinUrl);
  const person = await getPerson(linkedinUrl);
  if (!person) return res.status(404).json({ error: "Person not found" });
  if (person.status === "do_not_contact") {
    return res.status(409).json({ error: "This person is marked do_not_contact." });
  }

  const domain = parsed.data.domain || person.companyDomain;
  if (!domain) {
    return res.json({
      person,
      suggestedAction: "no_domain",
      message: "No company domain on file. Provide one to check for public contact info.",
    });
  }

  try {
    const provider = getEnrichmentProvider(domain);
    const enrichment = await provider.lookup(person.name, domain);
    const scan = enrichment.company?.website
      ? await scanCompanySite(enrichment.company.website)
      : {};

    const publicEmail = enrichment.person.publicEmail ?? person.publicEmail;
    const emailConfidence = enrichment.person.emailConfidence ?? person.emailConfidence;
    const contactPageUrl = scan.contactPageUrl ?? person.contactPageUrl;
    const bookingUrl = scan.bookingUrl ?? person.bookingUrl;

    const updated = await updatePerson(linkedinUrl, {
      companyDomain: domain,
      publicEmail,
      emailConfidence,
      contactPageUrl,
      bookingUrl,
    });

    const suggestedAction = bookingUrl
      ? "booking_available"
      : publicEmail
        ? "email_available"
        : "no_public_channel_found";

    const emailDraft =
      suggestedAction === "email_available" && publicEmail && updated
        ? await generateChannelSwitchEmail(updated, publicEmail)
        : undefined;

    res.json({ person: updated, suggestedAction, contactPageUrl, bookingUrl, emailDraft });
  } catch (err) {
    console.error("Escalation failed", err);
    res.status(500).json({ error: "Failed to check public contact channels." });
  }
});

/**
 * Batch queue: generates a fresh draft for every no-reply person at once, so
 * the human can rapid-review and copy-paste-send through the list instead of
 * opening each LinkedIn thread one at a time. Still zero auto-send — this
 * only prepares text, nothing here ever touches LinkedIn or an inbox.
 */
router.get("/queue", requireApiKey, async (req, res) => {
  const requested = Number(req.query.limit);
  const limit = Math.min(Math.max(Number.isFinite(requested) && requested > 0 ? requested : 15, 1), 30);

  try {
    const all = await listPersons();
    const pending = all
      .filter((p) => p.status === "no_reply")
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      })
      .slice(0, limit);

    const queue = [];
    for (const person of pending) {
      const draft = await generateFollowUpDraft(person);
      queue.push({ person, draft });
    }

    res.json({ queue, totalPending: all.filter((p) => p.status === "no_reply").length });
  } catch (err) {
    console.error("Queue generation failed", err);
    res.status(500).json({ error: "Failed to build queue." });
  }
});

export default router;
