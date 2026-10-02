import type { HealthScreeningReport } from "./call";

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
  | "AUDIO_START"
  | "AUDIO_END"
  | "SCREENING_COMPLETE"
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
  report?: HealthScreeningReport;
}

export interface AI_RESPONSE_MESSAGE {
  type: "AI_RESPONSE";
  callId: string;
  response: string;
}

export interface AUDIO_START_MESSAGE {
  type: "AUDIO_START";
  callId?: string;
}

export interface AUDIO_END_MESSAGE {
  type: "AUDIO_END";
  callId?: string;
}