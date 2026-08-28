import { GoogleGenAI, Type, } from "@google/genai";
import { env } from "../config/env.js";
import type { ScreeningAgentResponse, ScreeningTopic, } from "../models/healthScreening.js";

const MAX_GEMINI_RETRIES = 3;
const GEMINI_RETRY_DELAYS = [1000, 2000, 4000,];

export class GeminiLlmService {
  private readonly client: GoogleGenAI;

  constructor() {
    if (!env.geminiApiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured.",
      );
    }

    this.client = new GoogleGenAI({
      apiKey: env.geminiApiKey,
    });
  }


  async generateText(
    prompt: string,
  ): Promise<string> {
    const response =
      await this.generateWithRetry(
        () =>
          this.client.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
          }),
      );

    const text =
      response.text?.trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty response.",
      );
    }

    return text;
  }

  async generateScreeningResponse(
    prompt: string,
  ): Promise<ScreeningAgentResponse> {
    const response =
      await this.generateWithRetry(
        () =>
          this.client.models.generateContent({
            model: "gemini-3.6-flash",

            contents: prompt,

            config: {
              responseMimeType:
                "application/json",

              responseSchema: {
                type: Type.OBJECT,

                properties: {
                  assistantResponse: {
                    type: Type.STRING,
                  },

                  stateUpdate: {
                    type: Type.OBJECT,

                    properties: {
                      name: {
                        type: Type.STRING,
                      },

                      mainConcern: {
                        type: Type.STRING,
                      },

                      symptoms: {
                        type: Type.ARRAY,

                        items: {
                          type: Type.STRING,
                        },
                      },

                      duration: {
                        type: Type.STRING,
                      },

                      severity: {
                        type: Type.STRING,
                      },

                      relatedSymptoms: {
                        type: Type.ARRAY,

                        items: {
                          type: Type.STRING,
                        },
                      },

                      followUpFlags: {
                        type: Type.ARRAY,

                        items: {
                          type: Type.STRING,
                        },
                      },
                    },

                    required: [],
                  },

                  nextTopic: {
                    type: Type.STRING,

                    enum: [
                      "name",
                      "mainConcern",
                      "duration",
                      "severity",
                      "relatedSymptoms",
                      "complete",
                    ] satisfies ScreeningTopic[],
                  },

                  followUpFlags: {
                    type: Type.ARRAY,

                    items: {
                      type: Type.STRING,
                    },
                  },

                  isComplete: {
                    type: Type.BOOLEAN,
                  },
                },

                required: [
                  "assistantResponse",
                  "stateUpdate",
                  "nextTopic",
                  "followUpFlags",
                  "isComplete",
                ],
              },
            },
          }),
      );

    const text =
      response.text?.trim();

    if (!text) {
      throw new Error(
        "Gemini returned an empty screening response.",
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(
        "Gemini returned invalid JSON.",
      );
    }

    return validateScreeningResponse(
      parsed,
    );
  }

  private async generateWithRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    let lastError: unknown;

    for (
      let attempt = 0;
      attempt <= MAX_GEMINI_RETRIES;
      attempt++
    ) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const status =
          getGeminiErrorStatus(error);

        const shouldRetry =
          status === 429 ||
          status === 500 ||
          status === 502 ||
          status === 503 ||
          status === 504;

        if (
          !shouldRetry ||
          attempt === MAX_GEMINI_RETRIES
        ) {
          throw error;
        }

        const delay =
          GEMINI_RETRY_DELAYS[attempt] ??
          4000;

        console.warn(
          `Gemini request failed with ${status}. ` +
            `Retrying in ${delay}ms ` +
            `(attempt ${
              attempt + 1
            }/${MAX_GEMINI_RETRIES})...`,
        );

        await sleep(delay);
      }
    }

    throw lastError;
  }
}

function validateScreeningResponse(
  value: unknown,
): ScreeningAgentResponse {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error(
      "Invalid Gemini screening response.",
    );
  }

  const response =
    value as Record<string, unknown>;


  if (
    typeof response.assistantResponse !==
    "string"
  ) {
    throw new Error(
      "Gemini response is missing assistantResponse.",
    );
  }


  if (
    typeof response.stateUpdate !==
      "object" ||
    response.stateUpdate === null
  ) {
    throw new Error(
      "Gemini response has invalid stateUpdate.",
    );
  }


  if (
    typeof response.nextTopic !==
    "string"
  ) {
    throw new Error(
      "Gemini response is missing nextTopic.",
    );
  }

  if (
    typeof response.isComplete !==
    "boolean"
  ) {
    throw new Error(
      "Gemini response is missing isComplete.",
    );
  }


  if (
    !Array.isArray(
      response.followUpFlags,
    )
  ) {
    throw new Error(
      "Gemini response has invalid followUpFlags.",
    );
  }


  const validTopics: ScreeningTopic[] = [
    "name",
    "mainConcern",
    "duration",
    "severity",
    "relatedSymptoms",
    "complete",
  ];

  if (
    !validTopics.includes(
      response.nextTopic as ScreeningTopic,
    )
  ) {
    throw new Error(
      `Invalid nextTopic: ${response.nextTopic}`,
    );
  }

  return value as ScreeningAgentResponse;
}


function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

function getGeminiErrorStatus(
  error: unknown,
): number | undefined {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return undefined;
  }

  const possibleError =
    error as {
      status?: unknown;
    };

  return typeof possibleError.status ===
    "number"
    ? possibleError.status
    : undefined;
}