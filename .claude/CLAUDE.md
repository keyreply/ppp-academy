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
- **Styling**: Tailwind CSS 4 with shadcn/ui components
- **UI Components**: shadcn/ui (New York style) + Vercel AI Elements
- **Entry**: `src/main.tsx` → `src/App.tsx`
- **Components**: Feature-based organization in `src/components/`
  - Each feature (Campaigns, Channels, Knowledge, etc.) has its own directory
  - `GlobalAIAgent/` - AI assistant floating widget using AI Elements
  - `ui/` - shadcn/ui base components (Button, Card, Dialog, Input, etc.)
  - `ai-elements/` - Vercel AI Elements for chat UI (Message, Conversation, PromptInput, etc.)
- **Services**: `src/services/` - API client (`api.ts`), conversation handling, analytics
- **Data**: `src/data/` - Mock data files for conversations, contacts, tasks

### UI Component Libraries

**shadcn/ui** (`src/components/ui/`)
Base UI components using Radix primitives with Tailwind CSS styling.
- Configuration: `components.json`
- CSS Variables: Defined in `src/index.css` using `@theme inline` for Tailwind v4
- Style: New York variant
- Add components: `npx shadcn@latest add <component>`

**Vercel AI Elements** (`src/components/ai-elements/`)
Pre-built components for AI chat interfaces, optimized for streaming responses.

Key components:
- `Conversation` / `ConversationContent` - Message list container with auto-scroll
- `Message` / `MessageContent` / `MessageResponse` - Message rendering with markdown support
- `MessageActions` / `MessageAction` - Copy, regenerate, and other message actions
- `PromptInput` / `PromptInputTextarea` - Chat input with Enter-to-submit, paste support
- `Suggestions` / `Suggestion` - Quick action suggestion pills
- `Loader` - Animated loading spinner
- `CodeBlock` / `CodeBlockCopyButton` - Syntax-highlighted code with copy functionality
- `Sources` / `Source` - Citation/source display for RAG responses
- `Reasoning` - Chain-of-thought display

Add all AI Elements: `npx shadcn@latest add https://registry.ai-sdk.dev/all.json`

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
- **AI Search**: RAG with automatic indexing via `env.AI.autorag('keyreply-kira-search')`
- **AI Gateway**: Monitoring, caching, rate limiting (`keyreply-kira-gateway`)
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
- AI responses use RAG via **AI Search**: Documents → R2 → AI Search (auto-index) → AI Gateway
- Multitenancy via folder-based metadata filtering: `{tenantId}/documents/{filename}`
- Similarity cache for repeated queries (30-day retention)
- Durable Objects use SQLite storage (see migrations in wrangler.toml)
- Voice API requests are proxied from API Worker → Voice Worker via Service Binding
- Voice sessions use WebSocket for real-time bidirectional audio streaming

## Theming & Brand Colors

CSS variables and Tailwind theme defined in `src/index.css`:

**KeyReply Brand Colors** (available as Tailwind classes like `bg-key-blue`):
- `key-blue`: #37CFFF - Primary brand cyan
- `key-green`: #5DE530 - Success/accent green
- `key-gray`: #565856 - Neutral gray
- `key-navy`: #111722 - Dark background
- `key-teal`: #34DBAE - Secondary teal
- `key-deep-blue`: #1D57D8 - Primary action blue

Each color has a full palette (50-900) for different shades.

**shadcn/ui Theme Tokens** (CSS variables):
- Light/dark mode support via `.dark` class
- Standard tokens: `--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`
- Chart colors: `--chart-1` through `--chart-5`

**Font**: Satoshi (loaded from Fontshare CDN) with Inter/system fallbacks

## RAG with AI Search

AI Search automatically handles document indexing when files are uploaded to R2:

```
Upload Document → R2 Bucket → AI Search Auto-Index
                                    ↓
User Query → AI Search (folder filter) → Similarity Cache Check
                                    ↓
                              AI Gateway → Response
```

**Key files:**
- `workers/api/src/services/ai-search.ts` - AI Search service with multitenancy
- `workers/api/src/routes/chat.ts` - Chat endpoint using AI Search
- `workers/api/src/routes/upload.ts` - Document upload to R2

**Multitenancy:** Documents are stored with folder paths like `{tenantId}/documents/{filename}`.
Search queries use folder metadata filters for tenant isolation.

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
