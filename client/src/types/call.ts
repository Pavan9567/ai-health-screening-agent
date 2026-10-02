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

export interface AIMessage {
  id: string;
  role: "assistant";
  text: string;
  timestamp: number;
}

export interface HealthScreeningReport {
  name: string | null;
  mainConcern: string | null;
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  relatedSymptoms: string[];
  followUpFlags: string[];
  summary: string;
  completed: boolean;
  disclaimer: string;
}