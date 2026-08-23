import { useCallback, useState, } from "react";

import { useWebSocket } from "./useWebSocket";
import { useAudioRecorder } from "./useAudioRecorder";

import type { CallStatus, TranscriptMessage, } from "../types/call";

import type { ServerMessage, } from "../types/websocket";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws/call";

export function useVoiceCall() {
  const [status, setStatus] =
    useState<CallStatus>("idle");

  const [
    messages,
    setMessages,
  ] = useState<TranscriptMessage[]>([]);

  const [
    liveTranscript,
    setLiveTranscript,
  ] = useState("");

  const [callId, setCallId] =
    useState<string | null>(null);

  const {
    connect,
    send,
    sendAudio,
    disconnect,
  } = useWebSocket();

  const {
    status: audioStatus,
    error: audioError,
    startRecording,
    stopRecording,
  } = useAudioRecorder({
    onAudioChunk: sendAudio,
  });

  const handleMessage =
    useCallback(
      (message: ServerMessage) => {
        console.log(
          "Server WebSocket message:",
          message,
        );

        switch (message.type) {
          // WEBSOCKET CONNECTED
          case "CONNECTED": {
            console.log(
              "WebSocket connected:",
              message.message,
            );

            break;
          }

          // CALL STARTED
          case "CALL_STARTED": {
            setCallId(
              message.callId ?? null,
            );

            setStatus("active");

            void startRecording();
            break;
          }

          // TRANSCRIPT
          case "TRANSCRIPT": {
            const transcript = message.transcript?.trim();

            if (!transcript) {
              break;
            }

            console.log(
              "Transcript received:",
              transcript,
              "Final:",
              message.isFinal,
            );

            /*
             * ----------------------------------------
             * INTERIM TRANSCRIPT
             * ----------------------------------------
             *
             * This is the text Deepgram is currently
             * recognizing while the user is speaking.
             */
            if (!message.isFinal) {
              setLiveTranscript(
                transcript,
              );

              break;
            }

            /*
             * ----------------------------------------
             * FINAL TRANSCRIPT
             * ----------------------------------------
             *
             * Store the final transcript permanently
             * in the conversation history.
             */
            setMessages(
              (currentMessages) => [
                ...currentMessages,
                {
                  id: crypto.randomUUID(),
                  speaker: "user",
                  text: transcript,
                  timestamp:
                    new Date().toISOString(),
                },
              ],
            );

            setLiveTranscript("");
            break;
          }

          // CALL ENDED
          case "CALL_ENDED": {
            stopRecording();

            setLiveTranscript("");

            setStatus("ended");

            disconnect();

            break;
          }

          // SERVER ERROR
          case "ERROR": {
            console.error(
              "WebSocket error:",
              message.message,
            );

            stopRecording();

            setLiveTranscript("");

            disconnect();

            setStatus("idle");

            break;
          }

          // PONG
          case "PONG": {
            console.log(
              "WebSocket pong received.",
            );

            break;
          }

          // UNKNOWN
          default: {
            console.warn(
              "Unknown server message:",
              message,
            );
          }
        }
      },
      [
        disconnect,
        startRecording,
        stopRecording,
      ],
    );

  // START CALL
  const startCall =
    useCallback(() => {
      // Clear previous conversation when starting a new call.
      setMessages([]);

      setLiveTranscript("");

      setCallId(null);

      setStatus("connecting");

      connect(WS_URL, {
        onOpen: () => {
          console.log(
            "WebSocket connection opened.",
          );

          send({
            type: "START_CALL",
          });
        },

        onMessage: handleMessage,

        onClose: () => {
          console.log(
            "WebSocket connection closed.",
          );

          stopRecording();
        },

        onError: (error) => {
          console.error(
            "WebSocket connection error:",
            error,
          );

          stopRecording();

          setLiveTranscript("");

          setStatus("idle");
        },
      });
    }, [
      connect,
      handleMessage,
      send,
      stopRecording,
    ]);

  // END CALL
  const endCall =
    useCallback(() => {
      stopRecording();

      // Clear temporary interim transcript.
      setLiveTranscript("");

      send({
        type: "END_CALL",
        callId: callId ?? undefined,
      });
    }, [
      callId,
      send,
      stopRecording,
    ]);

  return {
    status,
    messages,
    liveTranscript,
    callId,
    audioStatus,
    audioError,
    startCall,
    endCall,
  };
}