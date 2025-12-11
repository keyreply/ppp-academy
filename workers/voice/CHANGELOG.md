# Changelog

## v0.2.0 (2025-12-01) - Cloudflare Voice Agent - Real Estate Sales

Created a production-ready voice AI agent with end-to-end streaming.

### Architecture
- Cloudflare Workers for serverless execution (330+ global locations)
- Durable Objects for session persistence and WebSocket management
- WebSocket for real-time bidirectional audio streaming
- Hono framework for HTTP API

### Streaming Speech Pipeline
- STT: Deepgram Flux (`@cf/deepgram/flux`) via WebSocket for real-time transcription
- TTS: Deepgram Aura-2 (`@cf/deepgram/aura-2-en`) with streaming output
- LLM: xAI Grok-4-1-fast-non-reasoning with sentence-level streaming

### Features Implemented
- End-to-end streaming for lowest latency
- Session persistence across multiple calls
- Conversation context retention
- Automatic lead information capture via tool calls
- Lead qualification scoring (0-100)
- Conversation stage management
- Sentence-level TTS chunking
- Built-in test UI with audio visualizer
- Prompt separated in `prompts/real_estate_sales_call.txt`

### Files Created
```
products/voice-agent-cloudflare/
├── README.md              # Documentation
├── PLAN.md               # Implementation plan
├── package.json          # Dependencies
├── wrangler.toml         # Cloudflare config
├── tsconfig.json         # TypeScript config
├── public/
│   └── index.html        # Test UI (also embedded in worker)
├── src/
│   ├── index.ts          # Worker entry point (Hono API + embedded UI)
│   ├── agents/
│   │   ├── VoiceAgent.ts              # Main agent class
│   │   └── VoiceSessionDurableObject.ts # Session + WebSocket handling
│   ├── handlers/
│   │   ├── ConversationHandler.ts    # Conversation logic
│   │   └── RealtimeVoiceHandler.ts   # Streaming voice pipeline
│   ├── services/
│   │   ├── LLMService.ts             # xAI Grok with streaming
│   │   └── SpeechService.ts          # Flux STT + Aura TTS
│   ├── utils/
│   │   ├── types.ts                  # TypeScript types
│   │   └── config.ts                 # Configuration
│   └── prompts/
│       └── loader.ts                 # Prompt loader
└── prompts/
    └── real_estate_sales_call.txt    # Agent prompt
```

### Deployment Instructions (v0.2.0)
```bash
cd 01_Product/products/voice-agent-cloudflare
npm install
wrangler secret put XAI_API_KEY
wrangler secret put MINIMAX_API_KEY  # Optional
wrangler deploy
```
