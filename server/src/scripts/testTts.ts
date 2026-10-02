import fs from "node:fs/promises";

import {
  GeminiTtsService,
} from "../services/tts.service.js";


async function main() {
  console.log(
    "================================",
  );

  console.log(
    "Gemini TTS Test",
  );

  console.log(
    "================================",
  );


  const tts =
    new GeminiTtsService();


  const text =
    "Hello Pavan. Welcome to the health screening. Could you please tell me your name?";


  console.log(
    "\nText:",
    text,
  );


  const wavAudio =
    await tts.generateSpeechWav(
      text,
    );


  const outputPath =
    "test-tts-output.wav";


  await fs.writeFile(
    outputPath,
    wavAudio,
  );


  console.log(
    `\n✅ TTS test successful.`,
  );


  console.log(
    `🎵 WAV file created: ${outputPath}`,
  );


  console.log(
    `🎵 WAV size: ${wavAudio.length} bytes`,
  );
}


main()
  .catch(
    (error) => {
      console.error(
        "\n❌ TTS test failed:",
        error,
      );

      process.exit(1);
    },
  );