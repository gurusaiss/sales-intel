import { parseFeed } from "./rssParser";
import { upsertInnovation } from "./trendStore";
import { DISCOVER_FEEDS, extractGithubUrl, inferIsOpenSource } from "./discoverSources";

export async function pollDiscoverSources(): Promise<number> {
  let newCount = 0;
  for (const feed of DISCOVER_FEEDS) {
    try {
      const items = await parseFeed(feed.url, feed.source, feed.category);
      for (const item of items.slice(0, 15)) {
        const githubUrl = extractGithubUrl(item.content + " " + item.url);
        const isOss = inferIsOpenSource(item.url, item.content);
        const type = isOss && feed.type === "oss" ? "oss" : feed.type;
        await upsertInnovation({
          name: item.title.replace(/^Show HN:\s*/i, "").replace(/^Launch HN:\s*/i, "").trim().slice(0, 120),
          type,
          description: item.content.slice(0, 400) || item.title,
          url: item.url,
          githubUrl,
          impactScore: 50,
          tags: [feed.category, feed.source],
        });
        newCount++;
      }
      await new Promise((r) => setTimeout(r, 400));
    } catch (err) {
      console.warn("[discoverPoller] Failed:", feed.source, err instanceof Error ? err.message : err);
    }
  }
  console.log("[discoverPoller] Polled discover sources, new:", newCount);
  return newCount;
}
