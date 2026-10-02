// import dotenv from "dotenv";

// dotenv.config();

// const port = Number(process.env.PORT ?? 4000);

// if (Number.isNaN(port)) {
//   throw new Error("PORT must be a valid number.");
// }

// export const env = {
//   port,

//   clientUrl:
//     process.env.CLIENT_URL ??
//     "http://localhost:5173",

//   geminiApiKey:
//     process.env.GEMINI_API_KEY ?? "",

//   sttApiKey:
//     process.env.STT_API_KEY ?? "",

//   ttsApiKey:
//     process.env.TTS_API_KEY ?? "",
// };

import dotenv from "dotenv";

dotenv.config();

const port =
  Number(
    process.env.PORT ?? 4000,
  );

if (Number.isNaN(port)) {
  throw new Error(
    "PORT must be a valid number.",
  );
}

export const env = {
  port,

  clientUrl:
    process.env.CLIENT_URL ??
    "http://localhost:5173",

  geminiApiKey:
    process.env.GEMINI_API_KEY ?? "",

  geminiTtsModel:
    process.env.GEMINI_TTS_MODEL ??
    "gemini-3.1-flash-tts-preview",

  geminiTtsVoice:
    process.env.GEMINI_TTS_VOICE ?? "Kore",

  sttApiKey:
    process.env.STT_API_KEY ?? "",

  ttsApiKey:
    process.env.TTS_API_KEY ?? "",
};