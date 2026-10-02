import CallScreen from "./components/CallScreen";
import ConversationPanel from "./components/ConversationPanel";
import HealthReport from "./components/HealthReport";
import { useVoiceCall } from "./hooks/useVoiceCall";

function App() {
  const {
    status,
    messages,
    isThinking,
    isAiSpeaking,
    liveTranscript,
    audioStatus,
    audioError,
    screeningReport,
    startCall,
    endCall,
  } = useVoiceCall();

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
            audioStatus={audioStatus}
            audioError={audioError}
            onStartCall={startCall}
            onEndCall={endCall}
          />

          {status !== "idle" && (
            <ConversationPanel
              messages={messages}
              liveTranscript={
                liveTranscript
              }
              isThinking={isThinking}
              isAiSpeaking={
                isAiSpeaking
              }
            />
          )}

          {status === "ended" &&
            screeningReport && (
              <HealthReport
                report={
                  screeningReport
                }
              />
            )}
        </div>
      </div>
    </main>
  );
}

export default App;