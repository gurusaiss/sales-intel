import { callAI } from "./aiRouter";

export interface JobMatchResult {
  score: number;
  strengths: string[];
  gaps: string[];
  summary: string;
  /**
   * False when no AI provider is configured/reachable, so the UI can say so
   * instead of presenting a fabricated number as a real assessment.
   */
  aiAvailable: boolean;
}

export async function scoreJobMatch(resumeText: string, jobDescription: string): Promise<JobMatchResult> {
  const prompt = `You are evaluating how well a candidate's resume matches a job description. Be honest and specific — do not inflate the score to be encouraging.

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Respond in this exact format:
SCORE: <integer 0-100>
STRENGTHS: <2-4 bullet points, one per line, prefixed with "-">
GAPS: <2-4 bullet points, one per line, prefixed with "-">
SUMMARY: <2-sentence honest assessment>`;

  const text = await callAI(prompt, undefined, 500);
  if (text) {
    const parsed = parseJobMatch(text);
    if (parsed) return parsed;
  }
  return fallbackJobMatch();
}

function parseJobMatch(text: string): JobMatchResult | null {
  const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
  const strengthsMatch = text.match(/STRENGTHS:\s*([\s\S]*?)(?=GAPS:|$)/i);
  const gapsMatch = text.match(/GAPS:\s*([\s\S]*?)(?=SUMMARY:|$)/i);
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*)/i);

  if (!scoreMatch || !summaryMatch) return null;

  return {
    score: Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))),
    strengths: extractBullets(strengthsMatch?.[1]),
    gaps: extractBullets(gapsMatch?.[1]),
    summary: summaryMatch[1].trim(),
    aiAvailable: true,
  };
}

function extractBullets(text?: string): string[] {
  if (!text) return [];
  return text
    .split("\n")
    .map((line) => line.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

/**
 * No AI provider configured/reachable. Returns score 0 with aiAvailable:false
 * rather than the previous hardcoded 50 — a fabricated mid-range number reads
 * as a real assessment and is actively misleading. The UI keys off
 * aiAvailable to show an explanatory state instead of a score.
 */
function fallbackJobMatch(): JobMatchResult {
  return {
    score: 0,
    strengths: [],
    gaps: [],
    summary:
      "No AI provider is configured, so this resume/job comparison could not be scored. Add a GROQ_API_KEY (or OPENAI/ANTHROPIC/GEMINI key) on the backend to get a real assessment.",
    aiAvailable: false,
  };
}

export async function generateCoverLetter(
  resumeText: string,
  jobDescription: string,
  company: string,
  role: string
): Promise<string> {
  const prompt = `Write a personalized, honest cover letter (under 250 words) for this candidate applying to a specific role. Ground it in real details from the resume and job description — no generic filler sentences like "I am excited to apply."

COMPANY: ${company}
ROLE: ${role}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Output ONLY the cover letter body text, no subject line, no "Dear Hiring Manager" boilerplate unless it genuinely fits.`;

  const text = await callAI(prompt, undefined, 500);
  return (
    text ||
    `Dear Hiring Team at ${company},\n\nI'm interested in the ${role} position. [No AI provider configured — add a GROQ_API_KEY (or OPENAI/ANTHROPIC/GEMINI key) on the backend for a real, personalized cover letter grounded in your resume and this job description.]\n\nBest,\n[Your name]`
  );
}

export async function optimizeResume(resumeText: string, targetRole?: string): Promise<string> {
  const prompt = `Rewrite and improve this resume for clarity, impact, and ATS-friendliness. Keep every real fact (companies, dates, titles, metrics) unchanged — only improve wording, structure, and quantify achievements where the original already implies a number. Do not invent experience.${
    targetRole ? `\n\nOptimize phrasing toward this target role: ${targetRole}` : ""
  }

RESUME:
${resumeText}

Output ONLY the rewritten resume text.`;

  const text = await callAI(prompt, undefined, 900);
  return (
    text ||
    `[No AI provider configured — add a GROQ_API_KEY (or OPENAI/ANTHROPIC/GEMINI key) on the backend to get a real AI-rewritten version of your resume.]\n\n${resumeText}`
  );
}
