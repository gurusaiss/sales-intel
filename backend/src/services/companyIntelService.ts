/**
 * Company Intelligence Service — port of CompanyIQ's groq_service.py
 *
 * Instead of GROQ's built-in browser_search tool, we use our own
 * webSearch (DuckDuckGo) + webScraper pipeline to gather live context,
 * then feed it to callAI for the 13-section analysis.
 */

import { callAI } from "./aiRouter";
import { webSearch } from "./webSearch";
import { scrape } from "./webScraper";

const SYSTEM = `You are an expert career intelligence analyst. You research companies deeply and provide structured, honest intelligence to help candidates prepare for job applications and interviews.

Your analysis is always:
- Grounded in real, verifiable facts from the provided research data
- Honest about risks and red flags — never sugar-coat
- Specific and actionable, not generic
- Written in clear professional prose

Return your response as a valid JSON object with exactly these keys:
overview, founders, originStory, challenges, productsProjects, roadmap, competitive, struggles, interviewQuestions, culture, redFlags, applicationStrategy, candidateFit

interviewQuestions must be a JSON array of 8-10 strings (the actual question text).
All other fields are strings (prose paragraphs).`;

function buildPrompt(companyName: string, resumeText: string, searchContext: string): string {
  return `Analyze "${companyName}" as a company intelligence analyst. Use the research data below to produce a comprehensive 13-section intelligence report.

RESEARCH DATA (live web search results):
${searchContext}

CANDIDATE RESUME:
${resumeText.slice(0, 3000)}

Produce a JSON object with these exact keys and content:

1. "overview" — Company description, what they do, industry, size, HQ, funding stage, key metrics
2. "founders" — Founders and current leadership, their backgrounds, LinkedIn presence, notable achievements
3. "originStory" — How and why the company was founded, key growth milestones and timeline
4. "challenges" — Major past challenges, controversies, failures — and how they were resolved
5. "productsProjects" — Current products/services, key features, recent launches, what they're building now
6. "roadmap" — Public roadmap, hiring signals, expansion plans, future direction
7. "competitive" — Who are the main competitors, how does this company differentiate, market position
8. "struggles" — Areas where the company still struggles: tech debt, market positioning, competition threats
9. "interviewQuestions" — Array of 8-10 specific, realistic interview questions likely to be asked (company-specific, not generic)
10. "culture" — Work environment, values, Glassdoor sentiment, remote/hybrid policy, engineering culture
11. "redFlags" — Honest assessment: layoffs, poor reviews, leadership turnover, financial instability, anything concerning
12. "applicationStrategy" — Insider tips on how to apply, what the hiring team looks for, referral importance, resume keywords to use
13. "candidateFit" — Honest assessment of how well this candidate's resume aligns with this company's needs and culture

Return ONLY valid JSON. No markdown fences, no preamble.`;
}

async function gatherResearch(companyName: string): Promise<string> {
  const queries = [
    `${companyName} company overview funding employees`,
    `${companyName} founders CEO leadership team`,
    `${companyName} products services recent news 2024 2025`,
    `${companyName} glassdoor reviews culture work environment`,
    `${companyName} interview questions hiring process`,
  ];

  const parts: string[] = [];

  // Run searches in parallel
  const results = await Promise.allSettled(queries.map((q) => webSearch(q, 3)));

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status !== "fulfilled") continue;
    parts.push(`\n--- Search: "${queries[i]}" ---`);
    for (const hit of r.value) {
      parts.push(`${hit.title}\n${hit.snippet}\n${hit.url}`);
    }
  }

  // Scrape the top result from the first search (company's main site or overview)
  const firstSearch = results[0];
  if (firstSearch.status === "fulfilled" && firstSearch.value.length > 0) {
    try {
      const topUrl = firstSearch.value[0].url;
      const scraped = await scrape(topUrl);
      if (scraped?.text && scraped.text.length > 100) {
        parts.push(`\n--- Scraped page: ${topUrl} ---\n${scraped.text.slice(0, 2000)}`);
      }
    } catch {
      // scraping is best-effort
    }
  }

  return parts.join("\n") || `Company: ${companyName} (no search results — use general knowledge)`;
}

export async function generateCompanyIntelReport(
  companyName: string,
  resumeText: string
): Promise<import("./companyIntelStore").CIQReport | null> {
  const searchContext = await gatherResearch(companyName);
  const prompt = buildPrompt(companyName, resumeText, searchContext);

  const raw = await callAI(prompt, SYSTEM, 4000);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as import("./companyIntelStore").CIQReport;
    return parsed;
  } catch {
    // Try to extract JSON from response
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as import("./companyIntelStore").CIQReport;
      } catch { /* fall through */ }
    }
    // Return raw text so user gets something
    return { raw };
  }
}

export async function generateCoverLetterCIQ(
  companyName: string,
  role: string,
  resumeText: string,
  jobDescription?: string
): Promise<string> {
  const prompt = `Write a personalised, professional cover letter (280–340 words) for this candidate applying to ${companyName} for the ${role} role.

Rules:
- Open with a specific hook about why this company, not "I am excited to apply"
- Reference 2–3 concrete skills or achievements from the resume
- Tie the candidate's background directly to the role requirements
- Mention something specific about ${companyName} (product, mission, recent news)
- Close with a confident CTA, not apologetic language
- Output ONLY the letter body — no subject line, no "Dear Hiring Manager" unless it fits naturally

RESUME:
${resumeText.slice(0, 2500)}

${jobDescription ? `JOB DESCRIPTION:\n${jobDescription.slice(0, 1500)}` : ""}`;

  const text = await callAI(prompt, undefined, 600);
  return text || `[Cover letter generation failed — add a GROQ_API_KEY or other AI provider key to the backend to enable this feature.]\n\nCompany: ${companyName}\nRole: ${role}`;
}

export async function analyzeJobDescription(
  resumeText: string,
  jobDescription: string,
  companyName?: string
): Promise<{
  fitScore: number;
  atsScore: number;
  verdict: string;
  matchedSkills: string[];
  missingSkills: string[];
  keywordGaps: string[];
  tailoredPitch: string;
  resumeAdvice: string;
  interviewFocus: string[];
} | null> {
  const prompt = `Analyze how well this resume matches the job description. Be honest and specific.

RESUME:
${resumeText.slice(0, 2500)}

JOB DESCRIPTION${companyName ? ` (${companyName})` : ""}:
${jobDescription.slice(0, 2000)}

Return a JSON object with these exact keys:
- fitScore: integer 0-100 (overall candidate-job fit)
- atsScore: integer 0-100 (ATS keyword match likelihood)
- verdict: one of "Strong Match" | "Good Match" | "Partial Match" | "Weak Match"
- matchedSkills: array of skills/qualifications the candidate has that the JD requires
- missingSkills: array of required skills the candidate lacks
- keywordGaps: array of JD keywords missing from the resume that should be added
- tailoredPitch: 2-sentence pitch the candidate should use in cover letter/interview
- resumeAdvice: specific advice on what to add/change in the resume for this application
- interviewFocus: array of 4-6 topics the candidate should prep for given this JD

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, undefined, 800);
  if (!raw) return null;
  try {
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    return null;
  }
}

export async function compareCompanies(
  company1: string,
  company2: string,
  resumeText: string
): Promise<{
  company1Score: number;
  company2Score: number;
  winner: string;
  company1Pros: string[];
  company1Cons: string[];
  company2Pros: string[];
  company2Cons: string[];
  cultureFit1: string;
  cultureFit2: string;
  compEstimate1: string;
  compEstimate2: string;
  growthOutlook1: string;
  growthOutlook2: string;
  verdict: string;
} | null> {
  const prompt = `Compare these two companies as potential employers for this candidate.

COMPANY 1: ${company1}
COMPANY 2: ${company2}

CANDIDATE RESUME:
${resumeText.slice(0, 2000)}

Provide a head-to-head comparison. Return a JSON object with:
- company1Score: integer 0-100 (fit score for candidate)
- company2Score: integer 0-100
- winner: name of the better choice for this candidate
- company1Pros: array of 3-4 pros of company 1 for this candidate
- company1Cons: array of 3-4 cons
- company2Pros: array of 3-4 pros of company 2
- company2Cons: array of 3-4 cons
- cultureFit1: 1-sentence culture fit assessment for company 1
- cultureFit2: 1-sentence culture fit assessment for company 2
- compEstimate1: salary estimate for company 1 (e.g. "₹18–24 LPA" or "$120–150k")
- compEstimate2: salary estimate for company 2
- growthOutlook1: 1-sentence growth/career trajectory assessment for company 1
- growthOutlook2: 1-sentence growth/career trajectory assessment for company 2
- verdict: 2-sentence honest final recommendation

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, undefined, 800);
  if (!raw) return null;
  try {
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    return null;
  }
}

export async function getSalaryIntelligence(
  role: string,
  companyName: string,
  resumeText: string,
  location?: string
): Promise<{
  baseLow: string;
  baseHigh: string;
  totalLow: string;
  totalHigh: string;
  level: string;
  breakdown: string;
  negotiationTips: string[];
  confidenceLevel: string;
  sources: string[];
} | null> {
  const prompt = `Estimate the compensation for this candidate applying to ${companyName} for the ${role} role${location ? ` in ${location}` : ""}.

CANDIDATE RESUME:
${resumeText.slice(0, 1500)}

Use your knowledge of market rates (Levels.fyi, Glassdoor, industry benchmarks) to provide realistic estimates.

Return a JSON object with:
- baseLow: lower bound of base salary (e.g. "₹15 LPA" or "$120,000")
- baseHigh: upper bound of base salary
- totalLow: lower bound of total comp (with bonuses/equity)
- totalHigh: upper bound of total comp
- level: estimated seniority level (e.g. "Mid-level SDE", "Senior Engineer", "L4")
- breakdown: paragraph explaining the comp structure at this company for this role
- negotiationTips: array of 4-5 specific, actionable negotiation tips for this situation
- confidenceLevel: "High" | "Medium" | "Low" with a reason
- sources: array of data sources referenced (e.g. "Glassdoor", "Levels.fyi", "AmbitionBox")

Return ONLY valid JSON.`;

  const raw = await callAI(prompt, undefined, 700);
  if (!raw) return null;
  try {
    return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? raw);
  } catch {
    return null;
  }
}
