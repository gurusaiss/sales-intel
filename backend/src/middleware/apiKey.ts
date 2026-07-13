import { Request, Response, NextFunction } from "express";

/**
 * Shared-secret gate for a public, single-user deployment. Without this,
 * anyone who finds the Render URL could call /api/send-email (real Gmail
 * send) or read/mutate all tracked contacts — there's no other identity
 * boundary on this API.
 *
 * If APP_API_KEY isn't set, this no-ops — keeps local dev frictionless while
 * making production configuration a deliberate choice, not a silent gap.
 */
export function requireApiKey(req: Request, res: Response, next: NextFunction): void {
  const configuredKey = process.env.APP_API_KEY;
  if (!configuredKey) {
    next();
    return;
  }

  const providedKey = req.header("x-api-key");
  if (providedKey !== configuredKey) {
    res.status(401).json({ error: "Missing or invalid API key." });
    return;
  }

  next();
}
