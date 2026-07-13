import { Router } from "express";
import { listAudit } from "../services/auditLog";
import { requireApiKey } from "../middleware/apiKey";

const router = Router();

router.get("/audit", requireApiKey, async (req, res) => {
  const entries = await listAudit(req.userId);
  res.json({ entries });
});

export default router;
