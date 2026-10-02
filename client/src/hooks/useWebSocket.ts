import {
  useCallback,
  useEffect,
  useRef,
} from "react";

import {
  CallWebSocket,
  type WebSocketEventHandlers,
} from "../services/websocket";

import type {
  ClientMessage,
} from "../types/websocket";


export function useWebSocket() {
  const clientRef =
    useRef<
      CallWebSocket | null
    >(null);


  useEffect(() => {
    return () => {
      clientRef.current
        ?.disconnect();
    };
  }, []);


  /*
  |--------------------------------------------------------------------------
  | Connect
  |--------------------------------------------------------------------------
  */

  const connect =
    useCallback(
      (
        url: string,
        handlers:
          WebSocketEventHandlers,
      ) => {
        const client =
          new CallWebSocket();


        clientRef.current =
          client;


        client.connect(
          url,
          handlers,
        );
      },
      [],
    );


  /*
  |--------------------------------------------------------------------------
  | Send JSON
  |--------------------------------------------------------------------------
  */

  const send =
    useCallback(
      (
        message: ClientMessage,
      ) => {
        clientRef.current
          ?.send(message);
      },
      [],
    );


  /*
  |--------------------------------------------------------------------------
  | Send microphone audio
  |--------------------------------------------------------------------------
  */

  const sendAudio =
    useCallback(
      (
        chunk: Blob,
      ) => {
        clientRef.current
          ?.sendAudio(chunk);
      },
      [],
    );


  /*
  |--------------------------------------------------------------------------
  | Disconnect
  |--------------------------------------------------------------------------
  */

  const disconnect =
    useCallback(() => {
      clientRef.current
        ?.disconnect();

      clientRef.current =
        null;
    }, []);


  return {
    connect,
    send,
    sendAudio,
    disconnect,
  };
}