# KeyReply Kira AI

A modern AI-powered customer engagement platform built with React, TypeScript, and Cloudflare Workers.

## Features

- **AI Chat Widget** - Streaming chat interface with RAG (Retrieval-Augmented Generation)
- **Voice AI** - Real-time voice conversations with STT/LLM/TTS pipeline
- **Multi-tenant** - Folder-based document isolation per tenant
- **Modern UI** - shadcn/ui components + Vercel AI Elements for chat interfaces

## Tech Stack

- **Frontend**: React 19, Vite 7, TypeScript, Tailwind CSS 4
- **UI Components**: shadcn/ui (New York style), Vercel AI Elements
- **Backend**: Cloudflare Workers (Hono framework)
- **Database**: Cloudflare D1 (SQLite), R2 (object storage)
- **AI**: Cloudflare AI Search (RAG), Workers AI, Deepgram STT, Minimax TTS
- **Deployment**: Cloudflare Pages + Workers

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) runtime installed
- Cloudflare account (for Workers deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/keyreply/keyreply-kira-ai.git
cd keyreply-kira-ai

# Install dependencies
bun install

# Install worker dependencies
cd workers/api && bun install && cd ../..
cd workers/voice && bun install && cd ../..
```

### Development

```bash
# Start frontend dev server (localhost:5173)
bun run dev

# Start API worker dev server
bun run api:dev

# Start Voice worker dev server
bun run voice:dev

# Start all workers concurrently
bun run workers:dev
```

### Build & Deploy

```bash
# Build frontend
bun run build

# Deploy to Cloudflare Pages
bun run deploy

# Deploy workers
bun run api:deploy
bun run voice:deploy
```

## Project Structure

```
keyreply-kira/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui base components
│   │   ├── ai-elements/     # Vercel AI Elements for chat
│   │   ├── GlobalAIAgent/   # AI assistant widget
│   │   └── ...              # Feature components
│   ├── services/            # API clients, services
│   ├── data/                # Mock data
│   └── lib/                 # Utilities (cn, etc.)
├── workers/
│   ├── api/                 # Main REST API worker
│   │   ├── src/
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── durable-objects/  # DO classes
│   │   │   └── services/    # Business logic
│   │   └── wrangler.toml
│   └── voice/               # Voice AI worker
│       ├── src/
│       │   ├── agents/      # Voice agents
│       │   ├── services/    # STT/TTS services
│       │   └── handlers/    # WebSocket handlers
│       └── wrangler.toml
├── components.json          # shadcn/ui config
└── .claude/CLAUDE.md        # Claude Code instructions
```

## UI Components

### Adding shadcn/ui Components

```bash
npx shadcn@latest add button card dialog
```

### Adding AI Elements

```bash
# Add all AI Elements
npx shadcn@latest add https://registry.ai-sdk.dev/all.json

# Or add specific components
npx shadcn@latest add https://registry.ai-sdk.dev/message.json
```

### Key AI Element Components

- `Conversation` / `ConversationContent` - Message list with auto-scroll
- `Message` / `MessageContent` / `MessageResponse` - Message rendering
- `PromptInput` / `PromptInputTextarea` - Chat input with Enter-to-submit
- `Suggestions` / `Suggestion` - Quick action pills
- `CodeBlock` - Syntax-highlighted code blocks
- `Sources` - RAG citation display

## Environment Variables

### Frontend (.env)
```bash
VITE_API_URL=http://localhost:8787  # API worker URL
```

### Workers (set via `wrangler secret put`)
```bash
# API Worker
RESEND_API_KEY=...
CLOUDFLARE_API_TOKEN=...

# Voice Worker
MINIMAX_API_KEY=...
MINIMAX_GROUP_ID=...
DEEPGRAM_API_KEY=...
```

## Documentation

See [.claude/CLAUDE.md](.claude/CLAUDE.md) for detailed architecture documentation.

## License

MIT
