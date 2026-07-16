import Parser from "rss-parser";

export interface FeedItem {
  title: string;
  url: string;
  content: string;
  imageUrl?: string;
  publishedAt: string;
  sourceName: string;
  sourceCategory: string;
}

const parser = new Parser({
  customFields: {
    item: ["media:thumbnail", "enclosure", ["media:content", "mediaContent"]],
  },
  timeout: 15000,
  headers: {
    // Several feeds (InfoQ, Cloudflare, others behind CDNs/WAFs) reject the
    // default rss-parser User-Agent with 403/406. A real browser-like UA is
    // accepted everywhere we poll.
    "User-Agent":
      "Mozilla/5.0 (compatible; SalesIntelBot/1.0; +https://sales-intel.onrender.com)",
    Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
  },
});

function extractImage(item: Record<string, unknown>): string | undefined {
  const thumb = item["media:thumbnail"] as { $?: { url?: string } } | undefined;
  if (thumb?.$?.url) return String(thumb.$.url);
  const enc = item["enclosure"] as { url?: string; type?: string } | undefined;
  if (enc?.url && String(enc.type ?? "").startsWith("image")) return String(enc.url);
  return undefined;
}

function extractContent(item: Record<string, unknown>): string {
  const raw = (item["content:encoded"] ?? item["content"] ?? item["summary"] ?? "") as string;
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 3000);
}

export async function parseFeed(rssUrl: string, sourceName: string, sourceCategory: string): Promise<FeedItem[]> {
  try {
    const feed = await parser.parseURL(rssUrl);
    return (feed.items ?? []).slice(0, 50).map((item) => {
      const raw = item as unknown as Record<string, unknown>;
      return {
        title: item.title ?? "(no title)",
        url: item.link ?? item.guid ?? "",
        content: extractContent(raw),
        imageUrl: extractImage(raw),
        publishedAt: item.pubDate ?? item.isoDate ?? new Date().toISOString(),
        sourceName,
        sourceCategory,
      };
    }).filter((i) => i.url);
  } catch (err) {
    console.warn(`RSS parse failed for ${rssUrl}:`, err instanceof Error ? err.message : err);
    return [];
  }
}
