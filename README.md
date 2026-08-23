# AI Health Screening Voice Agent

A real-time conversational AI health screening application built with React,
Node.js, TypeScript, WebSockets, speech-to-text, Gemini, and text-to-speech.

## Project Status

🚧 Phase 1 — Project Foundation

## Architecture

The application will use a real-time turn-based voice pipeline:

User Speech
→ Speech-to-Text
→ Gemini Conversation Agent
→ Text-to-Speech
→ User Audio

## Technology Stack

### Frontend

- React
- TypeScript
- Vite

### Backend

- Node.js
- Express
- TypeScript
- WebSocket

### AI

- Google Gemini
- Speech-to-Text provider
- Text-to-Speech provider

## Project Structure

```text
client/     React frontend
server/     Node.js backend
