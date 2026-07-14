import { lookup } from "dns/promises";

export interface ScrapeResult {
  url: string;
  html: string;
  text: string;
  title: string;
  metaTags: Record<string, string>;
  links: string[];
  responseHeaders: Record<string, string>;
}

const PRIVATE_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^169\.254\./,
  /^::1$/,
  /^fc00:/,
  /^fe80:/,
];

async function isPrivateIp(hostname: string): Promise<boolean> {
  try {
    const { address } = await lookup(hostname);
    return PRIVATE_RANGES.some((r) => r.test(address));
  } catch {
    return false;
  }
}

export async function scrape(url: string): Promise<ScrapeResult> {
  const parsed = new URL(url);
  if (await isPrivateIp(parsed.hostname)) {
    throw new Error(`SSRF blocked: ${parsed.hostname} resolves to a private IP`);
  }

  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { "user-agent": "Mozilla/5.0 (compatible; SalesIntel/1.0)" },
    redirect: "follow",
  });

  // 5 MB cap
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 5 * 1024 * 1024) throw new Error("Response too large (>5 MB)");
  const html = new TextDecoder().decode(buf);

  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k] = v; });

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Extract meta tags
  const metaTags: Record<string, string> = {};
  const metaRe = /<meta[^>]+>/gi;
  let m: RegExpExecArray | null;
  while ((m = metaRe.exec(html)) !== null) {
    const tag = m[0];
    const nameMatch = tag.match(/(?:name|property)=["']([^"']+)["']/i);
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (nameMatch && contentMatch) metaTags[nameMatch[1]] = contentMatch[1];
  }

  // Extract links
  const links: string[] = [];
  const linkRe = /href=["']([^"'#?][^"']*?)["']/gi;
  while ((m = linkRe.exec(html)) !== null) {
    try { links.push(new URL(m[1], url).href); } catch { /* skip */ }
    if (links.length >= 100) break;
  }

  // Simple text extraction: strip tags, decode common entities, collapse whitespace
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20000);

  return { url, html, text, title, metaTags, links, responseHeaders: headers };
}
