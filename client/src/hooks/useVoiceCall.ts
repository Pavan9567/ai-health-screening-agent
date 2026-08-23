import { useCallback, useState, } from "react";
import { useWebSocket } from "./useWebSocket";
import { useAudioRecorder } from "./useAudioRecorder";
import type { CallStatus, TranscriptMessage, } from "../types/call";
import type { ServerMessage, } from "../types/websocket";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:4000/ws/call";

export function useVoiceCall() {
  const [status, setStatus] = useState<CallStatus>("idle");
  const [messages] = useState<TranscriptMessage[]>([]);
  const [callId, setCallId] = useState<string | null>(null);
  const { connect, send, sendAudio, disconnect, } = useWebSocket();

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
        switch (message.type) {
          case "CONNECTED":
            console.log(
              "WebSocket connected:",
              message.message,
            );
            break;

          case "CALL_STARTED":
            setCallId(
              message.callId ?? null,
            );

            setStatus("active");

            void startRecording();

            break;

          case "CALL_ENDED":
            stopRecording();

            setStatus("ended");

            disconnect();

            break;

          case "ERROR":
            console.error(
              "WebSocket error:",
              message.message,
            );

            stopRecording();
            disconnect();

            setStatus("idle");

            break;

          default:
            break;
        }
      },
      [
        disconnect,
        startRecording,
        stopRecording,
      ],
    );

  const startCall =
    useCallback(() => {
      setStatus("connecting");

      connect(WS_URL, {
        onOpen: () => {
          send({
            type: "START_CALL",
          });
        },

        onMessage:
          handleMessage,

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

          setStatus("idle");
        },
      });
    }, [
      connect,
      handleMessage,
      send,
      stopRecording,
    ]);

  const endCall =
    useCallback(() => {
      stopRecording();

      send({
        type: "END_CALL",
        callId:
          callId ?? undefined,
      });
    }, [
      callId,
      send,
      stopRecording,
    ]);

  return {
    status,
    messages,
    callId,

    audioStatus,
    audioError,

    startCall,
    endCall,
  };
}