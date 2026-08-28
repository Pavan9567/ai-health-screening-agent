import {
  GeminiLlmService,
} from "../services/llm.service.js";

import {
  ConversationService,
} from "../services/conversation.service.js";

import {
  buildHealthScreeningPrompt,
} from "../prompts/healthScreening.js";

async function main() {
  const llm =
    new GeminiLlmService();

  const conversation =
    new ConversationService();

  let state =
    conversation.createInitialState();

  /*
   * ============================================
   * TURN 1
   * ============================================
   */

  const userMessage1 =
    "Hello, my name is Pawan.";

  const prompt1 =
    buildHealthScreeningPrompt(
      state,
      userMessage1,
    );

  const response1 =
    await llm.generateScreeningResponse(
      prompt1,
    );

  console.log(
    "\n========== TURN 1 ==========",
  );

  console.log(
    "User:",
    userMessage1,
  );

  console.log(
    "Gemini:",
    JSON.stringify(
      response1,
      null,
      2,
    ),
  );

  /*
   * The user answered the current topic.
   *
   * Initially currentTopic = "name".
   */
  state =
    conversation.markTopicAsked(
      state,
      state.currentTopic,
    );

  /*
   * Apply Gemini's extracted information.
   */
  const normalizedUpdate1 =
    conversation.normalizeHealthUpdate(
        state,
        response1.stateUpdate,
        userMessage1,
  );

  state =
    conversation.updateState(
        state,
        normalizedUpdate1,
  );
  /*
   * Store any follow-up flags.
   */
  state =
    conversation.addFollowUpFlags(
      state,
      response1.followUpFlags,
    );

  /*
   * Gemini's nextTopic means:
   * "This is what we should ask next."
   */
  state =
    conversation.setCurrentTopic(
      state,
      response1.nextTopic,
    );

  /*
   * ============================================
   * TURN 2
   * ============================================
   */

  const userMessage2 =
    "I've been having headaches for about two weeks.";

  const prompt2 =
    buildHealthScreeningPrompt(
      state,
      userMessage2,
    );

  const response2 =
    await llm.generateScreeningResponse(
      prompt2,
    );

  console.log(
    "\n========== TURN 2 ==========",
  );

  console.log(
    "User:",
    userMessage2,
  );

  console.log(
    "Gemini:",
    JSON.stringify(
      response2,
      null,
      2,
    ),
  );

  /*
   * The user answered the topic that
   * Gemini asked about in Turn 1.
   *
   * currentTopic should currently be
   * "mainConcern".
   */
  state =
    conversation.markTopicAsked(
      state,
      state.currentTopic,
    );

  /*
   * Apply extracted information.
   */
  const normalizedUpdate2 = conversation.normalizeHealthUpdate(state, response2.stateUpdate, userMessage2,);

  state =
    conversation.updateState(
        state,
        normalizedUpdate2,
  );

  /*
   * Persist follow-up flags.
   */
  state =
    conversation.addFollowUpFlags(
      state,
      response2.followUpFlags,
    );

  /*
   * Store Gemini's next topic.
   */
  state =
    conversation.setCurrentTopic(
      state,
      response2.nextTopic,
    );

  /*
   * ============================================
   * FINAL STATE
   * ============================================
   */

  console.log(
    "\n========== FINAL STATE ==========",
  );

  console.log(
    JSON.stringify(
      state,
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    "❌ Screening test failed:",
    error,
  );

  process.exit(1);
});