import { EnrichmentResult } from "../types";
import { CrmPerson } from "../types/crm";
import { getTemplateSpec } from "./templates";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

interface AiOutput {
  aiSummary: string;
  outreachDraft: { subject: string; body: string };
}

export async function generateResearchOutput(enrichment: EnrichmentResult): Promise<AiOutput> {
  if (!ANTHROPIC_API_KEY) {
    return templateFallback(enrichment);
  }

  const prompt = buildPrompt(enrichment);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic API error", res.status, await res.text());
      return templateFallback(enrichment);
    }

    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = data.content.find((c) => c.type === "text")?.text ?? "";
    return parseModelOutput(text, enrichment);
  } catch (err) {
    console.error("AI generation failed, falling back to template", err);
    return templateFallback(enrichment);
  }
}

function buildPrompt(enrichment: EnrichmentResult): string {
  return `You are a sales research assistant. Given this public business information, produce:
1. A 3-sentence summary of who this person is and why they're relevant to a sales/business outreach.
2. A personalized outreach email (subject + body, under 120 words) referencing a specific real signal from the data (not generic).

Respond in this exact format:
SUMMARY: <summary>
SUBJECT: <subject line>
BODY: <email body>

DATA:
${JSON.stringify(enrichment, null, 2)}`;
}

function parseModelOutput(text: string, enrichment: EnrichmentResult): AiOutput {
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?=SUBJECT:|$)/i);
  const subjectMatch = text.match(/SUBJECT:\s*([\s\S]*?)(?=BODY:|$)/i);
  const bodyMatch = text.match(/BODY:\s*([\s\S]*)/i);

  if (!summaryMatch || !subjectMatch || !bodyMatch) {
    return templateFallback(enrichment);
  }

  return {
    aiSummary: summaryMatch[1].trim(),
    outreachDraft: {
      subject: subjectMatch[1].trim(),
      body: bodyMatch[1].trim(),
    },
  };
}

export async function generateFollowUpDraft(person: CrmPerson): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    return followUpFallback(person);
  }

  const prompt = buildFollowUpPrompt(person);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Anthropic API error (follow-up)", res.status, await res.text());
      return followUpFallback(person);
    }

    const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
    const text = data.content.find((c) => c.type === "text")?.text?.trim();
    return text || followUpFallback(person);
  } catch (err) {
    console.error("Follow-up generation failed, falling back to template", err);
    return followUpFallback(person);
  }
}

function buildFollowUpPrompt(person: CrmPerson): string {
  const spec = getTemplateSpec(person.templateCategory);
  const history = person.messages
    .slice(-6)
    .map((m) => `[${m.direction}, ${m.capturedAt}]: ${m.text}`)
    .join("\n");

  return `You are drafting a LinkedIn follow-up message on behalf of the user. The recipient never replied to a previous message.

TEMPLATE CATEGORY: ${spec.category}
TONE: ${spec.toneInstructions}

RECIPIENT:
Name: ${person.name}
Role: ${person.role ?? "unknown"}
Company: ${person.company ?? "unknown"}
Follow-up count so far: ${person.followUpCount}

CONVERSATION HISTORY (most recent last):
${history || "(no prior messages captured)"}

Write ONE short, natural follow-up message (under 60 words). Reference the prior message naturally if there is history. Do not sound like a template. Do not apologize excessively for following up. Output ONLY the message text, nothing else.`;
}

function followUpFallback(person: CrmPerson): string {
  const firstName = person.name.split(" ")[0];
  const spec = getTemplateSpec(person.templateCategory);
  const salutation =
    spec.category === "sir" ? "Sir" : spec.category === "madam" ? "Madam" : firstName;

  const lastOutbound = [...person.messages].reverse().find((m) => m.direction === "outbound");

  if (lastOutbound) {
    return `Hi ${salutation}, following up on my earlier message${
      person.company ? ` regarding ${person.company}` : ""
    } — wanted to check if you had a chance to see it. Happy to share more context if useful.`;
  }

  return `Hi ${salutation}, wanted to reconnect${
    person.company ? ` regarding ${person.company}` : ""
  } — let me know if now's a good time to continue the conversation.`;
}

function templateFallback(enrichment: EnrichmentResult): AiOutput {
  const { person, company } = enrichment;
  const signal = person.bioSignals?.[0] ?? company?.newsSignals?.[0];

  const aiSummary = [
    `${person.name} is ${person.title ? `the ${person.title}` : "a professional"} at ${person.company ?? company?.name ?? "their company"}.`,
    company?.description ?? "",
    signal ? `Recent signal: ${signal}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const subject = `Quick question about ${company?.name ?? "your team"}'s ${company?.industry ?? "growth"} plans`;
  const body = `Hi ${person.name.split(" ")[0]},\n\n${signal ? `Saw that ${signal.toLowerCase()} — congrats.` : `Came across ${company?.name ?? "your company"} and wanted to reach out.`} Given your role${person.title ? ` as ${person.title}` : ""}, thought it might be worth a quick conversation about how we could help.\n\nOpen to a 15-minute call this week?\n\nBest,\n[Your name]`;

  return { aiSummary, outreachDraft: { subject, body } };
}
