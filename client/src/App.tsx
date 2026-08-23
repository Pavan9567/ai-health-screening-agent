import CallScreen from "./components/CallScreen";
import ConversationPanel from "./components/ConversationPanel";
import HealthReport, {
  type HealthReportData,
} from "./components/HealthReport";
import { useVoiceCall } from "./hooks/useVoiceCall";

function App() {
  const {
    status,
    messages,
    startCall,
    endCall,
  } = useVoiceCall();

  const report: HealthReportData | null =
    status === "ended"
      ? {
          mainConcern: "Not collected",
          symptoms: [],
          duration: "Not collected",
          severity: "Not collected",
          followUp:
            "The call ended before enough information could be collected.",
        }
      : null;

  return (
    <main className="app">
      <div className="app-shell">
        <header className="app-header">
          <div className="brand">
            <div className="brand-mark">
              AI
            </div>

            <div>
              <strong>
                HealthScreen AI
              </strong>

              <span>
                Voice Screening Assistant
              </span>
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
            onStartCall={startCall}
            onEndCall={endCall}
          />

          {status !== "idle" && (
            <ConversationPanel
              messages={messages}
            />
          )}

          {status === "ended" &&
            report && (
              <HealthReport
                report={report}
              />
            )}
        </div>
      </div>
    </main>
  );
}

export default App;