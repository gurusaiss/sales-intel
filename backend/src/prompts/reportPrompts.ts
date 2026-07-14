export type ReportType = "daily" | "weekly" | "monthly" | "founder" | "developer" | "investor" | "ai" | "sales_digest";

export const REPORT_SYSTEM = "You are a professional tech analyst. Write clear, insightful reports based on the articles provided.";

export const REPORT_PROMPTS: Record<ReportType, { title: string; prompt: string; windowDays: number; articleLimit: number }> = {
  daily: {
    title: "Daily Tech Digest",
    windowDays: 1,
    articleLimit: 30,
    prompt: `Write a daily tech digest (400-600 words) with these 6 sections:
## Top Story
## Key Developments
## AI Watch
## Developer Spotlight
## Startup Pulse
## What to Watch Tomorrow

Based on these articles:
{articles}`,
  },
  weekly: {
    title: "Weekly Tech Report",
    windowDays: 7,
    articleLimit: 60,
    prompt: `Write a weekly tech report (600-900 words) with these 7 sections:
## Week in Review
## Biggest Stories
## AI & ML Developments
## Developer Tools & Open Source
## Startup & Funding News
## Security Roundup
## Emerging Trends

Based on these articles:
{articles}`,
  },
  monthly: {
    title: "Monthly Tech Intelligence Report",
    windowDays: 30,
    articleLimit: 100,
    prompt: `Write a monthly tech intelligence report (800-1200 words) with these 7 sections:
## Executive Summary
## Major Themes This Month
## AI & Machine Learning Progress
## Infrastructure & Developer Tools
## Startup Ecosystem
## Cybersecurity Landscape
## Looking Ahead

Based on these articles:
{articles}`,
  },
  founder: {
    title: "Founder Brief",
    windowDays: 7,
    articleLimit: 40,
    prompt: `Write a founder-focused brief (400-500 words) with these 5 sections:
## What Founders Need to Know
## Market Signals
## Funding & Competition
## Tech to Watch
## 3 Concrete Action Items

Based on these articles:
{articles}`,
  },
  developer: {
    title: "Developer Brief",
    windowDays: 7,
    articleLimit: 40,
    prompt: `Write a developer-focused brief (350-500 words) with these 6 sections:
## New Tools & Frameworks Released
## Open Source Highlights
## AI Tools for Developers
## Security Advisories
## Best Reads This Week
## What to Build With

Based on these articles:
{articles}`,
  },
  investor: {
    title: "Investor Brief",
    windowDays: 7,
    articleLimit: 40,
    prompt: `Write an investor-focused brief (400-500 words) with these 6 sections:
## Market Signals
## Notable Funding Rounds
## Sector Movements
## Technology Bets
## Risks to Watch
## Opportunities

Based on these articles:
{articles}`,
  },
  ai: {
    title: "AI Intelligence Brief",
    windowDays: 7,
    articleLimit: 40,
    prompt: `Write an AI-focused brief (400-500 words) covering:
## Biggest AI Releases This Week
## Research Breakthroughs
## Enterprise AI Adoption
## Open Source AI
## AI Safety & Policy
## What's Coming Next

Based on these articles:
{articles}`,
  },
  sales_digest: {
    title: "Sales Intelligence Digest",
    windowDays: 7,
    articleLimit: 40,
    prompt: `Write a sales intelligence digest (400-500 words) for B2B sales professionals. Focus on:
## Companies to Watch (funding, hiring, product launches)
## Market Signals for Outreach
## Technology Adoption Trends
## Competitor Moves
## Best Outreach Timing Signals
## This Week's Conversation Starters

Based on these articles:
{articles}`,
  },
};
