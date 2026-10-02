import { MessageCircle } from "lucide-react";

import type {
  TranscriptMessage,
} from "../types/call";


interface ConversationPanelProps {
  messages: TranscriptMessage[];
  liveTranscript: string;
  isThinking: boolean;
  isAiSpeaking: boolean;
}


function ConversationPanel({
  messages,
  liveTranscript,
  isThinking,
  isAiSpeaking,
}: ConversationPanelProps) {
  const hasConversation =
    messages.length > 0 ||
    Boolean(liveTranscript) ||
    isThinking;


  const latestMessage =
    messages[
      messages.length - 1
  ];

  return (
    <section className="conversation-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">
            LIVE TRANSCRIPT
          </p>

          <h2>
            Conversation
          </h2>
        </div>

        <MessageCircle
          size={20}
        />
      </div>


      <div className="messages">
        {!hasConversation ? (
          <div className="empty-conversation">
            <p>
              Your conversation will appear here once the call starts.
            </p>
          </div>
        ) : (
          <>
            {messages.map(
              (message) => (
                <article
                  key={message.id}
                  className={`message message-${message.speaker}`}
                >
                  <div className="message-label">
                    {message.speaker ===
                    "assistant"
                      ? "AI Assistant"
                      : "You"}
                  </div>

                  <p>
                    {message.text}
                  </p>

                  {message.speaker ===
                    "assistant" &&
                    isAiSpeaking &&
                    message.id ===
                      latestMessage?.id && (
                      <div className="ai-speaking-indicator">
                        <span className="speaking-dot" />
                        <span>
                          Speaking...
                        </span>
                      </div>
                    )}
                </article>
              ),
            )}


            {liveTranscript && (
              <article className="message message-user interim-message">
                <div className="message-label">
                  You
                </div>

                <p>
                  {liveTranscript}

                  <span className="transcript-cursor">
                    ...
                  </span>
                </p>
              </article>
            )}


            {isThinking && (
              <article className="message message-assistant thinking-message">
                <div className="message-label">
                  AI Assistant
                </div>

                <div className="thinking-content">
                  <span>
                    Thinking
                  </span>

                  <span className="thinking-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </div>
              </article>
            )}
          </>
        )}
      </div>
    </section>
  );
}


export default ConversationPanel;