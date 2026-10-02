import { GoogleGenAI, } from "@google/genai";
import { env, } from "../config/env.js";

// WAV Helper
function createWavBuffer(
  pcmAudio: Buffer,
  sampleRate = 24000,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const header =
    Buffer.alloc(44);


  const byteRate = sampleRate * channels * (bitsPerSample / 8);

  const blockAlign = channels * (bitsPerSample / 8);

  // RIFF header
  header.write(
    "RIFF",
    0,
    4,
    "ascii",
  );


  header.writeUInt32LE(
    36 + pcmAudio.length,
    4,
  );


  header.write(
    "WAVE",
    8,
    4,
    "ascii",
  );


  // fmt chunk
  header.write(
    "fmt ",
    12,
    4,
    "ascii",
  );


  header.writeUInt32LE(
    16,
    16,
  );


  // Audio format  1 = PCM

  header.writeUInt16LE(
    1,
    20,
  );


  header.writeUInt16LE(
    channels,
    22,
  );


  header.writeUInt32LE(
    sampleRate,
    24,
  );


  header.writeUInt32LE(
    byteRate,
    28,
  );


  header.writeUInt16LE(
    blockAlign,
    32,
  );


  header.writeUInt16LE(
    bitsPerSample,
    34,
  );


  // data chunk
  header.write("data", 36, 4, "ascii",);

  header.writeUInt32LE(
    pcmAudio.length,
    40,
  );

  // Combine WAV header + PCM
  return Buffer.concat([
    header,
    pcmAudio,
  ]);
}


export class GeminiTtsService {
  private readonly client: GoogleGenAI;

  private readonly model: string;

  private readonly voice: string;


  constructor() {
    if (!env.geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured.",
      );
    }


    this.client =
      new GoogleGenAI({
        apiKey:
          env.geminiApiKey,
      });


    this.model = env.geminiTtsModel;

    this.voice = env.geminiTtsVoice;
  }


  // Generate PCM Speech
  async generateSpeech(
    text: string,
  ): Promise<Buffer> {
    const cleanText =
      text.trim();


    if (!cleanText) {
      throw new Error(
        "TTS text cannot be empty.",
      );
    }


    console.log(
      "Generating Gemini TTS...",
    );


    const interaction =
      await this.client
        .interactions
        .create({
          model: this.model,

          input: cleanText,

          response_format: {
            type: "audio",
          },

          generation_config: {
            speech_config: [
              {
                voice:
                  this.voice,
              },
            ],
          },
        });


    const audioData =
      interaction
        .output_audio
        ?.data;


    if (!audioData) {
      throw new Error(
        "Gemini TTS returned no audio data.",
      );
    }


    const audioBuffer =
      Buffer.from(
        audioData,
        "base64",
      );


    console.log(`Gemini TTS generated ${audioBuffer.length} bytes.`,);

    return audioBuffer;
  }


  // Generate WAV Speech
  async generateSpeechWav(
    text: string,
  ): Promise<Buffer> {
    const pcmAudio =
      await this.generateSpeech(
        text,
      );


    const wavAudio =
      createWavBuffer(
        pcmAudio,
      );


    console.log(
      `Gemini TTS WAV generated ${wavAudio.length} bytes.`,
    );


    return wavAudio;
  }
}