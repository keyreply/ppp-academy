# Voice Agent - Cloudflare Workers

Real-time voice AI agent for outbound real estate sales calls, built on Cloudflare's serverless infrastructure with end-to-end streaming.

## Features

- **Real-time Streaming**: WebSocket audio with Deepgram Flux STT
- **Speech-to-Text**: Deepgram Flux for real-time transcription via WebSocket
- **Text-to-Speech**: Deepgram Aura-2 with streaming output
- **LLM**: xAI Grok-4-1-fast-non-reasoning with sentence-level streaming
- **Session Persistence**: Durable Objects retain context across calls
- **Auto-scaling**: Serverless execution across 330+ Cloudflare locations
- **Lead Capture**: Automatic extraction via LLM tool calls
- **Test UI**: Built-in browser interface for testing

## Architecture

```
Browser/Client ←→ WebSocket ←→ Cloudflare Edge
                                    ↓
                          Voice Agent Worker
                          ├── STT (Flux WebSocket)
                          ├── LLM (Grok streaming)
                          └── TTS (Aura-2 streaming)
                                    ↓
                          Durable Object (Session)
                          ├── WebSocket Management
                          ├── Conversation History
                          ├── Lead Information
                          └── Context Retention
```

## Streaming Pipeline

For lowest latency, the agent streams at every stage:

1. **Audio → STT**: Flux WebSocket receives audio chunks continuously
2. **STT → LLM**: Final transcripts trigger LLM with streaming response
3. **LLM → TTS**: Sentence boundaries trigger TTS for each sentence
4. **TTS → Audio**: PCM audio streamed back via WebSocket

## Quick Start

### Prerequisites

- Bun recommended
- Cloudflare account with Workers enabled
- API keys for: xAI, Minimax (optional), Deepgram (optional)

### Installation

```bash
# Install dependencies
bun install

# Set up secrets
wrangler secret put XAI_API_KEY
wrangler secret put MINIMAX_API_KEY  # Optional, falls back to Deepgram
wrangler secret put DEEPGRAM_API_KEY # Optional if using Workers AI
```

### Development

```bash
# Run locally
bun run dev

# Type check
bun run typecheck

# Lint
bun run lint
```

### Deployment

```bash
# Deploy to development
wrangler deploy --env dev

# Deploy to staging
wrangler deploy --env staging

# Deploy to production
wrangler deploy --env production
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/session/init` | Initialize session |
| GET | `/session/:id` | Get session state |
| POST | `/session/:id/message` | Text message (testing) |
| POST | `/session/:id/end` | End session |
| PATCH | `/session/:id/lead` | Update lead info |
| GET | `/ws/:id` | WebSocket for voice |

## Usage Example

### Initialize Session

```bash
curl -X POST https://voice-agent.workers.dev/session/init \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "phone-1234567890"}'
```

### Send Text Message (Testing)

```bash
curl -X POST https://voice-agent.workers.dev/session/phone-1234567890/message \
  -H "Content-Type: application/json" \
  -d '{"text": "I am looking for a 3 bedroom house in Singapore"}'
```

### Get Session State

```bash
curl https://voice-agent.workers.dev/session/phone-1234567890
```

## Conversation Flow

1. **Greeting**: Agent introduces itself
2. **Needs Discovery**: Asks about property preferences
3. **Qualification**: Gathers budget, timeline, requirements
4. **Property Discussion**: Discusses matching properties
5. **Next Steps**: Schedules callbacks or sends listings
6. **Closing**: Summarizes and confirms follow-ups

## Session Persistence

Sessions are stored in Cloudflare Durable Objects:

- **Conversation History**: Last 50 messages retained
- **Lead Information**: Name, contact, preferences, budget
- **Context**: Stage, qualification score, call count
- **Cross-Call Retention**: Context persists across multiple calls

## Prompt Customization

Edit `prompts/real_estate_sales_call.txt` to customize:

- Agent personality and name
- Conversation flow
- Objection handling
- Data capture requirements

## Lead Information Captured

| Field | Description |
|-------|-------------|
| name | Full name |
| email | Email address |
| phoneNumber | Phone number |
| propertyPreferences | Type, beds, baths, features |
| budget | Min/max range |
| timeline | Purchase timeline |
| notes | Additional context |
| qualificationScore | 0-100 score |

## Configuration

### wrangler.toml

Key settings:

```toml
[ai]
binding = "AI"  # Workers AI for speech models

[[durable_objects.bindings]]
name = "VOICE_SESSION"
class_name = "VoiceSessionDurableObject"
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `XAI_API_KEY` | Yes | xAI API key |
| `MINIMAX_API_KEY` | No | Minimax TTS API key |
| `DEEPGRAM_API_KEY` | No | Deepgram API key |

## Test UI

The agent includes a built-in test interface at `/`:

1. **Start Call**: Requests microphone access and connects WebSocket
2. **Voice Input**: Audio streams to Flux STT in real-time
3. **Text Input**: Alternative testing without microphone
4. **Lead Display**: Shows captured information and qualification score

### Audio Flow
```
Browser Microphone
    ↓ (MediaStream API)
ScriptProcessor (16kHz PCM)
    ↓ (WebSocket binary)
Durable Object
    ↓ (Flux WebSocket)
Deepgram STT → LLM → TTS
    ↓ (WebSocket binary)
Browser AudioContext
    ↓
Speaker Output
```

## Monitoring

- **Observability**: Enabled in wrangler.toml
- **Logging**: Structured logs for debugging
- **Metrics**: Track qualification scores, call counts

## Troubleshooting

### No response from LLM
- Check `XAI_API_KEY` is set correctly
- Verify API quota/limits

### TTS not working
- Falls back to Deepgram Aura if Minimax fails
- Check API keys are configured

### Session not persisting
- Verify Durable Object migration ran
- Check `wrangler deploy` completed

## Security

- API keys stored as Cloudflare secrets
- No PII logged to console
- Session data isolated per user
- CORS enabled for web clients

## License

Proprietary - KeyReply Pte Ltd

## Support

Contact: engineering@keyreply.com
