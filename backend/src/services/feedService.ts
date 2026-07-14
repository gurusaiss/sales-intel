import { listArticles } from "./articleStore";
import { listTopicFollows } from "./bookmarkStore";
import { callAI } from "./aiRouter";
import { readJson } from "./kvStore";
import { userScopedKey } from "./kvStore";

export async function getPersonalFeed(userId: string, limit = 20) {
  const follows = await listTopicFollows(userId);
  const articles = await listArticles({ limit: 100 });
  if (follows.length === 0) {
    return articles.slice(0, limit);
  }
  const topics = follows.map((f) => f.topic.toLowerCase());
  const scored = articles.map((a) => {
    let score = 0;
    const haystack = (a.title + " " + (a.keywords ?? []).join(" ")).toLowerCase();
    for (const topic of topics) {
      if (haystack.includes(topic)) score += 10;
    }
    score += Math.log1p(a.viewCount ?? 0);
    return { article: a, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.article);
}

export async function getCatchUpBrief(userId: string): Promise<string | null> {
  const userKey = userScopedKey("last_seen", userId);
  const lastSeenStr = await readJson<string | null>(userKey, null);
  if (!lastSeenStr) return null;
  const lastSeen = new Date(lastSeenStr);
  const hoursSince = (Date.now() - lastSeen.getTime()) / 3600000;
  if (hoursSince < 6) return null;

  const cutoff = new Date(lastSeen);
  const articles = await listArticles({ limit: 50 });
  const missed = articles.filter((a) => new Date(a.publishedAt) > cutoff).slice(0, 15);
  if (missed.length < 3) return null;

  const titles = missed.map((a, i) => `${i + 1}. ${a.title}`).join("\n");
  const prompt = `Summarize what happened in tech while I was away (last seen ${Math.round(hoursSince)} hours ago). Write 3-5 sentences covering the most important developments from these headlines:\n${titles}`;
  return await callAI(prompt, "You are a concise tech news anchor.", 300);
}
