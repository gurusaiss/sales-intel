import "dotenv/config";
import express from "express";
import cors from "cors";
import searchRouter from "./routes/search";
import crmRouter from "./routes/crm";
import authRouter from "./routes/auth";
import leadsRouter from "./routes/leads";
import careerRouter from "./routes/career";
import usersRouter from "./routes/users";
import { resolveUser } from "./middleware/auth";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// resolveUser is permissive (never blocks/401s — it only resolves req.userId),
// so mounting it globally is safe. requireApiKey stays per-route inside each
// router file since it DOES block, and mounting a blocking middleware at the
// "/api" prefix previously broke unrelated public routes (see git history).
app.use("/api", resolveUser);
app.use("/api", searchRouter);
app.use("/api", crmRouter);
app.use("/api", authRouter);
app.use("/api", leadsRouter);
app.use("/api", careerRouter);
app.use("/api", usersRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
