import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { env } from "./config/env.js";
import { initializeCallSocket } from "./websocket/callSocket.js";

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

const server = createServer(app);

initializeCallSocket(server);

server.listen(env.port, () => {
  console.log(
    `Health Screening API running on http://localhost:${env.port}`,
  );
});