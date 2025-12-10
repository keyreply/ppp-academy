# Inbox Implementation Plan (Unified Conversation Hub)

## Implementation Status
- [ ] **Phase 1: WebSocket Integration**
    - [ ] WS Connection to Customer DO
- [ ] **Phase 2: Inbox Management API**
    - [ ] Read/Unread State
- [ ] **Phase 3: UI Components**
    - [ ] Conversation List
    - [ ] Chat Window (Rich Text)
- [ ] **Phase 4: Search & Filtering**


## Overview
The Inbox is the centralized hub for human agents to manage real-time conversations across all channels (Web, WhatsApp, Email). It relies heavily on the `CustomerDO` for message history and real-time WebSocket updates.

## Features
- **Unified List**: Filterable list of conversations (All/Unread/Assigned).
- **Chat Interface**: Rich text, attachments, emojis, history playback.
- **Real-time Sync**: Instant updates when AI or User sends a message.
- **Agent Collaboration**: Typing indicators, presence (future).

## Architecture
```
┌─────────────────┐           ┌──────────────────────┐
│   Agent UI      │◄─────────►│  CustomerDO (WS)     │
│   (Inbox)       │           │  - Message Store     │
└─────────────────┘           │  - Broadcast Updates │
                              └──────────────────────┘
```

## Implementation Steps

### Phase 1: WebSocket Integration
Reuse the `CustomerDO` WebSocket logic (hibernation) to allow Agents to subscribe to a "Inbox" view. A `TenantDO` might allow subscribing to "All Active Conversations" by maintaining a registry of active Customer DO IDs.

### Phase 2: Inbox Management API
Endpoints to manage conversation state (Read/Unread, Archived).

#### 2.1 API Routes
```javascript
// PUT /inbox/conversations/:customerId/read
// Updates 'read_at' in CustomerDO messages
```

### Phase 3: UI Components
- **ConversationList**: Virtualized list for performance.
- **ChatWindow**:
    - **MessageBubble**: Differentiate User vs AI vs System.
    - **InputArea**: Integrated with `CustomerDO.sendMessage`.
- **RightPanel**:
    - Customer Profile (from `CustomerDO.profile`).
    - Tags management.

### Phase 4: Search & Filtering
- Use D1 `messages` table (if replicated) or `CustomerDO` SQL search for finding conversations by content.
- For high scale, sync messages to **Vectorize** or external search engine (Typesense/Algolia) if D1 `LIKE` query becomes too slow.
