export const SUMMARIZER_SYSTEM = "You are a senior technology journalist and business analyst. Analyze news articles and extract structured intelligence. Return ONLY valid JSON, no markdown fences.";

export const SUMMARIZER_PROMPT = `Analyze this article and return ONLY a JSON object:

{
  "summary_short": "2 sentence summary",
  "summary_medium": "5 sentence summary with key facts",
  "summary_detailed": "2-3 paragraph detailed summary",
  "why_it_matters": "2 sentences on business/industry significance",
  "developer_impact": "1-2 sentences on technical impact",
  "startup_impact": "1-2 sentences on opportunity or risk for startups",
  "sales_opportunity": "1-2 sentences on sales/lead generation angle",
  "key_highlights": ["3-5 key facts as bullet points"],
  "action_items": ["3 specific actions a reader could take based on this"],
  "risks": ["1-3 risks or concerns from this news"],
  "related_companies": ["company names mentioned or implied"],
  "related_products": ["product/tool names mentioned"],
  "related_technologies": ["technology/framework/API names"],
  "important_links": [{"title": "...", "url": "..."}],
  "categories": ["2-4 from: AI, Tech, Startups, Cybersecurity, Cloud, DevOps, Web Dev, Data Science, Open Source, Funding, Engineering, Marketing, Sales"],
  "keywords": ["5-8 keywords"],
  "sentiment": "positive|negative|neutral|mixed"
}

Title: {{TITLE}}
URL: {{URL}}

Content:
{{CONTENT}}`;

export function buildSummarizerPrompt(title: string, url: string, content: string): string {
  return SUMMARIZER_PROMPT
    .replace("{{TITLE}}", title)
    .replace("{{URL}}", url)
    .replace("{{CONTENT}}", content.slice(0, 5000));
}
