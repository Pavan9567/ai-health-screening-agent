import { useCallback, useEffect, useRef } from "react";
import {
  CallWebSocket,
  type WebSocketEventHandlers,
} from "../services/websocket";
import type { ClientMessage } from "../types/websocket";

export function useWebSocket() {
  const clientRef = useRef<CallWebSocket | null>(null);

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  const connect = useCallback(
    (
      url: string,
      handlers: WebSocketEventHandlers,
    ) => {
      const client = new CallWebSocket();

      clientRef.current = client;

      client.connect(url, handlers);
    },
    [],
  );

  const send = useCallback(
    (message: ClientMessage) => {
      clientRef.current?.send(message);
    },
    [],
  );

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
  }, []);

  return {
    connect,
    send,
    disconnect,
  };
}