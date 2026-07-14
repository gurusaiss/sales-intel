export const ANALYSIS_SYSTEM = "You are an expert business intelligence analyst. Analyze website content and extract comprehensive business insights. Return ONLY valid JSON, no markdown fences, no code blocks, no explanation.";

export const ANALYSIS_PROMPT = `Analyze this website. Return ONLY a JSON object with these exact fields (omit fields you cannot determine, never hallucinate):

{
  "company_name": "...",
  "brand": "...",
  "tagline": "...",
  "executive_summary": "3-4 sentence overview",
  "website_purpose": "landing|saas|ecommerce|blog|portfolio|docs|corporate|marketplace",
  "industry": "...",
  "category": "...",
  "sub_category": "...",
  "niche": "...",
  "description": "3-5 sentence company description",
  "about": "mission/about content",
  "mission": "...",
  "vision": "...",
  "headquarters": "City, Country",
  "founded": "year",
  "team_size": "1-10|11-50|51-200|201-500|501-1000|1000+",
  "employee_count": "specific number if found",
  "target_customers": "who they serve",
  "business_model": "SaaS|marketplace|ecommerce|advertising|services|open_source|freemium",
  "pricing_model": "free|freemium|subscription|one_time|enterprise|usage_based",
  "icp": "Ideal Customer Profile",
  "products": ["list of main products"],
  "services": ["list of main services"],
  "product_features": ["top 5-8 features"],
  "competitive_advantages": ["top 3-5 advantages"],
  "has_pricing_page": true,
  "has_careers_page": false,
  "has_blog": true,
  "has_docs": false,
  "has_integrations_page": false,
  "has_free_trial": false,
  "pricing_tiers": [{"name": "Pro", "price": "$49/mo", "features": ["feature1"]}],
  "integrations": ["Slack", "Zapier"],
  "keywords": ["top 10 SEO keywords"],
  "seo_opportunities": ["3-5 keyword gaps"],
  "seo_score_estimate": "poor|fair|good|excellent",
  "social_channels": [{"platform": "twitter", "url": "https://twitter.com/..."}],
  "social_presence_strength": "weak|moderate|strong",
  "competitor_domains": ["up to 5 competitor domains"],
  "market_position": "leader|challenger|niche|emerging",
  "tech_maturity": "early|growing|mature|enterprise",
  "investor_summary": "2-3 sentence investment perspective",
  "developer_summary": "2-3 sentence developer perspective",
  "founder_summary": "2-3 sentence founder/competitive perspective",
  "sales_hook": "One powerful sentence for a sales opener"
}

URL: {{URL}}
Page Title: {{TITLE}}
Meta Description: {{META_DESCRIPTION}}

WEBSITE CONTENT:
{{CONTENT}}`;

export function buildAnalysisPrompt(url: string, title: string | undefined, metaDescription: string, content: string): string {
  return ANALYSIS_PROMPT
    .replace("{{URL}}", url)
    .replace("{{TITLE}}", title ?? "(not found)")
    .replace("{{META_DESCRIPTION}}", metaDescription ?? "(not found)")
    .replace("{{CONTENT}}", content.slice(0, 8000));
}
