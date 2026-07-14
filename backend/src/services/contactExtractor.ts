export interface ExtractedContacts {
  emails: EmailContact[];
  phones: PhoneContact[];
  socialLinks: SocialLink[];
  bookingLinks: BookingLink[];
  contactPages: string[];
  allExternalUrls: string[];
}

export interface EmailContact {
  email: string;
  type: "support" | "sales" | "hr" | "founder" | "press" | "info" | "general";
  context: string;
}

export interface PhoneContact {
  number: string;
  type: "mobile" | "office" | "tollfree" | "general";
  raw: string;
}

export interface SocialLink {
  platform: string;
  url: string;
  username?: string;
}

export interface BookingLink {
  platform: "calendly" | "cal" | "zoom" | "google_meet" | "teams" | "other";
  url: string;
}

const EMAIL_TYPE_KEYWORDS: Record<string, string[]> = {
  sales: ["sales", "revenue", "business", "commercial", "bd"],
  support: ["support", "help", "customer", "care", "service"],
  hr: ["hr", "human", "careers", "recruit", "jobs", "hiring", "talent"],
  founder: ["founder", "ceo", "cto", "coo", "vp", "director", "chief"],
  press: ["press", "media", "pr", "communications"],
  info: ["info", "contact", "hello", "hi", "hey", "general"],
};

function classifyEmail(email: string, context: string): EmailContact["type"] {
  const lower = (email + " " + context).toLowerCase();
  for (const [type, keywords] of Object.entries(EMAIL_TYPE_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) return type as EmailContact["type"];
  }
  return "general";
}

const SOCIAL_PATTERNS: Array<{ platform: string; re: RegExp }> = [
  { platform: "linkedin", re: /linkedin\.com\/(company|in|school)\/[^"'\s><]+/gi },
  { platform: "twitter", re: /(?:twitter\.com|x\.com)\/(?!intent)[^"'\s></?]+/gi },
  { platform: "github", re: /github\.com\/(?!blog|features|pricing|about)[^"'\s></?]+(?:\/[^"'\s></?]+)?/gi },
  { platform: "facebook", re: /facebook\.com\/(?!sharer|share|dialog)[^"'\s></?]+/gi },
  { platform: "instagram", re: /instagram\.com\/[^"'\s></?]+/gi },
  { platform: "youtube", re: /youtube\.com\/(?:channel|c|user|@)[^"'\s></?]+/gi },
  { platform: "medium", re: /medium\.com\/@?[^"'\s></?]+/gi },
  { platform: "producthunt", re: /producthunt\.com\/(?:posts|products)\/[^"'\s></?]+/gi },
  { platform: "crunchbase", re: /crunchbase\.com\/(?:organization|person)\/[^"'\s></?]+/gi },
  { platform: "angellist", re: /(?:angel\.co|wellfound\.com)\/[^"'\s></?]+/gi },
  { platform: "discord", re: /discord\.(?:com|gg)\/(?:invite\/)?[^"'\s></?]+/gi },
  { platform: "telegram", re: /t\.me\/[^"'\s></?]+/gi },
  { platform: "reddit", re: /reddit\.com\/r\/[^"'\s></?]+/gi },
  { platform: "dribbble", re: /dribbble\.com\/[^"'\s></?]+/gi },
  { platform: "behance", re: /behance\.net\/[^"'\s></?]+/gi },
];

const BOOKING_PATTERNS: Array<{ platform: BookingLink["platform"]; re: RegExp }> = [
  { platform: "calendly", re: /calendly\.com\/[^"'\s><]+/gi },
  { platform: "cal", re: /cal\.com\/[^"'\s><]+/gi },
  { platform: "zoom", re: /zoom\.us\/(?:j|meeting)\/[^"'\s><]+/gi },
  { platform: "google_meet", re: /meet\.google\.com\/[^"'\s><]+/gi },
  { platform: "teams", re: /teams\.microsoft\.com\/l\/meetup[^"'\s><]+/gi },
];

function dedupeStr(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((u) => { const k = u.toLowerCase().replace(/\/+$/, ""); if (seen.has(k)) return false; seen.add(k); return true; });
}

export function extractContacts(html: string, baseUrl: string): ExtractedContacts {
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");

  // Emails
  const emailSet = new Set<string>();
  const emails: EmailContact[] = [];
  const emailRe = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g;
  let em: RegExpExecArray | null;
  while ((em = emailRe.exec(clean)) !== null) {
    const e = em[1].toLowerCase();
    if (emailSet.has(e)) continue;
    if (/\.(png|jpg|gif|svg|woff|css|js)$/i.test(e)) continue;
    emailSet.add(e);
    const ctx = clean.slice(Math.max(0, em.index - 80), em.index).replace(/<[^>]+>/g, " ").trim().slice(-60);
    emails.push({ email: e, type: classifyEmail(e, ctx), context: ctx });
  }
  // mailto links
  const mailtoRe = /mailto:([^"'?\s]+)/gi;
  let mt: RegExpExecArray | null;
  while ((mt = mailtoRe.exec(clean)) !== null) {
    const e = mt[1].toLowerCase();
    if (!emailSet.has(e)) { emailSet.add(e); emails.push({ email: e, type: classifyEmail(e, "mailto"), context: "mailto link" }); }
  }

  // Phones
  const phoneSet = new Set<string>();
  const phones: PhoneContact[] = [];
  const phoneRe = /(?:\+?1[\s.-]?)?(?:\(?[0-9]{3}\)?[\s.-]?)[0-9]{3}[\s.-][0-9]{4}/g;
  let ph: RegExpExecArray | null;
  while ((ph = phoneRe.exec(clean)) !== null) {
    const raw = ph[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 10 || phoneSet.has(digits)) continue;
    phoneSet.add(digits);
    const isTollfree = /(?:800|888|877|866|855|844|833)/.test(digits.slice(-10, -7));
    phones.push({ number: "+" + digits, type: isTollfree ? "tollfree" : "office", raw });
  }

  // Social links
  const socialSet = new Set<string>();
  const socialLinks: SocialLink[] = [];
  for (const { platform, re } of SOCIAL_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      const url = m[0].startsWith("http") ? m[0] : "https://" + m[0];
      const key = url.toLowerCase().replace(/\/+$/, "");
      if (socialSet.has(key)) continue;
      socialSet.add(key);
      socialLinks.push({ platform, url, username: url.split("/").filter(Boolean).pop() });
    }
  }

  // Booking links
  const bookingSet = new Set<string>();
  const bookingLinks: BookingLink[] = [];
  for (const { platform, re } of BOOKING_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      const url = m[0].startsWith("http") ? m[0] : "https://" + m[0];
      if (bookingSet.has(url)) continue;
      bookingSet.add(url);
      bookingLinks.push({ platform, url });
    }
  }

  // Contact pages and external URLs
  const contactPages: string[] = [];
  const allExternalUrls: string[] = [];
  const hrefRe = /href=["']([^"']+)["']/gi;
  let hr: RegExpExecArray | null;
  while ((hr = hrefRe.exec(clean)) !== null) {
    const href = hr[1].trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    let fullUrl = href;
    if (href.startsWith("/")) { try { fullUrl = new URL(href, baseUrl).href; } catch { continue; } }
    else if (!href.startsWith("http")) continue;
    if (/\/contact|support|sales|about-us|team\b|careers\b/i.test(fullUrl)) contactPages.push(fullUrl);
    try {
      const p = new URL(fullUrl); const b = new URL(baseUrl);
      if (p.hostname !== b.hostname && !/\.(png|jpg|gif|svg|css|js|woff|ttf)$/i.test(p.href)) allExternalUrls.push(fullUrl);
    } catch { /* skip */ }
  }

  return { emails, phones, socialLinks, bookingLinks, contactPages: dedupeStr(contactPages), allExternalUrls: dedupeStr(allExternalUrls).slice(0, 200) };
}
