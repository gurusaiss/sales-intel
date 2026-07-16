import { parseFeed } from "./rssParser";
import { upsertInnovationsBatch } from "./trendStore";
import { DISCOVER_FEEDS, extractGithubUrl, inferIsOpenSource } from "./discoverSources";

export async function pollDiscoverSources(): Promise<number> {
  // Fetch all discover feeds in parallel; each fails independently.
  const results = await Promise.all(
    DISCOVER_FEEDS.map(async (feed) => {
      const items = await parseFeed(feed.url, feed.source, feed.category);
      return items.slice(0, 15).map((item) => {
        const githubUrl = extractGithubUrl(item.content + " " + item.url);
        const isOss = inferIsOpenSource(item.url, item.content);
        const type = isOss && feed.type === "oss" ? "oss" : feed.type;
        return {
          name: item.title.replace(/^Show HN:\s*/i, "").replace(/^Launch HN:\s*/i, "").trim().slice(0, 120),
          type,
          description: item.content.slice(0, 400) || item.title,
          url: item.url,
          githubUrl,
          impactScore: 50,
          tags: [feed.category, feed.source],
        };
      });
    })
  );

  const added = await upsertInnovationsBatch(results.flat());
  console.log("[discoverPoller] Polled discover sources, new:", added);
  return added;
}
