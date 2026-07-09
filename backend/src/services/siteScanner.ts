// Fetches a company's own public homepage — the same request any browser
// makes — looking for a contact page link or a public booking tool. This is
// the "no-reply escalation" step: only triggered manually per person, never
// in bulk, and only reads what the company already published for visitors.

const BOOKING_DOMAINS = [
  "calendly.com",
  "cal.com",
  "meetings.hubspot.com",
  "chilipiper.com",
  "app.chilipiper.com",
  "savvycal.com",
];

export interface SiteScanResult {
  contactPageUrl?: string;
  bookingUrl?: string;
}

export async function scanCompanySite(website: string): Promise<SiteScanResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(website, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; relationship-intel-bot/0.1)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return {};

    const html = await res.text();
    const hrefs = extractHrefs(html);
    const base = new URL(website);

    const bookingUrl = hrefs.find((href) => BOOKING_DOMAINS.some((d) => href.includes(d)));
    const contactHref = hrefs.find((href) => /contact/i.test(href));

    return {
      bookingUrl,
      contactPageUrl: contactHref ? resolveUrl(contactHref, base) : undefined,
    };
  } catch (err) {
    console.error("Site scan failed", err);
    return {};
  }
}

function extractHrefs(html: string): string[] {
  const matches = html.matchAll(/href=["']([^"']+)["']/gi);
  return Array.from(matches, (m) => m[1]);
}

function resolveUrl(href: string, base: URL): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}
