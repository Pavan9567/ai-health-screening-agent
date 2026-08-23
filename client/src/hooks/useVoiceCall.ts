import { useCallback, useState } from "react";
import { useWebSocket } from "./useWebSocket";
import type {
  CallStatus,
  TranscriptMessage,
} from "../types/call";
import type { ServerMessage } from "../types/websocket";

const WS_URL =
  import.meta.env.VITE_WS_URL ??
  "ws://localhost:4000/ws/call";

export function useVoiceCall() {
  const [status, setStatus] =
    useState<CallStatus>("idle");

  const [messages] = useState<TranscriptMessage[]>([]);

  const [callId, setCallId] =
    useState<string | null>(null);

  const { connect, send, disconnect } =
    useWebSocket();

  const handleMessage = useCallback(
    (message: ServerMessage) => {
      switch (message.type) {
        case "CONNECTED":
          console.log(
            "WebSocket connected:",
            message.message,
          );
          break;

        case "CALL_STARTED":
          setCallId(message.callId ?? null);
          setStatus("active");
          break;

        case "CALL_ENDED":
          setStatus("ended");
          disconnect();
          break;

        case "ERROR":
          console.error(
            "WebSocket error:",
            message.message,
          );

          setStatus("idle");
          break;

        default:
          break;
      }
    },
    [disconnect],
  );

  const startCall = useCallback(() => {
    setStatus("connecting");

    connect(WS_URL, {
      onOpen: () => {
        send({
          type: "START_CALL",
        });
      },

      onMessage: handleMessage,

      onClose: () => {
        console.log(
          "WebSocket connection closed.",
        );
      },

      onError: (error) => {
        console.error(
          "WebSocket connection error:",
          error,
        );

        setStatus("idle");
      },
    });
  }, [connect, handleMessage, send]);

  const endCall = useCallback(() => {
    send({
      type: "END_CALL",
      callId: callId ?? undefined,
    });
  }, [callId, send]);

  return {
    status,
    messages,
    callId,
    startCall,
    endCall,
  };
}