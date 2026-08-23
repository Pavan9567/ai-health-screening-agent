export type ClientMessageType =
  | "START_CALL"
  | "END_CALL"
  | "PING";

export type ServerMessageType =
  | "CONNECTED"
  | "CALL_STARTED"
  | "CALL_ENDED"
  | "ERROR"
  | "PONG";

export interface ClientMessage {
  type: ClientMessageType;
  callId?: string;
}

export interface ServerMessage {
  type: ServerMessageType;
  callId?: string;
  message?: string;
}