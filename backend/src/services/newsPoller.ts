import { NEWS_SOURCES } from "./newsSources";
import { parseFeed } from "./rssParser";
import { upsertArticlesBatch } from "./articleStore";

export async function pollAllSources(): Promise<number> {
  // Fetch every feed in parallel — the old sequential loop (25 feeds × up to
  // 15s each + a 200ms delay between) made cold-start polling take ~50s. Each
  // feed still fails independently (parseFeed catches and returns []).
  const results = await Promise.all(
    NEWS_SOURCES.map((source) => parseFeed(source.rssUrl, source.name, source.category))
  );

  const items = results.flat().map((item) => ({
    sourceName: item.sourceName,
    sourceCategory: item.sourceCategory,
    title: item.title,
    url: item.url,
    imageUrl: item.imageUrl,
    contentRaw: item.content,
    categories: [item.sourceCategory],
    keywords: [] as string[],
    publishedAt: item.publishedAt,
  }));

  const added = await upsertArticlesBatch(items);
  console.log(`[newsPoller] Polled ${NEWS_SOURCES.length} sources, ${items.length} items, ${added} new`);
  return added;
}
