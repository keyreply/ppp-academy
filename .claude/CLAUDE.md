# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

**Always use bun** (not npm) for all package management and running scripts:
- `bun install` instead of `npm install`
- `bun run` instead of `npm run`

## Common Commands

### Frontend (React/Vite)
```bash
bun run dev          # Start Vite dev server (localhost:5173)
bun run build        # Build for production
bun run lint         # Run ESLint
bun run preview      # Preview production build
bun run deploy       # Deploy to Cloudflare Pages
```

### API Worker (Main Backend)
```bash
bun run api:dev       # Start API worker dev server
bun run api:deploy    # Deploy API worker to Cloudflare

# Or from workers/api/ directory:
cd workers/api && bun run dev
cd workers/api && bun run deploy
```

### Voice Worker (Voice AI)
```bash
bun run voice:dev       # Start voice worker dev server
bun run voice:deploy    # Deploy voice worker to Cloudflare

# Or from workers/voice/ directory:
cd workers/voice && bun run dev
cd workers/voice && bun run deploy
cd workers/voice && bun run test       # Run tests (vitest)
cd workers/voice && bun run typecheck  # TypeScript type checking
```

### Run All Workers
```bash
bun run workers:dev     # Start both API and Voice workers concurrently
bun run workers:deploy  # Deploy both workers
```

## Architecture

This is a full-stack application with a React frontend and **two independent Cloudflare Workers** for the backend:

```
┌─────────────────┐     ┌─────────────────────────────┐
│                 │     │    workers/api (Hono)       │
│   React App     │────▶│    - REST API               │
│   (Cloudflare   │     │    - Durable Objects        │
│    Pages)       │     │    - Queues, D1, R2         │
│                 │     │    - Service Binding ───────┼──┐
└─────────────────┘     └─────────────────────────────┘  │
                                                          │
                        ┌─────────────────────────────┐  │
                        │   workers/voice (Hono)      │◀─┘
                        │   - Real-time Voice AI      │
                        │   - WebSocket connections   │
                        │   - STT/TTS streaming       │
                        │   - Independent scaling     │
                        └─────────────────────────────┘
```

### Why Two Workers?

1. **Independent Scaling**: Voice sessions are CPU-intensive (30s limit) and need to scale independently from API requests
2. **Resource Isolation**: Voice WebSocket connections don't compete with API requests
3. **Deployment Flexibility**: Voice worker can be updated without affecting API

### Frontend (`src/`)
- **Framework**: React 19 with Vite 7, TypeScript
- **Styling**: Tailwind CSS 4
- **Entry**: `src/main.tsx` → `src/App.tsx`
- **Components**: Feature-based organization in `src/components/`
  - Each feature (Campaigns, Channels, Knowledge, etc.) has its own directory
  - `GlobalAIAgent/` - AI assistant floating widget
- **Services**: `src/services/` - API client (`api.ts`), conversation handling, analytics
- **Data**: `src/data/` - Mock data files for conversations, contacts, tasks

### API Worker (`workers/api/`)
Main REST API and business logic.
- **Framework**: Hono (lightweight web framework)
- **Entry**: `workers/api/src/index.ts`
- **Routes**: `workers/api/src/routes/` - REST API endpoints
  - `voice.ts` - Proxies to Voice Worker via Service Binding
- **Durable Objects**: `workers/api/src/durable-objects/`
  - `TenantDO` - Multi-tenant management
  - `CustomerDO` - Customer profiles
  - `ConversationDO` - Chat conversations
  - `AgentDO` - AI agent configuration
  - `CampaignDO` - Marketing campaigns
  - `WorkflowDO` - Automation workflows
  - `AnalyticsDO` - Usage analytics
  - `NotificationDO` - Notification handling
  - `RateLimiterDO` - Rate limiting
- **Services**: `workers/api/src/services/` - RAG, email, analytics, platform functions
- **Middleware**: `workers/api/src/middleware/auth.ts`

### Voice Worker (`workers/voice/`)
Real-time voice AI for outbound calls using streaming STT/LLM/TTS.
- **Framework**: Hono
- **Entry**: `workers/voice/src/index.ts`
- **Agents**: `VoiceAgent.ts`, `VoiceSessionDurableObject.ts`, `SessionRegistryDurableObject.ts`
- **Handlers**: `ConversationHandler.ts`, `RealtimeVoiceHandler.ts`
- **Services**: `LLMService.ts` (Workers AI), `SpeechService.ts` (Deepgram Flux STT, Minimax TTS)
- **Utils**: `StreamPacer.ts`, `BargeInDetector.ts`, `SmartTextChunker.ts`
- **Prompts**: `prompts/loader.ts` - Dynamic prompt loading

### Cloudflare Bindings

**API Worker** (defined in `workers/api/wrangler.toml`):
- **D1**: SQLite database (`DB`)
- **R2**: Document storage (`DOCS_BUCKET`)
- **Vectorize**: RAG embeddings (`VECTORIZE`) - 1024 dimensions for Qwen3
- **Queues**: Document processing, analytics, emails
- **Workers AI**: `AI` binding for embeddings and inference
- **Dispatch Namespace**: `DISPATCHER` for platform functions
- **Service Binding**: `VOICE_SERVICE` connects to Voice Worker

**Voice Worker** (defined in `workers/voice/wrangler.toml`):
- **Workers AI**: `AI` binding for speech models (Deepgram Flux, Nova-3, Aura-2)
- **Durable Objects**: `VOICE_SESSION`, `SESSION_REGISTRY`
- **Assets**: Static files from `public/` directory
- **CPU Limit**: 30 seconds (for long streaming operations)

## Key Patterns

- Frontend communicates with API worker via `src/services/api.ts`
- Real-time messaging uses WebSocket via `src/services/conversationService.ts`
- AI responses use RAG pipeline: Documents → R2 → Vectorize → Workers AI
- Durable Objects use SQLite storage (see migrations in wrangler.toml)
- Voice API requests are proxied from API Worker → Voice Worker via Service Binding
- Voice sessions use WebSocket for real-time bidirectional audio streaming

## Voice Pipeline Architecture

```
User Audio (16kHz PCM)
    ↓
[WebSocket to Voice Worker]
    ↓
[Deepgram Flux STT] ← Real-time streaming, turn detection
    ↓
[Final Transcripts]
    ↓
[LLM Service - Workers AI] ← Streaming with SmartTextChunker
    ↓
[Sentence-by-Sentence]
    ↓
[TTS Service - Minimax/Aura-2] ← StreamPacer for playback timing
    ↓
[Audio Chunks]
    ↓
[WebSocket] → User Speaker Output
```

## Environment Variables

Both workers require secrets set via `wrangler secret put`:

**API Worker:**
- `RESEND_API_KEY` - For production email (Resend)
- `CLOUDFLARE_API_TOKEN` - For managing Platform Functions

**Voice Worker:**
- `MINIMAX_API_KEY` - For Minimax TTS
- `MINIMAX_GROUP_ID` - Minimax configuration
- `DEEPGRAM_API_KEY` - Optional, for external Deepgram
