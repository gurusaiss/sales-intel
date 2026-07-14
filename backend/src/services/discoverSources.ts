export interface DiscoverFeed {
  url: string;
  source: string;
  category: string;
  type: "ai_release" | "oss" | "startup" | "dev_tool" | "sdk" | "api" | "other";
}

export const DISCOVER_FEEDS: DiscoverFeed[] = [
  { url: "https://www.producthunt.com/feed", source: "Product Hunt", category: "SaaS", type: "startup" },
  { url: "https://hnrss.org/show", source: "Show HN", category: "Open Source", type: "oss" },
  { url: "https://hnrss.org/newest?q=Show+HN+API", source: "Show HN API", category: "APIs", type: "api" },
  { url: "https://dev.to/feed/tag/showdev", source: "Dev.to ShowDev", category: "Developer Tools", type: "dev_tool" },
  { url: "https://dev.to/feed/tag/opensource", source: "Dev.to Open Source", category: "Open Source", type: "oss" },
  { url: "https://hnrss.org/newest?q=Show+HN+chrome+extension", source: "Chrome Extensions HN", category: "Extensions", type: "dev_tool" },
  { url: "https://dev.to/feed/tag/ai", source: "Dev.to AI", category: "AI Tools", type: "ai_release" },
  { url: "https://hnrss.org/newest?q=Show+HN+no-code", source: "No-Code HN", category: "No-Code", type: "dev_tool" },
  { url: "https://hnrss.org/newest?q=Show+HN+SaaS", source: "Show HN SaaS", category: "SaaS", type: "startup" },
];

export function extractGithubUrl(text: string): string | undefined {
  const m = text.match(/https?:\/\/github\.com\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+/i);
  return m?.[0];
}

export function inferIsOpenSource(url: string, description: string): boolean {
  if (url.includes("github.com")) return true;
  const lower = (url + " " + description).toLowerCase();
  return lower.includes("open source") || lower.includes("open-source") || lower.includes("mit license");
}
