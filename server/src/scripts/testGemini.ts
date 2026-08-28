import {
  GeminiLlmService,
} from "../services/llm.service.js";

async function main() {
  const llm =
    new GeminiLlmService();

  const response =
    await llm.generateText(
      "Reply with exactly: Gemini connection successful.",
    );

  console.log(
    "🤖 Gemini response:",
    response,
  );
}

main().catch((error) => {
  console.error(
    "❌ Gemini test failed:",
    error,
  );

  process.exit(1);
});