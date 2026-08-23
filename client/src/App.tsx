import { useState } from "react";
import CallScreen from "./components/CallScreen";
import ConversationPanel from "./components/ConversationPanel";
import HealthReport, {
  type HealthReportData,
} from "./components/HealthReport";
import type {
  CallStatus,
  TranscriptMessage,
} from "./types/call";

function App() {
  const [status, setStatus] = useState<CallStatus>("idle");

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);

  const [report, setReport] = useState<HealthReportData | null>(null);

  const handleStartCall = () => {
    setStatus("connecting");

    setTimeout(() => {
      setStatus("active");

      const greeting: TranscriptMessage = {
        id: crypto.randomUUID(),
        speaker: "assistant",
        text: "Hello! I'm your AI health screening assistant. I'll ask you a few questions about how you're feeling. Let's start with your name.",
        timestamp: new Date().toISOString(),
      };

      setMessages([greeting]);
    }, 1000);
  };

  const handleEndCall = () => {
    setStatus("ended");

    setReport({
      mainConcern: "Not collected",
      symptoms: [],
      duration: "Not collected",
      severity: "Not collected",
      followUp:
        "The call ended before enough information could be collected.",
    });
  };

  return (
    <main className="app">
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <div className="brand-mark">AI</div>

            <div>
              <strong>HealthScreen AI</strong>
              <span>Voice Screening Assistant</span>
            </div>
          </div>

          <div className="header-status">
            <span className="status-dot" />
            AI Assistant
          </div>
        </header>

        <div className="main-content">
          <CallScreen
            status={status}
            onStartCall={handleStartCall}
            onEndCall={handleEndCall}
          />

          {status !== "idle" && (
            <ConversationPanel messages={messages} />
          )}

          {status === "ended" && report && (
            <HealthReport report={report} />
          )}
        </div>
      </div>
    </main>
  );
}

export default App;