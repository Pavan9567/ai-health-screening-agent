import { DeepgramClient } from "@deepgram/sdk";

import { env } from "../config/env.js";

export class DeepgramSttService {
  private readonly client: DeepgramClient;

  constructor() {
    if (!env.sttApiKey) {
      throw new Error(
        "STT_API_KEY is not configured.",
      );
    }

    this.client = new DeepgramClient({
      apiKey: env.sttApiKey,
    });
  }

  async createLiveConnection() {
    return this.client.listen.v1.connect({
      model: "nova-3",
      language: "en-US",
      smart_format: "true",
      punctuate: "true",
      interim_results: "true",
      endpointing: "300",
    });
  }
}