export const TREND_SYSTEM = "You are a technology trend analyst. Return ONLY valid JSON.";

export const TREND_FROM_ARTICLES_PROMPT = `Analyze these recent article titles and identify the top 8 trending technology topics.

Articles:
{titles}

Return JSON only:
{
  "trends": [
    {
      "name": "Technology/Topic Name",
      "category": "AI|Cloud|Security|DevOps|Web Dev|Data|Open Source|Startup|Other",
      "description": "2-sentence description of this trend",
      "trend_score": 0-100,
      "growth_score": 0-100,
      "virality_score": 0-100,
      "adoption_score": 0-100,
      "future_score": 0-100
    }
  ]
}
`;

export function buildTrendPrompt(titles: string[]): string {
  return TREND_FROM_ARTICLES_PROMPT.replace("{titles}", titles.map((t, i) => `${i + 1}. ${t}`).join("\n"));
}
