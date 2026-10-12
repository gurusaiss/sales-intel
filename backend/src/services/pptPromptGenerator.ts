import type { CIQReport } from "./companyIntelStore";

/** Port of CompanyIQ's ppt_prompt_generator.py — generates a Gamma/ChatGPT mega-prompt for a 20-slide deck */
export function generatePptPrompt(companyName: string, report: CIQReport): string {
  const iq = report.interviewQuestions ?? [];

  const lines: string[] = [];
  lines.push(`Create a professional 20-slide presentation about ${companyName} for a job candidate preparing for interviews and evaluating this company as a potential employer.`);
  lines.push("");
  lines.push("=== DESIGN SPECIFICATIONS ===");
  lines.push("- Color palette: Navy blue (#0A1628) primary, Gold (#C9A84C) accent, White text on dark slides");
  lines.push("- Typography: Clean sans-serif (Inter or Helvetica Neue), 24-32pt headings, 16-18pt body");
  lines.push("- Layout: 16:9 widescreen, minimal text per slide (max 5 bullet points), high visual hierarchy");
  lines.push("- Include: company logo placeholder on cover, section divider slides, data visualizations where appropriate");
  lines.push("");
  lines.push("=== SLIDE CONTENT ===");
  lines.push("");

  const slides = [
    {
      num: 1,
      title: "Cover Slide",
      content: `Title: "${companyName} — Company Intelligence Brief"\nSubtitle: "Candidate Research & Interview Preparation"\nInclude: Date, candidate name placeholder`,
    },
    {
      num: 2,
      title: "Company Overview",
      content: report.overview || "Provide a concise company overview: what they do, industry, size, funding, HQ location.",
    },
    {
      num: 3,
      title: "Founders & Leadership",
      content: report.founders || "Key founders and C-suite leaders, their backgrounds and notable achievements.",
    },
    {
      num: 4,
      title: "Origin Story",
      content: report.originStory || "How and why the company was founded. Key origin milestones.",
    },
    {
      num: 5,
      title: "Growth Timeline",
      content: "Create a visual timeline showing key milestones from founding to present based on: " + (report.originStory || companyName),
    },
    {
      num: 6,
      title: "Products & Services",
      content: report.productsProjects || "Core products and services, recent launches, key features.",
    },
    {
      num: 7,
      title: "Current Projects & Initiatives",
      content: report.productsProjects || "What the company is actively building or launching right now.",
    },
    {
      num: 8,
      title: "Future Roadmap",
      content: report.roadmap || "Public roadmap, hiring signals, expansion plans, future direction.",
    },
    {
      num: 9,
      title: "Competitive Landscape",
      content: report.competitive || "Main competitors, market positioning, key differentiators. Include a simple comparison table.",
    },
    {
      num: 10,
      title: "Past Challenges & How They Were Overcome",
      content: report.challenges || "Major obstacles, controversies, or failures — and how leadership responded.",
    },
    {
      num: 11,
      title: "Ongoing Challenges",
      content: report.struggles || "Areas where the company still faces difficulty: tech debt, market pressure, competition.",
    },
    {
      num: 12,
      title: "Culture & Work Environment",
      content: report.culture || "Work culture, values, remote/hybrid policy, Glassdoor sentiment, engineering culture.",
    },
    {
      num: 13,
      title: "Red Flags to Watch",
      content: report.redFlags || "Honest red flags: layoffs, poor leadership reviews, financial instability, anything concerning.",
    },
    {
      num: 14,
      title: "Application Strategy",
      content: report.applicationStrategy || "How to apply effectively, what the hiring team looks for, resume keywords, referral importance.",
    },
    {
      num: 15,
      title: "Candidate Fit Assessment",
      content: report.candidateFit || "How well does this candidate align with the company's needs and culture?",
    },
    {
      num: 16,
      title: "Interview Questions — Part 1",
      content: iq.length >= 4
        ? `Prepare answers for:\n${iq.slice(0, 4).map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "List the top 4 likely interview questions for this company.",
    },
    {
      num: 17,
      title: "Interview Questions — Part 2",
      content: iq.length >= 8
        ? `Prepare answers for:\n${iq.slice(4, 8).map((q, i) => `${i + 5}. ${q}`).join("\n")}`
        : "List the next 4 likely interview questions for this company.",
    },
    {
      num: 18,
      title: "Questions to Ask the Interviewer",
      content: `Prepare 4-5 smart questions that demonstrate deep research into ${companyName}. Base on: roadmap, culture, and current challenges above.`,
    },
    {
      num: 19,
      title: "Success Stories",
      content: report.struggles || `Key wins and turning points at ${companyName}. Challenges turned into competitive advantages.`,
    },
    {
      num: 20,
      title: "Summary & Next Steps",
      content: `Summary of key insights about ${companyName}.\nAction items: Application checklist, resume tailoring notes, follow-up plan.\nFinal verdict: Should this candidate apply? (based on Candidate Fit slide)`,
    },
  ];

  slides.forEach((slide) => {
    lines.push(`--- SLIDE ${slide.num}: ${slide.title} ---`);
    lines.push(slide.content.trim());
    lines.push("");
  });

  lines.push("=== TOOL-SPECIFIC INSTRUCTIONS ===");
  lines.push("");
  lines.push("FOR GAMMA (gamma.app):");
  lines.push('Paste this entire prompt into Gamma\'s "Create with AI" input. Select "Presentation" template. Use the navy/gold color theme.');
  lines.push("");
  lines.push("FOR CHATGPT / CLAUDE:");
  lines.push('Say: "Create a PowerPoint presentation outline based on the following content. Format each slide with a title, 3-5 bullet points, and speaker notes."');
  lines.push("");
  lines.push("FOR GOOGLE SLIDES:");
  lines.push("Use this outline with the Google Slides template. Copy slide content manually or use the Duet AI assistant.");
  lines.push("");
  lines.push("FOR BEAUTIFUL.AI:");
  lines.push("Use the Smart Slide feature and paste each slide's content block into the AI input for that slide.");

  return lines.join("\n");
}
