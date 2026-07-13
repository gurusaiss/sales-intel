import { EnrichmentResult } from "../types";
import { CrmPerson } from "../types/crm";
import { getTemplateSpec } from "./templates";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

interface AiOutput {
  aiSummary: string;
  outreachDraft: { subject: string; body: string };
}

export async function callGroq(prompt: string, maxTokens: number): Promise<string | null> {
  if (!GROQ_API_KEY) return null;

  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("Groq API error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error("Groq request failed", err);
    return null;
  }
}

export async function generateResearchOutput(enrichment: EnrichmentResult): Promise<AiOutput> {
  const text = await callGroq(buildPrompt(enrichment), 800);
  if (!text) return templateFallback(enrichment);
  return parseModelOutput(text, enrichment);
}

function buildTechStackSection(enrichment: EnrichmentResult): string {
  const ts = enrichment.company?.techStack;
  if (!ts) return "";
  const lines: string[] = [];
  if (ts.frontend?.length)  lines.push(`  Frontend:   ${ts.frontend.join(", ")}`);
  if (ts.backend?.length)   lines.push(`  Backend:    ${ts.backend.join(", ")}`);
  if (ts.cms?.length)       lines.push(`  CMS:        ${ts.cms.join(", ")}`);
  if (ts.analytics?.length) lines.push(`  Analytics:  ${ts.analytics.join(", ")}`);
  if (ts.marketing?.length) lines.push(`  Marketing:  ${ts.marketing.join(", ")}`);
  if (ts.cdn?.length)       lines.push(`  CDN:        ${ts.cdn.join(", ")}`);
  if (ts.hosting?.length)   lines.push(`  Hosting:    ${ts.hosting.join(", ")}`);
  if (ts.security?.length)  lines.push(`  Security:   ${ts.security.join(", ")}`);
  if (!lines.length) return "";
  return `\nDETECTED TECH STACK (live scan of their website):\n${lines.join("\n")}\n`;
}

function buildPrompt(enrichment: EnrichmentResult): string {
  return `You are a sales research assistant. Given this public business information, produce:
1. A 3-sentence summary of who this person is and why they're relevant to a sales/business outreach.
2. A personalized outreach email (subject + body, under 120 words) referencing a specific real signal from the data (not generic). If a tech stack is provided, mention one specific technology they use to show you've done your homework.

Respond in this exact format:
SUMMARY: <summary>
SUBJECT: <subject line>
BODY: <email body>
${buildTechStackSection(enrichment)}
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
  const text = await callGroq(buildFollowUpPrompt(person), 400);
  return text || followUpFallback(person);
}

export async function generateChannelSwitchEmail(
  person: CrmPerson,
  targetEmail: string
): Promise<{ subject: string; body: string }> {
  const prompt = `You are drafting a first email to someone who never replied to your LinkedIn messages. You found their public business email and are now trying a different channel.

RECIPIENT: ${person.name}${person.role ? `, ${person.role}` : ""}${person.company ? ` at ${person.company}` : ""}
PRIOR LINKEDIN ATTEMPTS: ${person.followUpCount}
LAST LINKEDIN MESSAGE SENT: ${
    [...person.messages].reverse().find((m) => m.direction === "outbound")?.text ?? "(none captured)"
  }

Write a short email (under 100 words) that naturally references trying LinkedIn first without sounding awkward about it. Respond in this exact format:
SUBJECT: <subject line>
BODY: <email body>`;

  const text = await callGroq(prompt, 350);
  if (text) {
    const subjectMatch = text.match(/SUBJECT:\s*([\s\S]*?)(?=BODY:|$)/i);
    const bodyMatch = text.match(/BODY:\s*([\s\S]*)/i);
    if (subjectMatch && bodyMatch) {
      return { subject: subjectMatch[1].trim(), body: bodyMatch[1].trim() };
    }
  }

  return {
    subject: `Following up${person.company ? ` — ${person.company}` : ""}`,
    body: `Hi ${person.name.split(" ")[0]},\n\nI reached out on LinkedIn a little while back but wanted to try email in case it's easier to catch you here. ${
      person.company ? `Still keen to connect about ${person.company}.` : "Would love to reconnect."
    }\n\nLet me know if you have 15 minutes this week.\n\nBest,\n[Your name]`,
  };
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
