import { Router } from "express";
import { refreshAll, dataStatus } from "../services/liveData";
import { isDurablePersistenceConfigured } from "../services/kvStore";

const router = Router();

/**
 * Keep-alive + on-demand refresh. Point an external cron (e.g. cron-job.org)
 * at this every 10-15 min: it keeps the free-tier service warm AND triggers a
 * fresh poll of every source. Intentionally unauthenticated (it only pulls
 * public RSS/GitHub data) and non-blocking — it kicks jobs off and returns
 * immediately. Concurrent calls are de-duped inside liveData.
 */
router.all("/refresh", (_req, res) => {
  void refreshAll();
  res.json({ ok: true, triggered: true, at: new Date().toISOString() });
});

router.get("/data-status", (_req, res) => {
  res.json({
    durablePersistence: isDurablePersistenceConfigured(),
    jobs: dataStatus(),
  });
});

export default router;
