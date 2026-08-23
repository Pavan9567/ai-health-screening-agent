import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  createCallSession,
  type CallSession,
} from "../models/callSession.js";

interface ClientMessage {
  type: "START_CALL" | "END_CALL" | "PING";
  callId?: string;
}

interface ServerMessage {
  type:
    | "CONNECTED"
    | "CALL_STARTED"
    | "CALL_ENDED"
    | "ERROR"
    | "PONG";

  callId?: string;
  message?: string;
}

function sendMessage(
  socket: WebSocket,
  message: ServerMessage,
): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

export function initializeCallSocket(
  server: HttpServer,
): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: "/ws/call",
  });

  wss.on("connection", (socket) => {
    console.log("WebSocket client connected.");

    let session: CallSession | null = null;

    sendMessage(socket, {
      type: "CONNECTED",
      message: "WebSocket connection established.",
    });

    socket.on("message", (rawMessage, isBinary) => {
      if (isBinary) {
        const audioBuffer = Buffer.isBuffer(rawMessage)
            ? rawMessage
            : Buffer.from(rawMessage as ArrayBuffer);

        console.log(
            `🎙️ Received audio chunk: ${audioBuffer.byteLength} bytes`,
        );

        return;
      }
      try {
        const message = JSON.parse(
          rawMessage.toString(),
        ) as ClientMessage;

        switch (message.type) {
          case "START_CALL": {
            session = createCallSession();

            session.status = "active";

            console.log(
              `Call started: ${session.callId}`,
            );

            sendMessage(socket, {
              type: "CALL_STARTED",
              callId: session.callId,
              message: "Call session started.",
            });

            break;
          }

          case "END_CALL": {
            if (!session) {
              sendMessage(socket, {
                type: "ERROR",
                message: "No active call session.",
              });

              break;
            }

            session.status = "ended";

            console.log(
              `Call ended: ${session.callId}`,
            );

            sendMessage(socket, {
              type: "CALL_ENDED",
              callId: session.callId,
              message: "Call session ended.",
            });

            break;
          }

          case "PING": {
            sendMessage(socket, {
              type: "PONG",
            });

            break;
          }

          default: {
            sendMessage(socket, {
              type: "ERROR",
              message: "Unknown message type.",
            });
          }
        }
      } catch (error) {
        console.error(
          "WebSocket message error:",
          error,
        );

        sendMessage(socket, {
          type: "ERROR",
          message: "Invalid WebSocket message.",
        });
      }
    });

    socket.on("close", () => {
      console.log("🔌 WebSocket client disconnected.");

      if (session && session.status !== "ended") {
        session.status = "ended";

        console.log(
          `Session automatically ended: ${session.callId}`,
        );
      }
    });

    socket.on("error", (error) => {
      console.error(
        "WebSocket error:",
        error,
      );
    });
  });

  console.log(
    "WebSocket server initialized at /ws/call",
  );

  return wss;
}