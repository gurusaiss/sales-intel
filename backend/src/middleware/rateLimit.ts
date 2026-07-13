import { Request, Response, NextFunction } from "express";

/**
 * In-memory sliding-window limiter. Free-tier constraint: no Redis-backed
 * rate limiter service, so this resets on redeploy — acceptable since its
 * job is capping abusive bursts, not long-term ban tracking.
 */
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const hits = new Map<string, number[]>();

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = `${req.userId ?? "anon"}:${req.ip}`;
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t > WINDOW_MS)) hits.delete(k);
    }
  }

  next();
}
