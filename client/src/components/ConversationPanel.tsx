import { MessageCircle } from "lucide-react";
import type { TranscriptMessage } from "../types/call";

interface ConversationPanelProps {
  messages: TranscriptMessage[];
}

function ConversationPanel({
  messages,
}: ConversationPanelProps) {
  return (
    <section className="conversation-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">LIVE TRANSCRIPT</p>
          <h2>Conversation</h2>
        </div>

        <MessageCircle size={20} />
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-conversation">
            <p>
              Your conversation will appear here once the call starts.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <article
              key={message.id}
              className={`message message-${message.speaker}`}
            >
              <div className="message-label">
                {message.speaker === "assistant"
                  ? "AI Assistant"
                  : "You"}
              </div>

              <p>{message.text}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default ConversationPanel;