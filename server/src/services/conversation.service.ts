import type { ConversationState, HealthScreeningState, ScreeningTopic, } from "../models/healthScreening.js";

export class ConversationService {
  createInitialState(): ConversationState {
    return {
      health: {
        name: null,
        mainConcern: null,
        symptoms: [],
        duration: null,
        severity: null,
        relatedSymptoms: [],
        followUpFlags: [],
      },

      askedQuestions: [],

      currentTopic: "name",

      turnCount: 0,

      isComplete: false,
    };
  }

  updateState(
    state: ConversationState,
    updates: Partial<HealthScreeningState>,
  ): ConversationState {
    return {
      ...state,

      health: {
        ...state.health,
        ...updates,
      },

      turnCount:
        state.turnCount + 1,
    };
  }

  addFollowUpFlags(
    state: ConversationState,
    flags: string[],
  ): ConversationState {
    if (flags.length === 0) {
      return state;
    }

    const existingFlags =
      state.health.followUpFlags;

    const mergedFlags = [
      ...existingFlags,
      ...flags.filter(
        (flag) =>
          !existingFlags.includes(flag),
      ),
    ];

    return {
      ...state,

      health: {
        ...state.health,

        followUpFlags:
          mergedFlags,
      },
    };
  }

  markTopicAsked(
    state: ConversationState,
    topic: ScreeningTopic,
  ): ConversationState {
    if (
      topic === "complete" ||
      state.askedQuestions.includes(topic)
    ) {
      return state;
    }

    return {
      ...state,

      askedQuestions: [
        ...state.askedQuestions,
        topic,
      ],
    };
  }

  setCurrentTopic(
    state: ConversationState,
    topic: ScreeningTopic,
  ): ConversationState {
    return {
      ...state,

      currentTopic: topic,
    };
  }

  completeScreening(
    state: ConversationState,
  ): ConversationState {
    return {
      ...state,

      currentTopic: "complete",

      isComplete: true,
    };
  }

  getMissingTopics(
    state: ConversationState,
  ): ScreeningTopic[] {
    const missing: ScreeningTopic[] = [];

    if (!state.health.name) {
      missing.push("name");
    }

    if (!state.health.mainConcern) {
      missing.push("mainConcern");
    }

    if (!state.health.duration) {
      missing.push("duration");
    }

    if (!state.health.severity) {
      missing.push("severity");
    }

    if (
      state.health.relatedSymptoms.length ===
      0
    ) {
      missing.push("relatedSymptoms");
    }

    return missing;
  }

  normalizeHealthUpdate(
    state: ConversationState,
    updates: Partial<HealthScreeningState>,
    transcript: string,
  ): Partial<HealthScreeningState> {
    const normalized = {
        ...updates,
    };

    if (
        !normalized.duration &&
        !state.health.duration
    ) {
        const duration = extractDuration(transcript);

        if (duration) {
        normalized.duration =
            duration;
        }
    }

    /*
    * Normalize whitespace in string fields.
    */
    if (normalized.mainConcern) {
        normalized.mainConcern =
        normalized.mainConcern.trim();
    }

    if (normalized.name) {
        normalized.name =
        normalized.name.trim();
    }

    if (normalized.duration) {
        normalized.duration =
        normalized.duration.trim();
    }

    if (normalized.severity) {
        normalized.severity =
        normalized.severity.trim();
    }

    if (normalized.symptoms) {
        normalized.symptoms =
        normalized.symptoms
            .map(
            (symptom) =>
                symptom.trim(),
            )
            .filter(Boolean);
    }

    if (normalized.relatedSymptoms) {
        normalized.relatedSymptoms =
        normalized.relatedSymptoms
            .map(
            (symptom) =>
                symptom.trim(),
            )
            .filter(Boolean);
    }

    return normalized;
 }
}

function extractDuration(
  transcript: string,
): string | null {
  const normalized =
    transcript
      .trim()
      .replace(/\s+/g, " ");

  const patterns = [
    /*
     * "for about two weeks"
     * "for about 2 weeks"
     * "for two weeks"
     * "for 2 weeks"
     */
    /\bfor\s+(?:about\s+)?(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/i,

    /*
     * "for the past two weeks"
     * "for the last 3 days"
     */
    /\bfor\s+(?:the\s+)?(?:past|last)\s+(?:\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months|year|years)\b/i,

    /*
     * "since Monday"
     * "since yesterday"
     * "since last week"
     */
    /\bsince\s+(?:yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,

    /*
     * "for a week"
     * "for a month"
     * "for a year"
     */
    /\bfor\s+(?:a|an|one)\s+(?:second|minute|hour|day|week|month|year)\b/i,
  ];

  for (const pattern of patterns) {
    const match =
      normalized.match(pattern);

    if (match) {
      return match[0].trim();
    }
  }

  return null;
}