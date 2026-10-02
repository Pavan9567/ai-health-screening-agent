# AI Health Screening Agent

A real-time voice-based AI health screening application that conducts a structured conversational intake through the browser.

The application allows a user to speak naturally with an AI health screening assistant. The user's speech is transcribed in real time, processed by Gemini to determine the next relevant screening question, converted back into speech, and played to the user.

At the end of the conversation, the application generates a structured health screening report containing the information collected during the session.

> **Important:** This application is an informational health-screening intake tool. It does not diagnose medical conditions or provide medical treatment.

---

## Features

* Real-time voice conversation in the browser
* Browser microphone capture using `MediaRecorder`
* Streaming speech-to-text using Deepgram
* Adaptive conversational screening using Google Gemini
* Structured health screening state
* Context-aware follow-up questions
* Gemini text-to-speech responses
* Browser Speech Synthesis fallback when Gemini TTS is unavailable
* Live conversation transcript
* AI thinking/speaking states
* Microphone gating while the AI is speaking
* Structured screening report
* Screening completion detection
* Automatic call termination after the final response
* WebSocket-based real-time communication
* TypeScript across both frontend and backend
* No Python backend

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* WebSocket
* Browser MediaRecorder API
* Browser Speech Synthesis API
* CSS

### Backend

* Node.js
* Express
* TypeScript
* WebSocket
* Deepgram SDK
* Google Gemini SDK

### AI Services

#### Speech-to-Text

Deepgram streaming speech recognition is used to convert microphone audio into live transcripts.

#### Large Language Model

Google Gemini is used to:

* understand the user's response
* maintain the screening conversation
* determine the next screening topic
* generate adaptive follow-up questions
* determine when enough information has been collected
* generate the final screening summary

#### Text-to-Speech

Google Gemini TTS is used to convert AI responses into speech.

A browser Speech Synthesis fallback is also implemented so that the conversation can still finish if Gemini TTS becomes temporarily unavailable because of quota or rate limits.

---

# Project Architecture

```text
ai-health-screening-agent/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   │   ├── useAudioPlayer.ts
│   │   │   ├── useAudioRecorder.ts
│   │   │   ├── useVoiceCall.ts
│   │   │   └── useWebSocket.ts
│   │   ├── types/
│   │   │   ├── call.ts
│   │   │   └── websocket.ts
│   │   └── ...
│   ├── package.json
│   └── ...
│
├── server/
│   ├── src/
│   │   ├── services/
│   │   │   ├── DeepgramSttService.ts
│   │   │   ├── GeminiLlmService.ts
│   │   │   └── GeminiTtsService.ts
│   │   ├── websocket/
│   │   │   └── callSocket.ts
│   │   ├── ...
│   │   └── ...
│   ├── package.json
│   └── ...
│
└── README.md
```

---

# High-Level Flow

The complete voice interaction follows this pipeline:

```text
User
  │
  │ speaks
  ▼
Browser Microphone
  │
  │ audio/webm;codecs=opus
  ▼
WebSocket
  │
  ▼
Node.js Backend
  │
  ▼
Deepgram Streaming STT
  │
  │ transcript
  ▼
Conversation / Screening Logic
  │
  ▼
Gemini LLM
  │
  ├── response
  ├── state update
  ├── next screening topic
  └── completion decision
  │
  ▼
Gemini TTS
  │
  ├── success ──────────────► WAV audio
  │
  └── TTS unavailable
             │
             ▼
      Browser Speech Synthesis
  │
  ▼
Browser Audio Playback
  │
  ▼
User hears AI response
  │
  ▼
Next question / screening completion
```

---

# Voice Conversation Lifecycle

A call follows these major states:

```text
Idle
  │
  ▼
Connecting
  │
  ▼
Call Started
  │
  ▼
AI Greeting
  │
  ▼
Listening
  │
  ▼
User Speaking
  │
  ▼
Final Transcript
  │
  ▼
Processing
  │
  ▼
Gemini Response
  │
  ▼
AI Speaking
  │
  ├──────────────► Next User Response
  │
  └──────────────► Screening Complete
                         │
                         ▼
                    Final Response
                         │
                         ▼
                    End Call
```

The microphone is intentionally disabled while the AI is speaking. This prevents the application's own synthesized voice from being accidentally transcribed as user speech.

---

# Health Screening State

The backend maintains structured screening state throughout the conversation.

```ts
interface HealthScreeningState {
  name: string | null;
  mainConcern: string | null;
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  relatedSymptoms: string[];
  followUpFlags: string[];
}
```

The conversation state also tracks:

```ts
interface ConversationState {
  health: HealthScreeningState;
  askedQuestions: ScreeningTopic[];
  currentTopic: ScreeningTopic;
  turnCount: number;
  isComplete: boolean;
}
```

This allows the AI to maintain context across multiple conversational turns instead of treating each response independently.

---

# Screening Topics

The current screening flow supports these primary topics:

```text
name
mainConcern
duration
severity
relatedSymptoms
complete
```

The AI can adapt its next question based on information already collected.

For example:

```text
User:
I have been having headaches.

AI:
How long have you been experiencing the headaches?

User:
For two days.

AI:
How would you describe the severity of the headache?

User:
Moderate.

AI:
Are you experiencing any other symptoms along with the headache?
```

The exact questions are generated dynamically rather than being hard-coded into a fixed sequence.

---

# Gemini Conversation Logic

Gemini is responsible for the conversational reasoning layer.

The backend provides Gemini with the current screening state and conversation context.

The model returns structured information containing:

```ts
interface ScreeningAgentResponse {
  assistantResponse: string;
  stateUpdate: HealthStateUpdate;
  nextTopic: ScreeningTopic;
  followUpFlags: string[];
  isComplete: boolean;
}
```

The backend then applies the returned state update to the active conversation.

This keeps the conversation state controlled by the backend rather than relying entirely on frontend state.

---

# Final Screening Report

Once the screening is complete, the backend generates a structured report.

```ts
interface HealthScreeningReport {
  name: string | null;
  mainConcern: string | null;
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  relatedSymptoms: string[];
  followUpFlags: string[];
  summary: string;
  completed: boolean;
  disclaimer: string;
}
```

The summary is generated by Gemini using only the collected screening state.

The summary-generation prompt explicitly prevents the model from:

* diagnosing a condition
* inventing symptoms
* inventing duration or severity
* adding medical information that was not collected
* recommending treatment

---

# Real-Time WebSocket Communication

The frontend and backend communicate through a WebSocket connection.

The server sends events such as:

```text
CONNECTED
CALL_STARTED
TRANSCRIPT
AI_RESPONSE
AUDIO_START
AUDIO_END
SCREENING_COMPLETE
CALL_ENDED
ERROR
PONG
```

Binary WebSocket messages are used for AI audio chunks.

This allows the application to stream the AI voice response to the browser without requiring a separate HTTP request for every response.

---

# Audio Recording

The browser captures microphone audio using:

```text
MediaRecorder
```

Audio is transmitted as:

```text
audio/webm;codecs=opus
```

chunks through the WebSocket connection.

When Deepgram produces a final transcript:

1. Recording stops.
2. The transcript is added to the conversation.
3. The AI enters the processing state.
4. Gemini processes the user's response.
5. The AI response is generated.
6. TTS audio is generated.
7. Audio playback begins.
8. Recording is enabled again only after playback finishes.

This sequencing prevents overlapping user/AI audio.

---

# Deepgram Streaming STT

Deepgram is connected lazily when the first microphone audio chunk arrives.

This avoids keeping an unnecessary Deepgram connection open while the initial AI greeting is playing.

The flow is:

```text
First microphone chunk
        │
        ▼
Create Deepgram connection
        │
        ▼
Wait for connection
        │
        ▼
Send microphone audio
        │
        ▼
Receive transcript events
```

This architecture also prevents the Deepgram connection from becoming idle while the application is waiting for the user to respond to the AI greeting.

---

# Gemini TTS

Gemini TTS generates PCM audio for the AI response.

The backend wraps the PCM data in a WAV container before sending the audio to the browser.

The current audio configuration is:

```text
Sample rate: 24000 Hz
Channels:    1
Bit depth:   16-bit
Format:      PCM WAV
```

The browser audio player collects the streamed chunks and creates a playable WAV Blob.

---

# TTS Fallback

Gemini TTS may become temporarily unavailable because of API quota or rate limits.

The application therefore has a fallback path:

```text
Gemini TTS
    │
    ├── Success
    │      │
    │      ▼
    │   Gemini audio
    │
    └── Failure
           │
           ▼
    Browser Speech Synthesis
```

The AI text response is preserved even if Gemini TTS fails.

The browser then speaks the response using:

```ts
window.speechSynthesis
```

For a completed screening, the call ends after the fallback speech finishes.

This prevents a TTS quota problem from making the entire screening session fail.

---

# Frontend Audio State

The frontend maintains separate states for:

* microphone recording
* AI audio playback
* AI thinking
* AI speaking
* live transcript
* final transcript
* screening report
* call status

The AI response is displayed in the conversation when speech playback actually begins.

This keeps the transcript synchronized with what the user hears.

---

# Conversation UI

The conversation panel displays:

```text
AI Assistant
    AI response

You
    User response

AI Assistant
    Thinking...

AI Assistant
    Speaking...
```

Interim Deepgram transcripts are displayed temporarily and converted into permanent user messages when Deepgram produces a final transcript.

---

# Error Handling

The application handles several failure cases:

### WebSocket failure

The frontend stops recording, stops audio playback, clears temporary state, and returns to an idle state.

### Gemini TTS failure

If the AI text response exists, browser speech synthesis is used as a fallback.

### Browser audio playback failure

The application prevents the user from becoming stuck in the thinking state and either:

* returns to listening for another response, or
* ends the completed screening.

### Empty AI response

Empty AI responses are ignored instead of being sent to TTS.

### Empty TTS response

The backend treats missing audio data as a TTS failure.

---

# Project Phases

## Phase 1 — Project Setup

Initial application setup including:

* React frontend
* Vite
* TypeScript
* Node.js backend
* Express
* project structure
* development scripts

---

## Phase 2 — Base Application Structure

Established the frontend/backend architecture and initial application communication.

---

## Phase 3 — Frontend and Backend Integration

Implemented the initial working connection between the React client and Node.js server.

---

## Phase 4 — Microphone and Streaming STT

Implemented:

* browser microphone capture
* MediaRecorder
* WebSocket audio transmission
* Deepgram streaming STT
* Deepgram connection lifecycle

---

## Phase 5 — Live Transcript

Implemented:

* interim transcripts
* final transcripts
* live transcript UI
* user conversation messages
* microphone state transitions

---

# Phase 6 — Gemini AI Voice Screening

Phase 6 introduced the AI screening experience.

### 6.1 Gemini Integration

Integrated Google Gemini for conversational AI processing.

### 6.2 Conversation State

Implemented structured health screening state.

### 6.3 Adaptive Screening

The AI determines the next relevant screening topic based on information already collected.

### 6.4 Live Gemini Conversation

Integrated the Gemini response into the live WebSocket voice pipeline:

```text
Deepgram STT
     ↓
Gemini
     ↓
AI response
     ↓
Gemini TTS
     ↓
Browser playback
```

### 6.5 Voice Interaction

Implemented:

* AI speaking state
* AI thinking state
* microphone gating
* audio playback
* browser audio buffering
* AI response synchronization

Phase 6 results in a working conversational voice screening experience.

---

# Phase 7 — Screening Report and Completion

Phase 7 introduced structured completion handling.

### Structured Report

The backend generates a `HealthScreeningReport` after the screening reaches completion.

### Summary Generation

Gemini generates a concise summary using only collected information.

### Screening Completion Event

The backend sends:

```text
SCREENING_COMPLETE
```

with the structured report.

### Final Voice Response

The final AI response is spoken before the call is ended.

### Completed Call Lifecycle

```text
Final user response
       ↓
Gemini processing
       ↓
Final AI response
       ↓
SCREENING_COMPLETE
       ↓
Final AI voice
       ↓
Voice playback complete
       ↓
END_CALL
       ↓
CALL_ENDED
```

### TTS Resilience

Phase 7 also introduced browser speech fallback for Gemini TTS quota/rate-limit failures.

---

# Environment Variables

Create the required environment files for the client and server.

The backend requires credentials for the AI services used by the application.

Example:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key
GEMINI_API_KEY=your_gemini_api_key
```

The Gemini configuration also supports the configured LLM and TTS models/voice through the application's environment configuration.

The frontend requires the WebSocket endpoint:

```env
VITE_WS_URL=ws://localhost:4000/ws/call
```

For production, replace the local WebSocket URL with the deployed secure WebSocket endpoint.

> Never commit API keys or secret credentials to GitHub.

---

# Installation

## Clone the repository

```bash
git clone <your-github-repository-url>
cd ai-health-screening-agent
```

---

## Install frontend dependencies

```bash
cd client
npm install
```

---

## Install backend dependencies

```bash
cd ../server
npm install
```

---

# Running the Application

Start the backend first:

```bash
cd server
npm run dev
```

Then start the frontend:

```bash
cd client
npm run dev
```

Open the Vite development URL shown in the terminal.

Allow microphone access when the browser requests permission.

---

# Typical User Flow

1. Open the application.
2. Start a health screening call.
3. The AI greeting is played.
4. The microphone becomes active.
5. Speak naturally.
6. Deepgram converts speech into a transcript.
7. Gemini processes the response.
8. Gemini generates the next screening response.
9. TTS converts the response into audio.
10. The browser plays the response.
11. The microphone becomes active again.
12. The process continues until enough screening information is collected.
13. The final screening report is generated.
14. The final AI response is spoken.
15. The call ends automatically.

---

# Development Commands

## Frontend

Run development server:

```bash
npm run dev
```

Run lint:

```bash
npm run lint
```

Create production build:

```bash
npm run build
```

---

## Backend

Run development server:

```bash
npm run dev
```

Create production build:

```bash
npm run build
```

Run the backend after building according to the scripts defined in `server/package.json`.

---

# Testing the TTS Layer

The project includes a TTS test workflow used during development to verify Gemini TTS independently from the live WebSocket call.

This is useful for distinguishing:

```text
Gemini TTS problem
```

from:

```text
WebSocket / browser audio problem
```

A successful standalone TTS test confirms that the generated audio format can be produced and wrapped as WAV.

---

# Security Considerations

* API keys must remain on the backend.
* Do not expose `GEMINI_API_KEY` or `DEEPGRAM_API_KEY` through frontend environment variables.
* Do not commit `.env` files.
* Validate WebSocket messages on the server.
* Treat AI-generated content as untrusted application data.
* Do not use the generated screening summary as a medical diagnosis.

Recommended `.gitignore` entries include:

```text
.env
.env.*
node_modules/
dist/
```

---

# Medical Disclaimer

This application is designed as a health screening and information-collection demonstration.

It does not:

* diagnose medical conditions
* replace a doctor
* prescribe medication
* recommend treatment
* provide emergency medical care

The final screening report includes a disclaimer directing users to consult a qualified healthcare professional for medical advice, diagnosis, or treatment.

If a user is experiencing a medical emergency, they should contact appropriate emergency medical services rather than relying on this application.

---

# Design Principles

The implementation follows several important principles.

### Backend owns screening state

The frontend displays the conversation, while the backend maintains the authoritative screening state.

### AI responses are not trusted as structured application state

Gemini responses are interpreted and validated before state updates are applied.

### Voice playback controls microphone timing

The microphone does not restart merely because an AI response was generated. It waits until actual playback has completed.

### Graceful degradation

If Gemini TTS becomes unavailable, the application can continue using browser speech synthesis.

### Separation of responsibilities

```text
Deepgram
    → Speech recognition

Gemini LLM
    → Conversational reasoning

Gemini TTS
    → AI voice generation

Browser Speech Synthesis
    → TTS fallback

WebSocket
    → Real-time transport

React
    → User interface and interaction state

Node.js
    → Session orchestration and AI services
```

---

# Current Status

The core end-to-end screening workflow is implemented:

```text
Microphone
   ↓
Deepgram
   ↓
Live Transcript
   ↓
Gemini Health Screening
   ↓
Gemini TTS
   ↓
Browser Audio
   ↓
Next User Response
   ↓
Structured Screening Report
   ↓
Final AI Response
   ↓
Call Completion
```

The application also includes a browser speech fallback for Gemini TTS quota/rate-limit failures.

---

# Future Improvements

Potential future enhancements include:

* persistent screening sessions
* authentication
* database-backed reports
* report export as PDF
* multilingual screening
* additional screening domains
* stronger server-side schema validation
* improved accessibility
* production WebSocket authentication
* observability and structured logging
* automated end-to-end tests
* deployment with HTTPS/WSS
* rate-limit monitoring
* configurable screening templates

---

# Disclaimer

This project is intended for educational, demonstration, and portfolio purposes.

It should not be used as a replacement for professional medical evaluation, diagnosis, or treatment.
