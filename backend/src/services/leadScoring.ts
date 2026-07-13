import { CrmPerson } from "../types/crm";
import { callGroq } from "./ai";

export interface LeadScoreResult {
  score: number;
  reasoning: string;
}

/**
 * Rule-based signals always compute (no API dependency); Groq refines the
 * reasoning text when configured. Score never depends solely on the AI call
 * succeeding, so this works identically with or without GROQ_API_KEY.
 */
function ruleBasedScore(person: CrmPerson): number {
  let score = person.priority * 10; // 10-50

  if (person.status === "booked") score += 30;
  else if (person.status === "replied") score += 20;
  else if (person.status === "no_reply" && person.followUpCount > 0) score += 5;
  if (person.status === "do_not_contact") score -= 40;

  if (person.publicEmail) score += 5;
  if (person.emailConfidence === "high") score += 5;

  const daysSinceUpdate = (Date.now() - new Date(person.updatedAt).getTime()) / 86_400_000;
  if (daysSinceUpdate < 7) score += 5;
  else if (daysSinceUpdate > 30) score -= 10;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function scoreLead(person: CrmPerson): Promise<LeadScoreResult> {
  const score = ruleBasedScore(person);

  const prompt = `Given this tracked contact, write ONE concise sentence (under 25 words) explaining why they are a ${score >= 70 ? "high" : score >= 40 ? "medium" : "low"} priority follow-up target right now.

Name: ${person.name}
Role: ${person.role ?? "unknown"}
Company: ${person.company ?? "unknown"}
Status: ${person.status}
Follow-ups so far: ${person.followUpCount}
Priority set by user: ${person.priority}/5
Has public email: ${Boolean(person.publicEmail)}

Output ONLY the sentence.`;

  const text = await callGroq(prompt, 80);
  return {
    score,
    reasoning: text?.trim() || `Rule-based score from priority (${person.priority}/5), status (${person.status}), and recency.`,
  };
}
