import { randomUUID } from "node:crypto";
import type { ConversationState, } from "./healthScreening.js";
import { ConversationService, } from "../services/conversation.service.js";

export type CallStatus =
  | "connecting"
  | "active"
  | "ended";

export interface CallSession {
  callId: string;
  status: CallStatus;
  startedAt: string;
  conversationState: ConversationState;
}

const conversationService = new ConversationService();

export function createCallSession(): CallSession {
  return {
    callId: randomUUID(),
    status: "connecting",
    startedAt: new Date().toISOString(),
    conversationState: conversationService.createInitialState(),
  };
}