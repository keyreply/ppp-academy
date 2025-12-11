# Voice Agent Cloudflare - Implementation Plan

## Overview

Build a real-time voice AI agent for outbound real estate sales calls using Cloudflare's serverless infrastructure.

## Requirements Summary

| Requirement | Implementation |
|-------------|----------------|
| Platform | Cloudflare Workers + Durable Objects |
| Speech-to-Text | Deepgram Flux (`@cf/deepgram/flux`) via WebSocket |
| Text-to-Speech | Deepgram Aura-2 (`@cf/deepgram/aura-2-en`) |
| LLM | xAI Grok-4-1-fast-non-reasoning (streaming) |
| State Persistence | Cloudflare Durable Objects |
| Real-time Audio | WebSocket with browser MediaStream |
| Scenario | Outbound real estate sales lead qualification |
| Test UI | Embedded HTML with audio visualizer |

## Architecture

```
┌─────────────────┐    WebRTC     ┌──────────────────────────────────┐
│   Phone/Web     │◄────────────►│  Cloudflare Edge (330+ cities)   │
│   Client        │               │  ┌────────────────────────────┐  │
└─────────────────┘               │  │      RealtimeKit SFU       │  │
                                  │  │  (Opus→PCM conversion)     │  │
                                  │  └─────────────┬──────────────┘  │
                                  │                │                  │
                                  │  ┌─────────────▼──────────────┐  │
                                  │  │    Voice Agent Worker       │  │
                                  │  │  ┌─────────────────────┐   │  │
                                  │  │  │   STT (Deepgram)    │   │  │
                                  │  │  │         ↓           │   │  │
                                  │  │  │   LLM (Grok-4)      │   │  │
                                  │  │  │         ↓           │   │  │
                                  │  │  │   TTS (Minimax)     │   │  │
                                  │  │  └─────────────────────┘   │  │
                                  │  └─────────────┬──────────────┘  │
                                  │                │                  │
                                  │  ┌─────────────▼──────────────┐  │
                                  │  │   Durable Object (State)   │  │
                                  │  │  - Session context         │  │
                                  │  │  - Lead information        │  │
                                  │  │  - Conversation history    │  │
                                  │  └────────────────────────────┘  │
                                  └──────────────────────────────────┘
```

## Implementation Steps

### Phase 1: Project Setup
- [x] Create directory structure
- [x] Initialize npm project
- [x] Configure wrangler.toml
- [x] Set up TypeScript

### Phase 2: Core Agent
- [x] Implement VoiceAgent class
- [x] Set up Durable Object for session state
- [x] Configure WebSocket transport

### Phase 3: Speech Pipeline
- [x] Integrate Deepgram Flux for real-time STT (WebSocket)
- [x] Integrate Deepgram Aura-2 for TTS
- [x] Implement FluxStreamingPipeline for continuous transcription

### Phase 4: LLM Integration
- [x] Configure xAI Grok-4-1-fast-non-reasoning
- [x] Create conversation handler with streaming
- [x] Implement tool calling for lead capture
- [x] Add sentence-level streaming for TTS

### Phase 5: Prompt & Scenario
- [x] Create real estate sales prompt
- [x] Define conversation flow stages
- [x] Implement lead qualification scoring

### Phase 6: State Management
- [x] Session persistence across calls
- [x] Lead information storage
- [x] Conversation context retention
- [x] WebSocket state in Durable Objects

### Phase 7: Testing & Deployment
- [x] Build test UI with WebSocket audio
- [ ] Unit tests
- [ ] Integration tests
- [ ] Deploy to Cloudflare Workers
- [ ] Multi-region validation

## Files to Create

```
voice-agent-cloudflare/
├── package.json
├── wrangler.toml
├── tsconfig.json
├── src/
│   ├── index.ts                    # Worker entry point
│   ├── agents/
│   │   └── VoiceAgent.ts          # Main agent class
│   ├── handlers/
│   │   ├── ConversationHandler.ts # LLM conversation logic
│   │   └── LeadHandler.ts         # Lead capture logic
│   ├── services/
│   │   ├── SpeechService.ts       # STT/TTS integration
│   │   └── LLMService.ts          # Grok integration
│   └── utils/
│       ├── types.ts               # TypeScript types
│       └── config.ts              # Configuration
├── prompts/
│   └── real_estate_sales_call.txt # Sales agent prompt
├── docs/
│   └── API.md                     # API documentation
└── tests/
    └── agent.test.ts              # Test suite
```

## Dependencies

```json
{
  "agents": "latest",
  "@cloudflare/workers-types": "latest",
  "hono": "latest"
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `XAI_API_KEY` | xAI API key for Grok |
| `MINIMAX_API_KEY` | Minimax API key for TTS |
| `DEEPGRAM_API_KEY` | Deepgram API key for STT |

## Success Criteria

1. Agent answers calls with natural greeting
2. Agent asks about property preferences
3. Agent captures lead information
4. Session persists across multiple calls
5. < 800ms response latency for natural conversation
6. Scales automatically across Cloudflare's global network
