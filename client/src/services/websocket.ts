import type {
  ClientMessage,
  ServerMessage,
} from "../types/websocket";

export type WebSocketEventHandlers = {
  onOpen?: () => void;
  onMessage?: (message: ServerMessage) => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
};

export class CallWebSocket {
  private socket: WebSocket | null = null;

  connect(
    url: string,
    handlers: WebSocketEventHandlers,
  ): void {
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      handlers.onOpen?.();
    };

    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(
          event.data,
        ) as ServerMessage;

        handlers.onMessage?.(message);
      } catch (error) {
        console.error(
          "Failed to parse WebSocket message:",
          error,
        );
      }
    };

    this.socket.onclose = () => {
      handlers.onClose?.();
    };

    this.socket.onerror = (error) => {
      handlers.onError?.(error);
    };
  }

  send(message: ClientMessage): void {
    if (!this.socket) {
      console.warn("WebSocket is not connected.");
      return;
    }

    if (this.socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket is not ready.");
      return;
    }

    this.socket.send(JSON.stringify(message));
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  get readyState(): number | undefined {
    return this.socket?.readyState;
  }
}