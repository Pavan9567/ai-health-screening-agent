import {
  ConversationService,
} from "../services/conversation.service.js";

async function main() {
  const service =
    new ConversationService();

  let state =
    service.createInitialState();

  console.log(
    "Initial state:",
    JSON.stringify(
      state,
      null,
      2,
    ),
  );

  state =
    service.updateState(
      state,
      {
        name: "Pawan",
      },
    );

  state =
    service.markTopicAsked(
      state,
      "name",
    );

  state =
    service.setCurrentTopic(
      state,
      "mainConcern",
    );

  console.log(
    "\nAfter name:",
    JSON.stringify(
      state,
      null,
      2,
    ),
  );

  console.log(
    "\nMissing topics:",
    service.getMissingTopics(
      state,
    ),
  );
}

main().catch((error) => {
  console.error(
    "❌ Conversation state test failed:",
    error,
  );

  process.exit(1);
});