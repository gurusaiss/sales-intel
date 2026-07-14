import * as cheerio from "cheerio";

export interface TrendingRepo {
  name: string;
  fullName: string;
  url: string;
  description: string;
  language?: string;
  starsToday: number;
  totalStars: number;
}

export async function scrapeGithubTrending(since: "daily" | "weekly" | "monthly" = "daily", language = ""): Promise<TrendingRepo[]> {
  const url = `https://github.com/trending/${encodeURIComponent(language)}?since=${since}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; SalesIntel/1.0)" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const repos: TrendingRepo[] = [];

    $("article.Box-row").each((_, el) => {
      const nameEl = $(el).find("h2 a");
      const fullName = nameEl.attr("href")?.replace(/^\//, "") ?? "";
      if (!fullName) return;
      const [owner, repo] = fullName.split("/");
      if (!owner || !repo) return;

      const description = $(el).find("p").first().text().trim();
      const language = $(el).find("[itemprop=programmingLanguage]").text().trim() || undefined;

      // Strategy 1: "X stars today" text
      let starsToday = 0;
      const starsText = $(el).find(".float-sm-right").text().trim();
      const starsMatch = starsText.match(/([\d,]+)\s+stars?\s+today/i);
      if (starsMatch) starsToday = parseInt(starsMatch[1].replace(/,/g, ""), 10);

      // Strategy 2: count stars from star links
      if (!starsToday) {
        const altText = $(el).find("a[href$='/stargazers']").text().trim();
        const altMatch = altText.match(/([\d,]+)/);
        if (altMatch) starsToday = Math.floor(parseInt(altMatch[1].replace(/,/g, ""), 10) / 7);
      }

      const totalStarsText = $(el).find("a[href$='/stargazers']").text().trim();
      const totalMatch = totalStarsText.match(/([\d,]+(?:\.[\d]+)?[kKmM]?)/);
      let totalStars = 0;
      if (totalMatch) {
        const raw = totalMatch[1].replace(/,/g, "");
        if (raw.endsWith("k") || raw.endsWith("K")) totalStars = Math.round(parseFloat(raw) * 1000);
        else if (raw.endsWith("m") || raw.endsWith("M")) totalStars = Math.round(parseFloat(raw) * 1000000);
        else totalStars = parseInt(raw, 10) || 0;
      }

      repos.push({
        name: repo,
        fullName,
        url: `https://github.com/${fullName}`,
        description,
        language,
        starsToday,
        totalStars,
      });
    });

    return repos.slice(0, 25);
  } catch (err) {
    console.warn("GitHub trending scrape failed:", err instanceof Error ? err.message : err);
    return [];
  }
}
