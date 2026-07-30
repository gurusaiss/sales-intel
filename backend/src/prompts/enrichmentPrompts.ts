export const ENRICHMENT_SYSTEM =
  "You are a precise research assistant building a sales intelligence profile. " +
  "Use ONLY facts present in the provided search results and page content. " +
  "Never invent names, titles, emails, funding figures, or dates that are not " +
  "actually present in the source material — omit a field entirely rather than " +
  "guessing. Return ONLY valid JSON, no markdown fences, no commentary.";

export function buildEnrichmentPrompt(params: {
  query: string;
  domain?: string;
  searchResults: { title: string; url: string; snippet: string }[];
  pageTitle?: string;
  pageMetaDescription?: string;
  pageText?: string;
}): string {
  const { query, domain, searchResults, pageTitle, pageMetaDescription, pageText } = params;

  const searchBlock = searchResults.length
    ? searchResults.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`).join("\n\n")
    : "(no search results found)";

  const pageBlock = pageText
    ? `PAGE TITLE: ${pageTitle ?? "(none)"}\nMETA DESCRIPTION: ${pageMetaDescription ?? "(none)"}\nPAGE CONTENT (truncated):\n${pageText.slice(0, 6000)}`
    : "(no page content scraped)";

  return `Research query: "${query}"${domain ? ` (domain: ${domain})` : ""}

Build a sales-intelligence profile as a JSON object with this exact shape (omit any field you cannot support with the source material below — do not fabricate):

{
  "person": {
    "name": "...",
    "title": "...",
    "company": "...",
    "location": "...",
    "publicEmail": "only if literally found in the sources",
    "emailConfidence": "high|medium|low|unverified",
    "socials": [{"platform": "LinkedIn", "url": "..."}],
    "bioSignals": ["notable real facts about this person from the sources — talks, posts, roles"]
  },
  "company": {
    "name": "...",
    "domain": "...",
    "website": "...",
    "description": "1-3 sentence real description grounded in the sources",
    "industry": "...",
    "employeeRange": "...",
    "founded": "...",
    "funding": {"stage": "...", "totalRaised": "...", "lastRoundDate": "...", "investors": ["..."]},
    "technologies": ["only if actually mentioned in the sources"],
    "socials": [{"platform": "...", "url": "..."}],
    "newsSignals": ["real recent facts/news found in the sources"]
  }
}

If the query is a person, focus on the "person" object and fill "company" with what's known about their employer. If the query is a company, set person.name to "Unknown — company search" and focus on "company".

SEARCH RESULTS:
${searchBlock}

SCRAPED PAGE (if a company site was resolved):
${pageBlock}`;
}
