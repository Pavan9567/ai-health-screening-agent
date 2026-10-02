import type {
  ClientMessage,
  ServerMessage,
} from "../types/websocket";


export type WebSocketEventHandlers = {
  onOpen?: () => void;

  onMessage?: (
    message: ServerMessage,
  ) => void;

  onAudio?: (
    audio: Blob,
  ) => void;

  onClose?: () => void;

  onError?: (
    error: Event,
  ) => void;
};


export class CallWebSocket {
  private socket: WebSocket | null = null;


  connect(
    url: string,
    handlers: WebSocketEventHandlers,
  ): void {
    this.socket =
      new WebSocket(url);


    /*
    |--------------------------------------------------------------------------
    | WebSocket opened
    |--------------------------------------------------------------------------
    */

    this.socket.onopen = () => {
      handlers.onOpen?.();
    };


    /*
    |--------------------------------------------------------------------------
    | Incoming messages
    |--------------------------------------------------------------------------
    |
    | Server messages can be either:
    |
    | 1. JSON text
    | 2. Binary audio data
    |
    */

    this.socket.onmessage = (
      event: MessageEvent,
    ) => {

      /*
      |--------------------------------------------------------------------------
      | JSON message
      |--------------------------------------------------------------------------
      */

      if (
        typeof event.data ===
        "string"
      ) {
        try {
          const message =
            JSON.parse(
              event.data,
            ) as ServerMessage;


          handlers.onMessage?.(
            message,
          );

        } catch (error) {
          console.error(
            "Failed to parse WebSocket message:",
            error,
          );
        }


        return;
      }


      /*
      |--------------------------------------------------------------------------
      | Binary Blob audio
      |--------------------------------------------------------------------------
      */

      if (
        event.data instanceof Blob
      ) {
        console.log(
          `🔊 Received audio chunk: ${event.data.size} bytes`,
        );


        handlers.onAudio?.(
          event.data,
        );


        return;
      }


      /*
      |--------------------------------------------------------------------------
      | Binary ArrayBuffer audio
      |--------------------------------------------------------------------------
      */

      if (
        event.data instanceof ArrayBuffer
      ) {
        const audioBlob =
          new Blob([
            event.data,
          ], {
            type:
              "audio/wav",
          });


        console.log(
          `🔊 Received audio ArrayBuffer: ${audioBlob.size} bytes`,
        );


        handlers.onAudio?.(
          audioBlob,
        );


        return;
      }


      /*
      |--------------------------------------------------------------------------
      | Unsupported message type
      |--------------------------------------------------------------------------
      */

      console.warn(
        "Unsupported WebSocket message type:",
        typeof event.data,
      );
    };


    /*
    |--------------------------------------------------------------------------
    | WebSocket closed
    |--------------------------------------------------------------------------
    */

    this.socket.onclose = () => {
      handlers.onClose?.();
    };


    /*
    |--------------------------------------------------------------------------
    | WebSocket error
    |--------------------------------------------------------------------------
    */

    this.socket.onerror = (
      error,
    ) => {
      handlers.onError?.(
        error,
      );
    };
  }


  /*
  |--------------------------------------------------------------------------
  | Send JSON message
  |--------------------------------------------------------------------------
  */

  send(
    message: ClientMessage,
  ): void {
    if (!this.socket) {
      console.warn(
        "WebSocket is not connected.",
      );

      return;
    }


    if (
      this.socket.readyState !==
      WebSocket.OPEN
    ) {
      console.warn(
        "WebSocket is not ready.",
      );

      return;
    }


    this.socket.send(
      JSON.stringify(
        message,
      ),
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Send microphone audio
  |--------------------------------------------------------------------------
  */

  sendAudio(
    chunk: Blob,
  ): void {
    if (!this.socket) {
      console.warn(
        "WebSocket is not connected.",
      );

      return;
    }


    if (
      this.socket.readyState !==
      WebSocket.OPEN
    ) {
      console.warn(
        "WebSocket is not ready.",
      );

      return;
    }


    this.socket.send(
      chunk,
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Disconnect
  |--------------------------------------------------------------------------
  */

  disconnect(): void {
    this.socket?.close();

    this.socket = null;
  }


  /*
  |--------------------------------------------------------------------------
  | Ready state
  |--------------------------------------------------------------------------
  */

  get readyState():
    number | undefined {
    return this.socket
      ?.readyState;
  }
}