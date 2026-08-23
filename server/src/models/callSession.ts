export interface CallSession {
  callId: string;
  createdAt: string;
  status:
    | "connecting"
    | "active"
    | "ended";
}

export function createCallSession(): CallSession {
  return {
    callId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "connecting",
  };
}