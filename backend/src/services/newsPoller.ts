import { NEWS_SOURCES } from "./newsSources";
import { parseFeed } from "./rssParser";
import { upsertArticle } from "./articleStore";

export async function pollAllSources(): Promise<number> {
  let newCount = 0;
  for (const source of NEWS_SOURCES) {
    const items = await parseFeed(source.rssUrl, source.name, source.category);
    for (const item of items) {
      const result = await upsertArticle({
        sourceName: item.sourceName,
        sourceCategory: item.sourceCategory,
        title: item.title,
        url: item.url,
        imageUrl: item.imageUrl,
        contentRaw: item.content,
        categories: [item.sourceCategory],
        keywords: [],
        publishedAt: item.publishedAt,
      });
      if (!result.aiProcessed) newCount++;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`[newsPoller] Polled ${NEWS_SOURCES.length} sources, ${newCount} new/pending items`);
  return newCount;
}
