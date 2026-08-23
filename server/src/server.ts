import express from "express";
import cors from "cors";
import { env } from "./config/env.js";

const app = express();

app.use(
  cors({
    origin: env.clientUrl,
  }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    service: "ai-health-screening-agent",
    status: "healthy",
    timestamp: new Date().toISOString(),
  });
});

app.listen(env.port, () => {
  console.log(
    `🚀 Health Screening API running on http://localhost:${env.port}`,
  );
});