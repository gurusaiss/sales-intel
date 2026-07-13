import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/authToken";
import { DEFAULT_USER_ID } from "../services/kvStore";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId: string;
    }
  }
}

/**
 * Permissive by design — never blocks a request. If a valid session token is
 * present, req.userId is that account's id and every store call is scoped to
 * their own private data. If not (nobody's logged in, or the token's stale),
 * req.userId falls back to "default" — the exact shared namespace this app
 * used before accounts existed. Using the app without logging in keeps
 * working exactly as it always has; logging in is additive, not required.
 */
export function resolveUser(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const userId = token ? verifyToken(token) : null;

  req.userId = userId ?? DEFAULT_USER_ID;
  next();
}
