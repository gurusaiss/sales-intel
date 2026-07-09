import { Router } from "express";
import { z } from "zod";
import {
  captureOrUpdatePerson,
  getPerson,
  listPersons,
  updatePerson,
} from "../services/personStore";
import { generateFollowUpDraft } from "../services/ai";
import { matchTemplateCategory } from "../services/templates";

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

router.get("/persons", async (_req, res) => {
  const persons = await listPersons();
  res.json({ persons });
});

router.get("/persons/:linkedinUrl", async (req, res) => {
  const person = await getPerson(decodeURIComponent(req.params.linkedinUrl));
  if (!person) return res.status(404).json({ error: "Person not found" });
  res.json({ person });
});

router.post("/persons/capture", async (req, res) => {
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

router.patch("/persons/:linkedinUrl", async (req, res) => {
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

router.post("/draft", async (req, res) => {
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

export default router;
