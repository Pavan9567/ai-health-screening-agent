import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { DeepgramSttService, } from "../services/stt.service.js";

import {
  createCallSession,
  type CallSession,
} from "../models/callSession.js";

interface ClientMessage {
  type:
    | "START_CALL"
    | "END_CALL"
    | "AUDIO_CHUNK"
    | "PING";

  callId?: string;
}

interface ServerMessage {
  type:
    | "CONNECTED"
    | "CALL_STARTED"
    | "CALL_ENDED"
    | "TRANSCRIPT"
    | "ERROR"
    | "PONG";

  callId?: string;
  message?: string;
  transcript?: string;
  isFinal?: boolean;
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

  const sttService = new DeepgramSttService();

  wss.on("connection", (socket) => {
    console.log(
      "WebSocket client connected.",
    );

    let session: CallSession | null =
      null;

    let sttConnection:
      | Awaited<
          ReturnType<
            DeepgramSttService["createLiveConnection"]
          >
        >
      | null = null;

    sendMessage(socket, {
      type: "CONNECTED",
      message:
        "WebSocket connection established.",
    });

    socket.on(
      "message",
      async (rawMessage, isBinary) => {
        // BINARY AUDIO MESSAGE
        if (isBinary) {
          const audioBuffer =
            Buffer.isBuffer(rawMessage)
              ? rawMessage
              : Buffer.from(
                  rawMessage as ArrayBuffer,
                );

          console.log(
            `Received audio chunk: ${audioBuffer.byteLength} bytes`,
          );

          if (sttConnection && session?.status === "active") {
            try {
              if (sttConnection.socket.readyState === sttConnection.socket.OPEN) {
                sttConnection.socket.send(
                  audioBuffer,
                );
              }
            } catch (error) {
              console.error(
                "Failed to send audio to Deepgram:",
                error,
              );

              sendMessage(socket, {
                type: "ERROR",
                callId: session?.callId,
                message: "Failed to process audio.",
              });
            }
          }

          return;
        }

        // JSON CONTROL MESSAGE
        try {
          const message =
            JSON.parse(
              rawMessage.toString(),
            ) as ClientMessage;

          switch (message.type) {
            // START CALL
            case "START_CALL": {
              if (
                session &&
                session.status === "active"
              ) {
                sendMessage(socket, {
                  type: "ERROR",
                  callId: session.callId,
                  message: "A call is already active.",
                });

                break;
              }

              session = createCallSession();

              session.status = "active";

              console.log(
                `Call started: ${session.callId}`,
              );

              // Create Deepgram v5 connection
              try {
                sttConnection = await sttService.createLiveConnection();

                console.log(
                  "Deepgram STT connection created.",
                );

                // Deepgram WebSocket OPEN
                sttConnection.on(
                  "open",
                  () => {
                    console.log(
                      "Deepgram STT WebSocket opened.",
                    );
                  },
                );

                // Deepgram MESSAGE
                sttConnection.on(
                  "message",
                  (data) => {
                    console.log("Deepgram message:", JSON.stringify(data),);

                    if (data.type !== "Results") {
                      return;
                    }

                    const alternative = data.channel ?.alternatives?.[0];

                    const transcript = alternative?.transcript?.trim();

                    // Ignore empty transcripts.
                    if (!transcript) {
                      return;
                    }

                    const isFinal = data.is_final === true;

                    console.log(
                      `${
                        isFinal
                          ? "FINAL"
                          : "INTERIM"
                      } transcript: ${transcript}`,
                    );

                    sendMessage(socket, {
                      type: "TRANSCRIPT",
                      callId: session?.callId,
                      transcript,
                      isFinal,
                    });
                  },
                );

                // Deepgram ERROR
                sttConnection.on(
                  "error",
                  (error) => {
                    console.error(
                      "Deepgram STT error:",
                      error,
                    );

                    sendMessage(socket, {
                      type: "ERROR",
                      callId: session?.callId,
                      message: "Speech recognition temporarily failed.",
                    });
                  },
                );

                // Deepgram CLOSE
                sttConnection.on(
                  "close",
                  () => {
                    console.log(
                      "Deepgram STT WebSocket closed.",
                    );
                  },
                );

                sttConnection.connect();

                await sttConnection.waitForOpen();

                console.log("Deepgram STT connection ready.");
              } catch (error) {
                console.error(
                  "Failed to create Deepgram connection:",
                  error,
                );

                session.status = "ended";

                sttConnection = null;

                sendMessage(socket, {
                  type: "ERROR",
                  callId: session.callId,
                  message: "Unable to start speech recognition.",
                });

                break;
              }

              // Frontend Call Started Intimation
              sendMessage(socket, {
                type: "CALL_STARTED",
                callId: session.callId,
                message: "Call session started.",
              });

              break;
            }

            // END CALL
            case "END_CALL": {
              if (!session) {
                sendMessage(socket, {
                  type: "ERROR",
                  message:
                    "No active call session.",
                });

                break;
              }

              session.status = "ended";

              console.log(
                `Call ended: ${session.callId}`,
              );

              // Close Deepgram.
              if (sttConnection) {
                try {
                  sttConnection.socket.close();
                } catch (error) {
                  console.error(
                    "Error closing Deepgram connection:",
                    error,
                  );
                }

                sttConnection = null;
              }

              sendMessage(socket, {
                type: "CALL_ENDED",
                callId: session.callId,
                message: "Call session ended.",
              });

              break;
            }

            // PING
            case "PING": {
              sendMessage(socket, {
                type: "PONG",
              });

              break;
            }

            /*
             * ============================================
             * AUDIO_CHUNK AS JSON
             * ============================================
             *
             * We expect actual audio to arrive as a
             * binary WebSocket message.
             */
            case "AUDIO_CHUNK": {
              console.warn(
                "AUDIO_CHUNK received as JSON. Expected binary audio data.",
              );

              break;
            }

            // UNKNOWN
            default: {
              sendMessage(socket, {
                type: "ERROR",
                callId: session?.callId,
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
            callId: session?.callId,
            message: "Invalid WebSocket message.",
          });
        }
      },
    );

    // CLIENT DISCONNECT
    socket.on("close", () => {
      console.log(
        "WebSocket client disconnected.",
      );

      if (sttConnection) {
        try {
          sttConnection.socket.close();
        } catch (error) {
          console.error(
            "Error closing Deepgram after client disconnect:",
            error,
          );
        }

        sttConnection =
          null;
      }

      if (session && session.status !== "ended") {
        session.status = "ended";
        console.log(
          `Session automatically ended: ${session.callId}`,
        );
      }
    });

    // WEBSOCKET ERROR
    socket.on("error", (error) => {
      console.error(
        "WebSocket error:",
        error,
      );

      if (sttConnection) {
        try {
          sttConnection.socket.close();
        } catch (closeError) {
          console.error(
            "Error closing Deepgram after WebSocket error:",
            closeError,
          );
        }

        sttConnection =
          null;
      }
    });
  });

  console.log(
    "WebSocket server initialized at /ws/call",
  );

  return wss;
}