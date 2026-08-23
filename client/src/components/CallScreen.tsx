import { Phone, ShieldCheck } from "lucide-react";
import type { CallStatus } from "../types/call";

interface CallScreenProps {
  status: CallStatus;
  onStartCall: () => void;
  onEndCall: () => void;
}

function CallScreen({
  status,
  onStartCall,
  onEndCall,
}: CallScreenProps) {
  const isActive =
    status === "active" ||
    status === "connecting" ||
    status === "processing";

  return (
    <section className="call-screen">
      <div className="call-card">
        <div className="security-badge">
          <ShieldCheck size={16} />
          <span>Private screening session</span>
        </div>

        <div
          className={`assistant-avatar ${
            isActive ? "assistant-avatar-active" : ""
          }`}
        >
          <div className="avatar-inner">
            <span>AI</span>
          </div>
        </div>

        <p className="call-label">
          {status === "idle" && "Ready when you are"}
          {status === "connecting" && "Connecting..."}
          {status === "active" && "AI Health Assistant"}
          {status === "processing" && "Processing..."}
          {status === "ended" && "Call ended"}
        </p>

        <h1>
          {status === "idle"
            ? "Start your health screening"
            : status === "active"
              ? "You're now connected"
              : status === "connecting"
                ? "Starting your call..."
                : status === "processing"
                  ? "Processing your response..."
                  : "Your screening is complete"}
        </h1>

        <p className="call-description">
          {status === "idle"
            ? "Have a short conversation with our AI health screening assistant."
            : status === "active"
              ? "Speak naturally. I'll ask one question at a time."
              : status === "connecting"
                ? "Please wait while we establish your secure connection."
                : status === "processing"
                  ? "We're processing your response."
                  : "Your health screening information has been collected."}
        </p>

        {!isActive && status !== "ended" && (
          <button
            className="primary-button"
            type="button"
            onClick={onStartCall}
          >
            <Phone size={20} />
            Start Call
          </button>
        )}

        {isActive && (
          <button
            className="end-call-button"
            type="button"
            onClick={onEndCall}
          >
            End Call
          </button>
        )}
      </div>
    </section>
  );
}

export default CallScreen;