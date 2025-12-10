# Voice Bot Implementation Plan

## Implementation Status
- [ ] **Phase 1: Configuration Management**
    - [ ] Voice Bot Tables
- [ ] **Phase 2: Telephony Integration**
    - [ ] Twilio/Vapi Connector
- [ ] **Phase 3: Bot Runner**
    - [ ] WebSocket Stream Handler
- [ ] **Phase 4: UI**
    - [ ] Bot Editor & Preview


## Overview
Enables creating and managing AI Voice Bots for inbound/outbound calls. Integrates with telephony providers (Twilio/Vonage) and AI Voice engines (ElevenLabs, OpenAI, Deepgram).

## Features
- **Voice Selection**: Library of voices.
- **Script/Prompt Editor**: System prompts defining persona.
- **Testing**: In-browser voice chat to test bot.
- **Analytics**: Call duration, sentiment.

## Architecture
- **Telephony Connector**: Worker handling WebSockets from Twilio Media Streams.
- **Voice Gateway**: Proxies audio streams to LLM + TTS.

## Implementation Steps

### Phase 1: Configuration Management (D1)
```sql
CREATE TABLE voice_bots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  name TEXT,
  voice_id TEXT, -- e.g., 'elevenlabs_adam'
  system_prompt TEXT,
  provider_config TEXT -- JSON: Twilio number, etc.
);
```

### Phase 2: Telephony Integration
- Use **Twilio streams** or **Vapi** / **Retell AI** (if using a managed wrapper) or build raw `Worker` -> `WebSocket` -> `OpenAI Realtime API` bridge.
- **Recommended**: Start with `OpenAI Realtime API` via WebSocket + Twilio Media Streams for lowest latency.

### Phase 3: Bot Runner
- A Worker that handles the Upgrade to WebSocket request from Twilio.
- Maintains state of the conversation stream.
- Feeds transcripts into `CustomerDO` for history.

### Phase 4: UI
- **Bot Editor**: Settings form.
- **Preview**: Microphone button in browser -> connect to Bot Runner WS for testing.
