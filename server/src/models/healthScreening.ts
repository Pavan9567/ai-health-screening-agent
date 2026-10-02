export type ScreeningTopic =
  | "name"
  | "mainConcern"
  | "duration"
  | "severity"
  | "relatedSymptoms"
  | "complete";

export interface HealthScreeningState {
  name: string | null;
  mainConcern: string | null;
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  relatedSymptoms: string[];
  followUpFlags: string[];
}

export interface ConversationState {
  health: HealthScreeningState;
  askedQuestions: ScreeningTopic[];
  currentTopic: ScreeningTopic;
  turnCount: number;
  isComplete: boolean;
}

export interface HealthStateUpdate {
  name?: string;
  mainConcern?: string;
  symptoms?: string[];
  duration?: string;
  severity?: string;
  relatedSymptoms?: string[];
  followUpFlags?: string[];
}

export interface ScreeningAgentResponse {
  assistantResponse: string;
  stateUpdate: HealthStateUpdate;
  nextTopic: ScreeningTopic;
  followUpFlags: string[];
  isComplete: boolean;
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