import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import {
  DeepgramSttService,
} from "../services/stt.service.js";

import {
  GeminiLlmService,
} from "../services/llm.service.js";

import {
  ConversationService,
} from "../services/conversation.service.js";

import {
  buildHealthScreeningPrompt,
} from "../prompts/healthScreening.js";

import {
  createCallSession,
  type CallSession,
} from "../models/callSession.js";


/*
|--------------------------------------------------------------------------
| Client WebSocket Messages
|--------------------------------------------------------------------------
*/

interface ClientMessage {
  type:
    | "START_CALL"
    | "END_CALL"
    | "AUDIO_CHUNK"
    | "PING";

  callId?: string;
}


/*
|--------------------------------------------------------------------------
| Server WebSocket Messages
|--------------------------------------------------------------------------
*/

interface ServerMessage {
  type:
    | "CONNECTED"
    | "CALL_STARTED"
    | "CALL_ENDED"
    | "TRANSCRIPT"
    | "AI_RESPONSE"
    | "ERROR"
    | "PONG";

  callId?: string;
  message?: string;
  transcript?: string;
  isFinal?: boolean;
  response?: string;
}


/*
|--------------------------------------------------------------------------
| Send WebSocket Message
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Initialize Call WebSocket
|--------------------------------------------------------------------------
*/

export function initializeCallSocket(
  server: HttpServer,
): WebSocketServer {
  const wss =
    new WebSocketServer({
      server,
      path: "/ws/call",
    });


  /*
  |--------------------------------------------------------------------------
  | Services
  |--------------------------------------------------------------------------
  */

  const sttService =
    new DeepgramSttService();

  const geminiService =
    new GeminiLlmService();

  const conversationService =
    new ConversationService();


  /*
  |--------------------------------------------------------------------------
  | WebSocket Connection
  |--------------------------------------------------------------------------
  */

  wss.on(
    "connection",
    (socket) => {
      console.log(
        "WebSocket client connected.",
      );


      /*
      |--------------------------------------------------------------------------
      | Per-call state
      |--------------------------------------------------------------------------
      */

      let session:
        | CallSession
        | null = null;


      /*
      |--------------------------------------------------------------------------
      | Deepgram connection
      |--------------------------------------------------------------------------
      */

      let sttConnection:
        | Awaited<
            ReturnType<
              DeepgramSttService["createLiveConnection"]
            >
          >
        | null = null;


      /*
      |--------------------------------------------------------------------------
      | Conversation state
      |--------------------------------------------------------------------------
      |
      | Each WebSocket connection gets its own
      | conversation state.
      |
      */

      let conversationState =
        conversationService
          .createInitialState();


      /*
      |--------------------------------------------------------------------------
      | Gemini processing lock
      |--------------------------------------------------------------------------
      |
      | Prevent two FINAL transcripts from triggering
      | Gemini simultaneously.
      |
      */

      let isProcessingTranscript =
        false;


      /*
      |--------------------------------------------------------------------------
      | Connected
      |--------------------------------------------------------------------------
      */

      sendMessage(
        socket,
        {
          type: "CONNECTED",
          message:
            "WebSocket connection established.",
        },
      );


      /*
      |--------------------------------------------------------------------------
      | WebSocket Messages
      |--------------------------------------------------------------------------
      */

      socket.on(
        "message",
        async (
          rawMessage,
          isBinary,
        ) => {

          /*
          |--------------------------------------------------------------------------
          | BINARY AUDIO MESSAGE
          |--------------------------------------------------------------------------
          */

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


            /*
            |--------------------------------------------------------------------------
            | Only send audio while call is active.
            |--------------------------------------------------------------------------
            */

            if (
              sttConnection &&
              session?.status ===
                "active"
            ) {
              try {
                if (
                  sttConnection
                    .socket
                    .readyState ===
                  sttConnection
                    .socket
                    .OPEN
                ) {
                  sttConnection.socket.send(
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

                sendMessage(
                  socket,
                  {
                    type:
                      "ERROR",

                    callId:
                      session?.callId,

                    message:
                      "Failed to process audio.",
                  },
                );
              }
            }

            return;
          }


          /*
          |--------------------------------------------------------------------------
          | JSON CONTROL MESSAGE
          |--------------------------------------------------------------------------
          */

          try {
            const message =
              JSON.parse(
                rawMessage.toString(),
              ) as ClientMessage;


            switch (
              message.type
            ) {

              /*
              |--------------------------------------------------------------------------
              | START CALL
              |--------------------------------------------------------------------------
              */

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


                /*
                |--------------------------------------------------------------------------
                | Create new call session
                |--------------------------------------------------------------------------
                */

                session =
                  createCallSession();

                session.status =
                  "active";


                /*
                |--------------------------------------------------------------------------
                | Reset conversation state
                |--------------------------------------------------------------------------
                */

                conversationState =
                  conversationService
                    .createInitialState();


                /*
                |--------------------------------------------------------------------------
                | Reset Gemini processing lock
                |--------------------------------------------------------------------------
                */

                isProcessingTranscript =
                  false;


                console.log(
                  `Call started: ${session.callId}`,
                );


                /*
                |--------------------------------------------------------------------------
                | Create Deepgram connection
                |--------------------------------------------------------------------------
                */

                try {
                  sttConnection =
                    await sttService
                      .createLiveConnection();


                  console.log(
                    "Deepgram STT connection created.",
                  );


                  /*
                  |--------------------------------------------------------------------------
                  | Deepgram WebSocket OPEN
                  |--------------------------------------------------------------------------
                  */

                  sttConnection.on(
                    "open",
                    () => {
                      console.log(
                        "Deepgram STT WebSocket opened.",
                      );
                    },
                  );


                  /*
                  |--------------------------------------------------------------------------
                  | Deepgram MESSAGE
                  |--------------------------------------------------------------------------
                  */

                  sttConnection.on(
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


                        /*
                        |--------------------------------------------------------------------------
                        | Only process Results messages
                        |--------------------------------------------------------------------------
                        */

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


                        /*
                        |--------------------------------------------------------------------------
                        | Ignore empty transcript
                        |--------------------------------------------------------------------------
                        */

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


                        /*
                        |--------------------------------------------------------------------------
                        | Always send transcript to frontend.
                        |--------------------------------------------------------------------------
                        |
                        | Interim transcripts are useful for
                        | displaying live transcription.
                        |
                        */

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


                        /*
                        |--------------------------------------------------------------------------
                        | IMPORTANT:
                        |
                        | Only FINAL transcripts go to Gemini.
                        |--------------------------------------------------------------------------
                        */

                        if (
                          !isFinal
                        ) {
                          return;
                        }


                        /*
                        |--------------------------------------------------------------------------
                        | Ignore empty FINAL transcripts
                        |--------------------------------------------------------------------------
                        */

                        if (
                          !transcript
                            .trim()
                        ) {
                          return;
                        }


                        /*
                        |--------------------------------------------------------------------------
                        | Prevent concurrent Gemini calls
                        |--------------------------------------------------------------------------
                        */

                        if (
                          isProcessingTranscript
                        ) {
                          console.warn(
                            "Gemini is already processing a transcript. Skipping this transcript.",
                          );

                          return;
                        }


                        isProcessingTranscript =
                          true;


                        console.log(
                          "\n🎙️ FINAL USER TRANSCRIPT:",
                          transcript,
                        );


                        try {
                          /*
                          |--------------------------------------------------------------------------
                          | Build health screening prompt
                          |--------------------------------------------------------------------------
                          */

                          const prompt =
                            buildHealthScreeningPrompt(
                              conversationState,
                              transcript,
                            );


                          console.log(
                            "🤖 Sending transcript to Gemini...",
                          );


                          /*
                          |--------------------------------------------------------------------------
                          | Gemini
                          |--------------------------------------------------------------------------
                          */

                          const response =
                            await geminiService
                              .generateScreeningResponse(
                                prompt,
                              );


                          console.log(
                            "🤖 Gemini response:",
                            response.assistantResponse,
                          );


                          /*
                          |--------------------------------------------------------------------------
                          | Mark the current topic as answered.
                          |--------------------------------------------------------------------------
                          */

                          conversationState =
                            conversationService
                              .markTopicAsked(
                                conversationState,
                                conversationState.currentTopic,
                              );


                          /*
                          |--------------------------------------------------------------------------
                          | Normalize Gemini state update.
                          |--------------------------------------------------------------------------
                          */

                          const normalizedUpdate =
                            conversationService
                              .normalizeHealthUpdate(
                                conversationState,
                                response.stateUpdate,
                                transcript,
                              );


                          /*
                          |--------------------------------------------------------------------------
                          | Update health state.
                          |--------------------------------------------------------------------------
                          */

                          conversationState =
                            conversationService
                              .updateState(
                                conversationState,
                                normalizedUpdate,
                              );


                          /*
                          |--------------------------------------------------------------------------
                          | Add follow-up flags.
                          |--------------------------------------------------------------------------
                          */

                          conversationState =
                            conversationService
                              .addFollowUpFlags(
                                conversationState,
                                response.followUpFlags,
                              );


                          /*
                          |--------------------------------------------------------------------------
                          | Set next topic.
                          |--------------------------------------------------------------------------
                          */

                          conversationState =
                            conversationService
                              .setCurrentTopic(
                                conversationState,
                                response.nextTopic,
                              );


                          /*
                          |--------------------------------------------------------------------------
                          | Complete screening
                          |--------------------------------------------------------------------------
                          */

                          if (
                            response.isComplete
                          ) {
                            conversationState =
                              conversationService
                                .completeScreening(
                                  conversationState,
                                );
                          }


                          /*
                          |--------------------------------------------------------------------------
                          | Log conversation state
                          |--------------------------------------------------------------------------
                          */

                          console.log(
                            "🧠 Conversation state:",
                            JSON.stringify(
                              conversationState,
                              null,
                              2,
                            ),
                          );


                          /*
                          |--------------------------------------------------------------------------
                          | Send AI response to frontend
                          |--------------------------------------------------------------------------
                          */

                          sendMessage(
                            socket,
                            {
                              type:
                                "AI_RESPONSE",

                              callId:
                                session?.callId,

                              response:
                                response.assistantResponse,
                            },
                          );
                        } catch (
                          error
                        ) {
                          console.error(
                            "❌ Gemini screening error:",
                            error,
                          );


                          /*
                          |--------------------------------------------------------------------------
                          | Don't kill the call if Gemini fails.
                          |--------------------------------------------------------------------------
                          */

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
                        } finally {
                          isProcessingTranscript =
                            false;
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


                  /*
                  |--------------------------------------------------------------------------
                  | Deepgram ERROR
                  |--------------------------------------------------------------------------
                  */

                  sttConnection.on(
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


                  /*
                  |--------------------------------------------------------------------------
                  | Deepgram CLOSE
                  |--------------------------------------------------------------------------
                  */

                  sttConnection.on(
                    "close",
                    () => {
                      console.log(
                        "Deepgram STT WebSocket closed.",
                      );
                    },
                  );


                  /*
                  |--------------------------------------------------------------------------
                  | Connect Deepgram
                  |--------------------------------------------------------------------------
                  */

                  sttConnection.connect();

                  await sttConnection
                    .waitForOpen();


                  console.log(
                    "Deepgram STT connection ready.",
                  );
                } catch (
                  error
                ) {
                  console.error(
                    "Failed to create Deepgram connection:",
                    error,
                  );


                  session.status =
                    "ended";

                  sttConnection =
                    null;


                  sendMessage(
                    socket,
                    {
                      type:
                        "ERROR",

                      callId:
                        session.callId,

                      message:
                        "Unable to start speech recognition.",
                    },
                  );


                  break;
                }


                /*
                |--------------------------------------------------------------------------
                | Notify frontend that call has started
                |--------------------------------------------------------------------------
                */

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


                /*
                |--------------------------------------------------------------------------
                | Initial AI greeting
                |--------------------------------------------------------------------------
                |
                | For Phase 6.4.1 we send this as text.
                | TTS will be added later.
                |
                */

                sendMessage(
                  socket,
                  {
                    type:
                      "AI_RESPONSE",

                    callId:
                      session.callId,

                    response:
                      "Hello! Welcome to the health screening. Could you please tell me your name?",
                  },
                );


                break;
              }


              /*
              |--------------------------------------------------------------------------
              | END CALL
              |--------------------------------------------------------------------------
              */

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


                session.status =
                  "ended";


                console.log(
                  `Call ended: ${session.callId}`,
                );


                /*
                |--------------------------------------------------------------------------
                | Close Deepgram
                |--------------------------------------------------------------------------
                */

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


                /*
                |--------------------------------------------------------------------------
                | Send CALL_ENDED
                |--------------------------------------------------------------------------
                */

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


              /*
              |--------------------------------------------------------------------------
              | PING
              |--------------------------------------------------------------------------
              */

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


              /*
              |--------------------------------------------------------------------------
              | AUDIO_CHUNK as JSON
              |--------------------------------------------------------------------------
              */

              case "AUDIO_CHUNK": {
                console.warn(
                  "AUDIO_CHUNK received as JSON. Expected binary audio data.",
                );

                break;
              }


              /*
              |--------------------------------------------------------------------------
              | UNKNOWN MESSAGE
              |--------------------------------------------------------------------------
              */

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


      /*
      |--------------------------------------------------------------------------
      | CLIENT DISCONNECT
      |--------------------------------------------------------------------------
      */

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


      /*
      |--------------------------------------------------------------------------
      | WEBSOCKET ERROR
      |--------------------------------------------------------------------------
      */

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


  /*
  |--------------------------------------------------------------------------
  | Server Ready
  |--------------------------------------------------------------------------
  */

  console.log(
    "WebSocket server initialized at /ws/call",
  );


  return wss;
}