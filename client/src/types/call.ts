export type CallStatus =
  | "idle"
  | "connecting"
  | "active"
  | "processing"
  | "ended";

export type Speaker = "user" | "assistant";

export interface TranscriptMessage {
  id: string;
  speaker: Speaker;
  text: string;
  timestamp: string;
}

export interface CallState {
  status: CallStatus;
  messages: TranscriptMessage[];
  duration: number;
}