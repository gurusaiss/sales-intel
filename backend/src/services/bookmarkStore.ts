import { readJson, writeJson, userScopedKey } from "./kvStore";

export type BookmarkType = "article" | "trend" | "innovation" | "report" | "analysis";

export interface Bookmark {
  id: string;
  userId: string;
  contentType: BookmarkType;
  contentId: string;
  note?: string;
  collectionId?: string;
  title: string;
  url?: string;
  createdAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
}

function bookmarkKey(userId: string) { return userScopedKey("bookmarks", userId); }
function collectionKey(userId: string) { return userScopedKey("collections", userId); }
function followKey(userId: string) { return userScopedKey("topic_follows", userId); }

export async function listBookmarks(userId: string, contentType?: BookmarkType, collectionId?: string): Promise<Bookmark[]> {
  const all = (await readJson<Bookmark[] | null>(bookmarkKey(userId), null)) ?? [];
  return all.filter((b) =>
    (!contentType || b.contentType === contentType) &&
    (!collectionId || b.collectionId === collectionId)
  );
}

export async function createBookmark(userId: string, data: Omit<Bookmark, "id" | "userId" | "createdAt">): Promise<Bookmark> {
  const all = (await readJson<Bookmark[] | null>(bookmarkKey(userId), null)) ?? [];
  const existing = all.find((b) => b.contentType === data.contentType && b.contentId === data.contentId);
  if (existing) return existing;
  const bookmark: Bookmark = { ...data, id: crypto.randomUUID(), userId, createdAt: new Date().toISOString() };
  all.unshift(bookmark);
  await writeJson(bookmarkKey(userId), all);
  return bookmark;
}

export async function updateBookmark(userId: string, id: string, patch: { note?: string; collectionId?: string }): Promise<Bookmark | null> {
  const all = (await readJson<Bookmark[] | null>(bookmarkKey(userId), null)) ?? [];
  const idx = all.findIndex((b) => b.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch };
  await writeJson(bookmarkKey(userId), all);
  return all[idx];
}

export async function deleteBookmark(userId: string, id: string): Promise<boolean> {
  const all = (await readJson<Bookmark[] | null>(bookmarkKey(userId), null)) ?? [];
  const filtered = all.filter((b) => b.id !== id);
  if (filtered.length === all.length) return false;
  await writeJson(bookmarkKey(userId), filtered);
  return true;
}

export async function listCollections(userId: string): Promise<Collection[]> {
  return (await readJson<Collection[] | null>(collectionKey(userId), null)) ?? [];
}

export async function createCollection(userId: string, data: { name: string; description?: string; isPublic?: boolean }): Promise<Collection> {
  const all = (await readJson<Collection[] | null>(collectionKey(userId), null)) ?? [];
  const collection: Collection = { id: crypto.randomUUID(), userId, name: data.name, description: data.description, isPublic: data.isPublic ?? false, createdAt: new Date().toISOString() };
  all.push(collection);
  await writeJson(collectionKey(userId), all);
  return collection;
}

export async function deleteCollection(userId: string, id: string): Promise<boolean> {
  const all = (await readJson<Collection[] | null>(collectionKey(userId), null)) ?? [];
  const filtered = all.filter((c) => c.id !== id);
  if (filtered.length === all.length) return false;
  await writeJson(collectionKey(userId), filtered);
  return true;
}

export async function listTopicFollows(userId: string): Promise<Array<{ id: string; topic: string }>> {
  return (await readJson<Array<{ id: string; topic: string }> | null>(followKey(userId), null)) ?? [];
}

export async function addTopicFollow(userId: string, topic: string): Promise<{ id: string; topic: string }> {
  const all = (await readJson<Array<{ id: string; topic: string }> | null>(followKey(userId), null)) ?? [];
  if (all.some((f) => f.topic.toLowerCase() === topic.toLowerCase())) return all.find((f) => f.topic.toLowerCase() === topic.toLowerCase())!;
  const follow = { id: crypto.randomUUID(), topic };
  all.push(follow);
  await writeJson(followKey(userId), all);
  return follow;
}

export async function removeTopicFollow(userId: string, id: string): Promise<boolean> {
  const all = (await readJson<Array<{ id: string; topic: string }> | null>(followKey(userId), null)) ?? [];
  const filtered = all.filter((f) => f.id !== id);
  if (filtered.length === all.length) return false;
  await writeJson(followKey(userId), filtered);
  return true;
}
