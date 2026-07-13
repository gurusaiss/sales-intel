/**
 * Tech stack detector — logic ported from TechIntel AI (Projects/scrap).
 * Fetches a company's website and detects frameworks, analytics, hosting, etc.
 * from HTML content and response headers using regex signature matching.
 *
 * Self-contained: no runtime dependency on TechIntel being deployed.
 */

export interface TechStackResult {
  frontend: string[];
  backend: string[];
  cms: string[];
  analytics: string[];
  marketing: string[];
  cdn: string[];
  security: string[];
  hosting: string[];
  other: string[];
}

// [category, name, patterns[]]
const SIGNATURES: Array<[keyof TechStackResult, string, string[]]> = [
  // Frontend
  ["frontend", "React", ["react(?:\\.min)?\\.js", "__REACT_DEVTOOLS", "data-reactroot", "_reactFiber"]],
  ["frontend", "Next.js", ["__NEXT_DATA__", "/_next/static", "next/dist"]],
  ["frontend", "Vue.js", ["vue(?:\\.min)?\\.js", "__vue__", "data-v-"]],
  ["frontend", "Nuxt.js", ["__NUXT__", "/_nuxt/"]],
  ["frontend", "Angular", ["ng-version=", "angular(?:\\.min)?\\.js", "ng-app="]],
  ["frontend", "Svelte", ["__svelte", "svelte-"]],
  ["frontend", "Astro", ["astro-island", "/@astro/"]],
  ["frontend", "Remix", ["__remixContext", "/@remix-run/"]],
  ["frontend", "Gatsby", ["gatsby-", "___gatsby"]],
  ["frontend", "Alpine.js", ["x-data=", "alpine\\.js"]],
  ["frontend", "jQuery", ["jquery(?:\\.min)?\\.js", "jQuery\\("]],
  ["frontend", "Tailwind CSS", ["tailwindcss", 'class="[^"]*(?:tw-|text-\\w+-\\d{3})']],
  ["frontend", "Bootstrap", ["bootstrap(?:\\.min)?\\.css", "bootstrap(?:\\.min)?\\.js"]],
  // CMS
  ["cms", "WordPress", ["/wp-content/", "/wp-includes/", "wp-json"]],
  ["cms", "Ghost", ["ghost\\.io", "/ghost/api/"]],
  ["cms", "Webflow", ["webflow\\.com", "Webflow\\."]],
  ["cms", "Shopify", ["cdn\\.shopify\\.com", "Shopify\\."]],
  ["cms", "Squarespace", ["squarespace\\.com", "sqs-video"]],
  ["cms", "Wix", ["wix\\.com", "wixsite\\.com"]],
  ["cms", "Contentful", ["contentful\\.com", "ctfassets\\.net"]],
  ["cms", "Sanity", ["sanity\\.io"]],
  ["cms", "Framer", ["framer\\.com", "framerusercontent"]],
  // Analytics
  ["analytics", "Google Analytics", ["google-analytics\\.com/analytics\\.js", "gtag\\(", "UA-\\d+-\\d+"]],
  ["analytics", "Google Tag Manager", ["googletagmanager\\.com/gtm\\.js", "GTM-[A-Z0-9]+"]],
  ["analytics", "Segment", ["cdn\\.segment\\.com", "analytics\\.identify"]],
  ["analytics", "Mixpanel", ["mixpanel\\.com/lib", "mixpanel\\.init"]],
  ["analytics", "PostHog", ["posthog\\.com", "posthog\\.init"]],
  ["analytics", "Plausible", ["plausible\\.io"]],
  ["analytics", "Hotjar", ["hotjar\\.com", "hjid:"]],
  ["analytics", "Amplitude", ["amplitude\\.com", "amplitude\\.init"]],
  // CDN
  ["cdn", "Cloudflare", ["cloudflare\\.com", "cf-ray", "__cf_bm"]],
  ["cdn", "Fastly", ["fastly\\.net"]],
  ["cdn", "Vercel", ["vercel\\.app", "x-vercel-", "_vercel"]],
  ["cdn", "Netlify", ["netlify\\.app", "netlify\\.com"]],
  ["cdn", "AWS CloudFront", ["cloudfront\\.net"]],
  // Marketing / support
  ["marketing", "Intercom", ["intercom\\.io", "intercomSettings"]],
  ["marketing", "HubSpot", ["hubspot\\.com", "hs-scripts"]],
  ["marketing", "Zendesk", ["zendesk\\.com", "zdassets\\.com"]],
  ["marketing", "Drift", ["drift\\.com", "driftt\\.com"]],
  ["marketing", "Crisp", ["crisp\\.chat"]],
  ["marketing", "Stripe", ["js\\.stripe\\.com"]],
  ["marketing", "Paddle", ["paddle\\.com"]],
  // Hosting / infra
  ["hosting", "Vercel", ["x-vercel-id", "server: vercel"]],
  ["hosting", "AWS", ["amazonaws\\.com", "x-amz-"]],
  ["hosting", "Heroku", ["heroku"]],
  ["hosting", "Render", ["onrender\\.com"]],
  ["hosting", "Railway", ["railway\\.app"]],
  // Security
  ["security", "reCAPTCHA", ["recaptcha\\.net", "google\\.com/recaptcha"]],
  ["security", "Cloudflare Turnstile", ["challenges\\.cloudflare\\.com"]],
  ["security", "hCaptcha", ["hcaptcha\\.com"]],
];

function detect(html: string, headers: Record<string, string>): TechStackResult {
  const result: TechStackResult = {
    frontend: [], backend: [], cms: [], analytics: [],
    marketing: [], cdn: [], security: [], hosting: [], other: [],
  };
  const combined = (html + "\n" + Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join("\n")).toLowerCase();
  const seen = new Set<string>();

  for (const [category, name, patterns] of SIGNATURES) {
    if (seen.has(name)) continue;
    for (const pattern of patterns) {
      if (new RegExp(pattern, "i").test(combined)) {
        seen.add(name);
        result[category].push(name);
        break;
      }
    }
  }
  return result;
}

export async function detectTechStack(domain: string): Promise<TechStackResult | null> {
  const url = domain.startsWith("http") ? domain : `https://${domain}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; SalesIntel/1.0)" },
      redirect: "follow",
    });
    const html = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => { headers[key] = value; });
    return detect(html, headers);
  } catch {
    return null;
  }
}

export function flattenTechStack(stack: TechStackResult): string[] {
  return [
    ...stack.frontend, ...stack.backend, ...stack.cms,
    ...stack.analytics, ...stack.marketing, ...stack.cdn,
    ...stack.hosting, ...stack.security, ...stack.other,
  ];
}
