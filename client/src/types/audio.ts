export type AudioStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "stopped"
  | "error";

export interface AudioRecorderState {
  status: AudioStatus;
  error: string | null;
}