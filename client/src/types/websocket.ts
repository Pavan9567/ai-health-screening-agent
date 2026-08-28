export type ClientMessageType =
  | "START_CALL"
  | "END_CALL"
  | "AUDIO_CHUNK"
  | "PING";

export type ServerMessageType =
  | "CONNECTED"
  | "CALL_STARTED"
  | "CALL_ENDED"
  | "TRANSCRIPT"
  | "AI_RESPONSE"
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

  transcript?: string;
  isFinal?: boolean;
  response?: string;
}

export interface AI_RESPONSE_MESSAGE {
  type: "AI_RESPONSE";
  callId: string;
  response: string;
}