import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { DeepgramSttService, } from "../services/stt.service.js";
import { GeminiLlmService, } from "../services/llm.service.js";
import { GeminiTtsService, } from "../services/tts.service.js";
import { ConversationService, } from "../services/conversation.service.js";
import { buildHealthScreeningPrompt, } from "../prompts/healthScreening.js";
import { createCallSession, type CallSession, } from "../models/callSession.js";
import type { ConversationState, HealthScreeningReport, } from "../models/healthScreening.js";


// Client WebSocket Messages
interface ClientMessage {
  type:
    | "START_CALL"
    | "END_CALL"
    | "AUDIO_CHUNK"
    | "PING";

  callId?: string;
}


// Server WebSocket Messages
interface ServerMessage {
  type:
    | "CONNECTED"
    | "CALL_STARTED"
    | "CALL_ENDED"
    | "TRANSCRIPT"
    | "AI_RESPONSE"
    | "AUDIO_START"
    | "AUDIO_END"
    | "SCREENING_COMPLETE"
    | "ERROR"
    | "PONG";

  callId?: string;
  message?: string;
  transcript?: string;
  isFinal?: boolean;
  response?: string;
  report?: HealthScreeningReport;
}


// Send WebSocket Message
function sendMessage(
  socket: WebSocket,
  message: ServerMessage,
): void {
  if (
    socket.readyState ===
    socket.OPEN
  ) {
    socket.send(
      JSON.stringify(message),
    );
  }
}


function sendAudio(
  socket: WebSocket,
  audioBuffer: Buffer,
): void {
  if (
    socket.readyState ===
    socket.OPEN
  ) {
    socket.send(
      audioBuffer,
    );
  }
}

function buildHealthScreeningReport(
  state: ConversationState,
  summary: string,
): HealthScreeningReport {
  return {
    name: state.health.name,

    mainConcern: state.health.mainConcern,

    symptoms: [
      ...state.health.symptoms,
    ],

    duration: state.health.duration,

    severity: state.health.severity,

    relatedSymptoms: [
      ...state.health.relatedSymptoms,
    ],

    followUpFlags: [
      ...state.health.followUpFlags,
    ],

    summary,

    completed: state.isComplete,

    disclaimer: "This health screening summary is for informational purposes only and is not a medical diagnosis. Please consult a qualified healthcare professional for medical advice, diagnosis, or treatment.",
  };
}


// Initialize Call WebSocket
export function initializeCallSocket(
  server: HttpServer,
): WebSocketServer {
  const wss =
    new WebSocketServer({
      server,
      path: "/ws/call",
    });


  // Services
  const sttService = new DeepgramSttService();

  const geminiService = new GeminiLlmService();

  const ttsService = new GeminiTtsService();

  const conversationService = new ConversationService();


  // WebSocket Connection
  wss.on(
    "connection",
    (socket) => {
      console.log(
        "WebSocket client connected.",
      );


      // Per-call state
      let session:
        | CallSession
        | null = null;


      // Deepgram connection
      let sttConnection:
        | Awaited<
            ReturnType<
              DeepgramSttService["createLiveConnection"]
            >
          >
        | null = null;


      // Conversation state
      let conversationState =
        conversationService
          .createInitialState();


      // Conversation turn state
      type CallTurnState =
        | "LISTENING"
        | "PROCESSING"
        | "AI_SPEAKING";


      let turnState: CallTurnState = "LISTENING";


      // Connected
      sendMessage(
        socket,
        {
          type: "CONNECTED",
          message:
            "WebSocket connection established.",
        },
      );


      // Ensure Deepgram connection
      let sttConnectionPromise:
        | Promise<Awaited<ReturnType<DeepgramSttService["createLiveConnection"]>>>
        | null = null;

      const ensureSttConnection = async () => {
        if (
          sttConnection &&
          sttConnection.socket.readyState ===
            sttConnection.socket.OPEN
        ) {
          return sttConnection;
        }

        if (sttConnectionPromise) {
          return sttConnectionPromise;
        }

        sttConnectionPromise = (async () => {
          try {
                  const connection =
                    await sttService
                      .createLiveConnection();

                  sttConnection =
                    connection;


                  console.log(
                    "Deepgram STT connection created.",
                  );


                  // Deepgram WebSocket OPEN
                  connection.on(
                    "open",
                    () => {
                      console.log(
                        "Deepgram STT WebSocket opened.",
                      );
                    },
                  );


                  // Deepgram MESSAGE
                  connection.on(
                    "message",
                    async (
                      data,
                    ) => {
                      try {
                        console.log(
                          "Deepgram message:",
                          JSON.stringify(
                            data,
                          ),
                        );


                        // Only process Results messages
                        if (
                          data.type !==
                          "Results"
                        ) {
                          return;
                        }


                        const alternative =
                          data
                            .channel
                            ?.alternatives?.[0];


                        const transcript =
                          alternative
                            ?.transcript
                            ?.trim();


                        // Ignore empty transcript
                        if (
                          !transcript
                        ) {
                          return;
                        }


                        const isFinal =
                          data.is_final ===
                          true;


                        console.log(
                          `${
                            isFinal
                              ? "FINAL"
                              : "INTERIM"
                          } transcript: ${transcript}`,
                        );


                        // Always send transcript to frontend.
                        sendMessage(
                          socket,
                          {
                            type:
                              "TRANSCRIPT",

                            callId:
                              session?.callId,

                            transcript,

                            isFinal,
                          },
                        );

                        if (!isFinal) {
                          return;
                        }


                        // Ignore empty FINAL transcripts
                        if (
                          !transcript
                            .trim()
                        ) {
                          return;
                        }


                        // Only process FINAL transcripts while LISTENING
                        if (turnState !== "LISTENING") {
                          console.warn(
                            `Ignoring FINAL transcript because current turn state is ${turnState}.`,
                          );

                          return;
                        }


                        // Move into PROCESSING state
                        turnState = "PROCESSING";

                        console.log(
                          "Turn state: LISTENING → PROCESSING",
                        );


                        try {
                          // Build health screening prompt
                          const prompt =
                            buildHealthScreeningPrompt(
                              conversationState,
                              transcript,
                            );


                          console.log(
                            "Sending transcript to Gemini...",
                          );


                          // Gemini
                          console.log("Sending transcript to Gemini...");

                          const geminiStart = Date.now();

                          const response =
                            await geminiService
                              .generateScreeningResponse(
                                prompt,
                              );

                          console.log(
                            `Gemini responded in ${Date.now() - geminiStart} ms.`,
                          );

                          console.log(
                            "Gemini response:",
                            response.assistantResponse,
                          );


                          // Mark the current topic as answered.
                          conversationState =
                            conversationService
                              .markTopicAsked(
                                conversationState,
                                conversationState.currentTopic,
                              );


                          // Normalize Gemini state update.
                          const normalizedUpdate =
                            conversationService
                              .normalizeHealthUpdate(
                                conversationState,
                                response.stateUpdate,
                                transcript,
                              );


                          // Update health state.
                          conversationState =
                            conversationService
                              .updateState(
                                conversationState,
                                normalizedUpdate,
                              );


                          // Add follow-up flags.
                          conversationState =
                            conversationService
                              .addFollowUpFlags(
                                conversationState,
                                response.followUpFlags,
                              );


                          // Set next topic.
                          conversationState =
                            conversationService
                              .setCurrentTopic(
                                conversationState,
                                response.nextTopic,
                              );


                          // Complete screening
                          let screeningReport:
                            | HealthScreeningReport
                            | null = null;

                          if (response.isComplete) {
                            conversationState =
                              conversationService
                                .completeScreening(
                                  conversationState,
                                );

                            try {
                              console.log(
                                "Generating final health screening summary...",
                              );

                              const summary =
                                await geminiService
                                  .generateHealthScreeningSummary(
                                    conversationState,
                                  );

                              screeningReport =
                                buildHealthScreeningReport(
                                  conversationState,
                                  summary,
                                );

                              console.log(
                                "Final health screening report generated.",
                              );
                            } catch (
                              reportError
                            ) {
                              console.error(
                                "Failed to generate health screening summary:",
                                reportError,
                              );
                            }
                          }


                          // Log conversation state
                          console.log(
                            "Conversation state:",
                            JSON.stringify(
                              conversationState,
                              null,
                              2,
                            ),
                          );


                          // Send AI response text
                          sendMessage(
                            socket,
                            {
                              type: "AI_RESPONSE",
                              callId: session?.callId,
                              response: response.assistantResponse,
                            },
                          );

                          if (screeningReport) {
                            sendMessage(
                              socket,
                              {
                                type: "SCREENING_COMPLETE",
                                callId: session?.callId,
                                report: screeningReport,
                              },
                            );

                            console.log(
                              "SCREENING_COMPLETE sent to client.",
                            );
                          }


                          // Generate AI voice
                          try {
                            if (session?.status !== "active") {
                              return;
                            }


                            // Move into AI_SPEAKING state

                            turnState = "AI_SPEAKING";


                            console.log(
                              "Turn state: PROCESSING → AI_SPEAKING",
                            );


                            console.log(
                              "Generating AI voice response...",
                            );

                            const audioBuffer =
                              await ttsService
                                .generateSpeechWav(
                                  response.assistantResponse,
                                );


                            // Tell frontend audio is starting

                            sendMessage(
                              socket,
                              {
                                type:
                                  "AUDIO_START",

                                callId:
                                  session?.callId,
                              },
                            );


                            /*
                            |--------------------------------------------------------------------------
                            | Send audio in chunks
                            |--------------------------------------------------------------------------
                            |
                            | We intentionally send multiple binary
                            | WebSocket frames instead of one giant
                            | payload.
                            |
                            */

                            const chunkSize = 64 * 1024;


                            for (
                              let offset = 0;
                              offset < audioBuffer.length;
                              offset += chunkSize
                            ) {
                              const chunk =
                                audioBuffer.subarray(
                                  offset,
                                  Math.min(
                                    offset + chunkSize,
                                    audioBuffer.length,
                                  ),
                                );


                              sendAudio(
                                socket,
                                chunk,
                              );
                            }


                            // Tell frontend audio has finished

                            sendMessage(
                              socket,
                              {
                                type:
                                  "AUDIO_END",

                                callId:
                                  session?.callId,
                              },
                            );


                            // AI finished speaking

                            turnState = "LISTENING";

                            console.log(
                              "Turn state: AI_SPEAKING → LISTENING",
                            );


                            console.log(
                              "AI voice response sent.",
                            );

                          } catch (
                            ttsError
                          ) {
                            // TTS failure should NOT kill the call

                            console.error(
                              "Gemini TTS error:",
                              ttsError,
                            );

                            turnState = "LISTENING";

                            console.log(
                              "Turn state: AI_SPEAKING → LISTENING after TTS failure.",
                            );



                            sendMessage(
                              socket,
                              {
                                type:
                                  "ERROR",

                                callId:
                                  session?.callId,

                                message:
                                  "AI voice generation failed. The text response is still available.",
                              },
                            );
                          }
                        } catch (
                          error
                        ) {
                          console.error(
                            "Gemini screening error:",
                            error,
                          );


                          // Don't kill the call if Gemini fails.

                          sendMessage(
                            socket,
                            {
                              type:
                                "ERROR",

                              callId:
                                session?.callId,

                              message:
                                "I had trouble processing that. Please try again.",
                            },
                          );
                        }
                      } catch (
                        error
                      ) {
                        console.error(
                          "Error processing Deepgram message:",
                          error,
                        );
                      }
                    },
                  );


                  // Deepgram ERROR

                  connection.on(
                    "error",
                    (
                      error,
                    ) => {
                      console.error(
                        "Deepgram STT error:",
                        error,
                      );


                      sendMessage(
                        socket,
                        {
                          type:
                            "ERROR",

                          callId:
                            session?.callId,

                          message:
                            "Speech recognition temporarily failed.",
                        },
                      );
                    },
                  );


                  // Deepgram CLOSE

                  connection.on(
                    "close",
                    () => {
                      console.log(
                        "Deepgram STT WebSocket closed.",
                      );
                    },
                  );


                  // Connect Deepgram

                  connection.connect();

                  await connection
                    .waitForOpen();


                  console.log(
                    "Deepgram STT connection ready.",
                  );

                  return connection;
          } catch (
            error
          ) {
            console.error(
              "Failed to create Deepgram connection:",
              error,
            );

            sttConnection =
              null;

            sendMessage(
              socket,
              {
                type:
                  "ERROR",

                callId:
                  session?.callId,

                message:
                  "Unable to start speech recognition.",
              },
            );

            throw error;
          }
        })();

        try {
          return await sttConnectionPromise;
        } finally {
          sttConnectionPromise =
            null;
        }
      };


      // WebSocket Messages

      socket.on(
        "message",
        async (
          rawMessage,
          isBinary,
        ) => {

          // BINARY AUDIO MESSAGE

          if (isBinary) {
            const audioBuffer =
              Buffer.isBuffer(
                rawMessage,
              )
                ? rawMessage
                : Buffer.from(
                    rawMessage as ArrayBuffer,
                  );


            console.log(
              `Received audio chunk: ${audioBuffer.byteLength} bytes`,
            );


            // Only send audio while call is active AND the conversation is listening.

            if (
              session?.status ===
                "active" &&
              turnState ===
                "LISTENING"
            ) {
              try {
                const connection =
                  await ensureSttConnection();

                // The turn may have changed while Deepgram was connecting.
                // Do not forward stale audio into another turn.
                if (
                  session?.status ===
                    "active" &&
                  turnState ===
                    "LISTENING" &&
                  connection.socket.readyState ===
                    connection.socket.OPEN
                ) {
                  connection.socket.send(
                    audioBuffer,
                  );
                }
              } catch (
                error
              ) {
                console.error(
                  "Failed to send audio to Deepgram:",
                  error,
                );
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


            switch (
              message.type
            ) {

              // START CALL

              case "START_CALL": {
                if (
                  session &&
                  session.status ===
                    "active"
                ) {
                  sendMessage(
                    socket,
                    {
                      type:
                        "ERROR",

                      callId:
                        session.callId,

                      message:
                        "A call is already active.",
                    },
                  );

                  break;
                }


                // Create new call session

                session =
                  createCallSession();

                session.status =
                  "active";


                // Reset conversation state

                conversationState =
                  conversationService
                    .createInitialState();


                // Reset conversation turn state

                turnState = "LISTENING";


                console.log(
                  `Call started: ${session.callId}`,
                );


                // Deepgram is created lazily when the first microphone
                // audio chunk arrives. The frontend starts recording only
                // after the AI greeting finishes.


                // Notify frontend that call has started

                sendMessage(
                  socket,
                  {
                    type:
                      "CALL_STARTED",

                    callId:
                      session.callId,

                    message:
                      "Call session started.",
                  },
                );


                // Initial AI greeting

                const initialGreeting = "Hello! Welcome to the health screening. Could you please tell me your name?";

                // Send greeting text

                sendMessage(
                  socket,
                  {
                    type:
                      "AI_RESPONSE",

                    callId:
                      session.callId,

                    response:
                      initialGreeting,
                  },
                );


                // Generate greeting audio

                try {
                  console.log(
                    "Generating initial AI greeting audio...",
                  );


                  const audioBuffer =
                    await ttsService
                      .generateSpeechWav(
                        initialGreeting,
                      );


                  sendMessage(
                    socket,
                    {
                      type:
                        "AUDIO_START",

                      callId:
                        session.callId,
                    },
                  );


                  const chunkSize =
                    64 * 1024;


                  for (
                    let offset = 0;
                    offset < audioBuffer.length;
                    offset += chunkSize
                  ) {
                    const chunk =
                      audioBuffer.subarray(
                        offset,
                        Math.min(
                          offset + chunkSize,
                          audioBuffer.length,
                        ),
                      );


                    sendAudio(
                      socket,
                      chunk,
                    );
                  }


                  sendMessage(
                    socket,
                    {
                      type:
                        "AUDIO_END",

                      callId:
                        session.callId,
                    },
                  );


                  console.log(
                    "Initial AI greeting audio sent.",
                  );

                } catch (
                  ttsError
                ) {
                  console.error(
                    "Initial greeting TTS error:",
                    ttsError,
                  );
                }

                break;
              }


              // END CALL

              case "END_CALL": {
                if (
                  !session
                ) {
                  sendMessage(
                    socket,
                    {
                      type:
                        "ERROR",

                      message:
                        "No active call session.",
                    },
                  );

                  break;
                }


                session.status = "ended";

                turnState = "LISTENING";

                console.log(
                  `Call ended: ${session.callId}`,
                );


                // Close Deepgram

                if (
                  sttConnection
                ) {
                  try {
                    sttConnection
                      .socket
                      .close();
                  } catch (
                    error
                  ) {
                    console.error(
                      "Error closing Deepgram connection:",
                      error,
                    );
                  }


                  sttConnection =
                    null;
                }


                // Send CALL_ENDED

                sendMessage(
                  socket,
                  {
                    type:
                      "CALL_ENDED",

                    callId:
                      session.callId,

                    message:
                      "Call session ended.",
                  },
                );


                break;
              }


              // PING

              case "PING": {
                sendMessage(
                  socket,
                  {
                    type:
                      "PONG",
                  },
                );

                break;
              }


              // AUDIO_CHUNK as JSON

              case "AUDIO_CHUNK": {
                console.warn(
                  "AUDIO_CHUNK received as JSON. Expected binary audio data.",
                );

                break;
              }


              // UNKNOWN MESSAGE

              default: {
                sendMessage(
                  socket,
                  {
                    type:
                      "ERROR",

                    callId:
                      session?.callId,

                    message:
                      "Unknown message type.",
                  },
                );
              }
            }
          } catch (
            error
          ) {
            console.error(
              "WebSocket message error:",
              error,
            );


            sendMessage(
              socket,
              {
                type:
                  "ERROR",

                callId:
                  session?.callId,

                message:
                  "Invalid WebSocket message.",
              },
            );
          }
        },
      );


      // CLIENT DISCONNECT

      socket.on(
        "close",
        () => {
          console.log(
            "WebSocket client disconnected.",
          );


          if (
            sttConnection
          ) {
            try {
              sttConnection
                .socket
                .close();
            } catch (
              error
            ) {
              console.error(
                "Error closing Deepgram after client disconnect:",
                error,
              );
            }


            sttConnection =
              null;
          }


          if (
            session &&
            session.status !==
              "ended"
          ) {
            session.status =
              "ended";


            console.log(
              `Session automatically ended: ${session.callId}`,
            );
          }
        },
      );


      // WEBSOCKET ERROR

      socket.on(
        "error",
        (
          error,
        ) => {
          console.error(
            "WebSocket error:",
            error,
          );


          if (
            sttConnection
          ) {
            try {
              sttConnection
                .socket
                .close();
            } catch (
              closeError
            ) {
              console.error(
                "Error closing Deepgram after WebSocket error:",
                closeError,
              );
            }


            sttConnection =
              null;
          }
        },
      );
    },
  );


  // Server Ready

  console.log(
    "WebSocket server initialized at /ws/call",
  );


  return wss;
}