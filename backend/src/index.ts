import "dotenv/config";
import express from "express";
import cors from "cors";
import searchRouter from "./routes/search";
import crmRouter from "./routes/crm";
import authRouter from "./routes/auth";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api", searchRouter);
app.use("/api", crmRouter);
app.use("/api", authRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
