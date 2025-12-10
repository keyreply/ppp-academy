# Comprehensive Durable Objects Plan for PPP Academy

## Overview

This document outlines all Durable Objects in the PPP Academy system, their purposes, and when to use them vs traditional D1 database. The key addition is **AI Context/Memory** for customers - a living summary that accompanies every AI interaction.

## Durable Objects Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PPP Academy System                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │  Tenant DO   │     │ Conversation │     │   Rate       │                 │
│  │  (per org)   │     │   DO         │     │   Limiter DO │                 │
│  │              │     │  (per chat)  │     │  (per key)   │                 │
│  └──────┬───────┘     └──────────────┘     └──────────────┘                 │
│         │                                                                    │
│         │ owns                                                               │
│         ▼                                                                    │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │ Customer DO  │     │  Agent DO    │     │  Workflow DO │                 │
│  │ (per contact)│     │ (per AI bot) │     │ (per process)│                 │
│  │              │     │              │     │              │                 │
│  │ ┌──────────┐ │     └──────────────┘     └──────────────┘                 │
│  │ │AI Context│ │                                                           │
│  │ │ Memory   │ │     ┌──────────────┐     ┌──────────────┐                 │
│  │ └──────────┘ │     │ Notification │     │  Analytics   │                 │
│  └──────────────┘     │   DO         │     │   DO         │                 │
│                       │ (per user)   │     │ (per tenant) │                 │
│                       └──────────────┘     └──────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## When to Use Durable Objects vs D1

| Use Case | Durable Object | D1 Database |
|----------|----------------|-------------|
| **Real-time state** | ✅ Best choice | ❌ Polling needed |
| **Per-entity isolation** | ✅ Natural fit | ⚠️ Row-level only |
| **WebSocket connections** | ✅ Hibernation | ❌ Not supported |
| **Rate limiting** | ✅ In-memory counters | ❌ Too slow |
| **Conversation memory** | ✅ Single-threaded | ⚠️ Race conditions |
| **Cross-tenant queries** | ❌ Expensive | ✅ Best choice |
| **Reporting/Analytics** | ❌ Aggregate hard | ✅ SQL joins |
| **Search/Filtering** | ❌ Per-object only | ✅ Indexes |
| **Bulk operations** | ❌ One-by-one | ✅ Batch queries |

---

# 1. Customer Durable Object (Enhanced with AI Context)

## AI Context/Memory Feature

The **AI Context** is a continuously updated text summary that captures everything important about a customer. It serves as the AI's "memory" and is injected into every conversation, email response, and touchpoint.

### Schema Addition

```sql
-- AI Context/Memory table
CREATE TABLE IF NOT EXISTS ai_context (
  id TEXT PRIMARY KEY DEFAULT 'main',

  -- Core summary (injected into all AI interactions)
  summary TEXT DEFAULT '',

  -- Structured memory sections
  key_facts TEXT DEFAULT '[]',           -- Important facts about the customer
  preferences TEXT DEFAULT '{}',          -- Communication preferences, product interests
  pain_points TEXT DEFAULT '[]',          -- Known issues, complaints, concerns
  goals TEXT DEFAULT '[]',                -- What they want to achieve
  relationship_notes TEXT DEFAULT '',     -- Relationship status, sentiment
  conversation_style TEXT DEFAULT '',     -- How they prefer to communicate

  -- Interaction patterns
  best_contact_time TEXT,                 -- Preferred contact hours
  response_urgency TEXT DEFAULT 'normal', -- How quickly they expect responses
  escalation_triggers TEXT DEFAULT '[]',  -- Topics that upset them

  -- Business context
  products_owned TEXT DEFAULT '[]',       -- Products/services they have
  products_interested TEXT DEFAULT '[]',  -- Products they've shown interest in
  lifetime_value REAL DEFAULT 0,
  risk_level TEXT DEFAULT 'low',          -- Churn risk

  -- Auto-generated
  last_interaction_summary TEXT,          -- Summary of last interaction
  sentiment_trend TEXT DEFAULT 'neutral', -- Overall sentiment direction
  engagement_level TEXT DEFAULT 'medium',

  -- Metadata
  version INTEGER DEFAULT 1,
  last_updated_at TEXT DEFAULT (datetime('now')),
  last_updated_by TEXT,
  auto_update_enabled INTEGER DEFAULT 1
);
```

### AI Context Functions

```javascript
// ============================================
// AI CONTEXT / MEMORY MANAGEMENT
// ============================================

async getAIContext() {
  const context = this.sql.exec("SELECT * FROM ai_context WHERE id = 'main'").one();

  if (!context) {
    // Initialize if not exists
    this.sql.exec("INSERT OR IGNORE INTO ai_context (id) VALUES ('main')");
    return this.getAIContext();
  }

  return {
    ...context,
    key_facts: JSON.parse(context.key_facts || '[]'),
    preferences: JSON.parse(context.preferences || '{}'),
    pain_points: JSON.parse(context.pain_points || '[]'),
    goals: JSON.parse(context.goals || '[]'),
    escalation_triggers: JSON.parse(context.escalation_triggers || '[]'),
    products_owned: JSON.parse(context.products_owned || '[]'),
    products_interested: JSON.parse(context.products_interested || '[]'),
  };
}

async updateAIContext(updates, updatedBy = 'system') {
  const fields = [];
  const values = [];

  const allowedFields = [
    'summary', 'key_facts', 'preferences', 'pain_points', 'goals',
    'relationship_notes', 'conversation_style', 'best_contact_time',
    'response_urgency', 'escalation_triggers', 'products_owned',
    'products_interested', 'lifetime_value', 'risk_level',
    'last_interaction_summary', 'sentiment_trend', 'engagement_level',
    'auto_update_enabled'
  ];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
  }

  if (fields.length === 0) return this.getAIContext();

  fields.push("version = version + 1");
  fields.push("last_updated_at = datetime('now')");
  fields.push("last_updated_by = ?");
  values.push(updatedBy);
  values.push('main');

  this.sql.exec(
    `UPDATE ai_context SET ${fields.join(', ')} WHERE id = ?`,
    ...values
  );

  await this.logActivity('ai_context_updated', 'AI Context updated', {
    fields: Object.keys(updates),
    updatedBy
  });

  return this.getAIContext();
}

// Add a key fact about the customer
async addKeyFact(fact, source = 'manual') {
  const context = await this.getAIContext();
  const keyFacts = context.key_facts;

  // Avoid duplicates
  if (!keyFacts.some(f => f.fact === fact)) {
    keyFacts.push({
      fact,
      source,
      addedAt: new Date().toISOString()
    });

    await this.updateAIContext({ key_facts: keyFacts });
  }

  return this.getAIContext();
}

// Add a pain point
async addPainPoint(painPoint, severity = 'medium') {
  const context = await this.getAIContext();
  const painPoints = context.pain_points;

  painPoints.push({
    issue: painPoint,
    severity,
    identifiedAt: new Date().toISOString(),
    resolved: false
  });

  await this.updateAIContext({ pain_points: painPoints });
  return this.getAIContext();
}

// Resolve a pain point
async resolvePainPoint(index) {
  const context = await this.getAIContext();
  const painPoints = context.pain_points;

  if (painPoints[index]) {
    painPoints[index].resolved = true;
    painPoints[index].resolvedAt = new Date().toISOString();
    await this.updateAIContext({ pain_points: painPoints });
  }

  return this.getAIContext();
}

// Update preferences
async setPreference(key, value) {
  const context = await this.getAIContext();
  const preferences = context.preferences;
  preferences[key] = value;

  await this.updateAIContext({ preferences });
  return this.getAIContext();
}

// Get formatted context for AI injection
async getContextForAI() {
  const context = await this.getAIContext();
  const profile = await this.getProfile();
  const recentMessages = await this.getMessages({ limit: 5 });
  const recentCalls = await this.getCalls({ limit: 3 });

  // Build comprehensive context string
  let aiPromptContext = `
## Customer Context

### Identity
- Name: ${profile.name || 'Unknown'}
- Company: ${profile.company || 'N/A'}
- Title: ${profile.title || 'N/A'}
- Status: ${profile.status}
- Lead Score: ${profile.lead_score}/100

### Summary
${context.summary || 'No summary available yet.'}

### Key Facts
${context.key_facts.length > 0
  ? context.key_facts.map(f => `- ${f.fact}`).join('\n')
  : '- No key facts recorded yet'}

### Communication Preferences
- Preferred Style: ${context.conversation_style || 'Not specified'}
- Best Contact Time: ${context.best_contact_time || 'Any time'}
- Response Urgency: ${context.response_urgency}
- Language: ${profile.language}

### Current Sentiment & Engagement
- Sentiment Trend: ${context.sentiment_trend}
- Engagement Level: ${context.engagement_level}
- Risk Level: ${context.risk_level}

### Known Pain Points
${context.pain_points.filter(p => !p.resolved).length > 0
  ? context.pain_points.filter(p => !p.resolved).map(p => `- [${p.severity}] ${p.issue}`).join('\n')
  : '- No active pain points'}

### Goals & Interests
${context.goals.length > 0
  ? context.goals.map(g => `- ${g}`).join('\n')
  : '- Goals not yet identified'}

### Products
- Currently Using: ${context.products_owned.join(', ') || 'None'}
- Interested In: ${context.products_interested.join(', ') || 'Unknown'}

### Topics to Avoid / Handle Carefully
${context.escalation_triggers.length > 0
  ? context.escalation_triggers.map(t => `- ⚠️ ${t}`).join('\n')
  : '- No sensitive topics identified'}

### Relationship Notes
${context.relationship_notes || 'No relationship notes.'}

### Last Interaction
${context.last_interaction_summary || 'No recent interaction summary.'}
`.trim();

  return {
    contextString: aiPromptContext,
    structured: context,
    profile,
    recentActivity: {
      messages: recentMessages.length,
      calls: recentCalls.length,
    }
  };
}

// Auto-update context after interactions (called by AI)
async autoUpdateContextFromInteraction(interactionType, content, sentiment = null) {
  const context = await this.getAIContext();

  if (!context.auto_update_enabled) return;

  // Update last interaction summary
  const summaryUpdate = {
    last_interaction_summary: `${interactionType} on ${new Date().toISOString().split('T')[0]}: ${content.substring(0, 200)}...`
  };

  // Update sentiment if provided
  if (sentiment) {
    summaryUpdate.sentiment_trend = sentiment;
  }

  await this.updateAIContext(summaryUpdate, 'auto');
}

// AI-powered context enrichment (call periodically or after significant interactions)
async enrichContextWithAI() {
  const profile = await this.getProfile();
  const messages = await this.getMessages({ limit: 20 });
  const calls = await this.getCalls({ limit: 10 });
  const currentContext = await this.getAIContext();

  // Prepare data for AI analysis
  const interactionHistory = [
    ...messages.map(m => ({
      type: 'message',
      channel: m.channel,
      direction: m.direction,
      content: m.content.substring(0, 500),
      date: m.created_at
    })),
    ...calls.map(c => ({
      type: 'call',
      direction: c.direction,
      summary: c.summary,
      sentiment: c.sentiment,
      duration: c.duration_seconds,
      date: c.created_at
    }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  // Call AI to analyze and update context
  const analysisPrompt = `
Analyze this customer's interaction history and current context.
Provide updates to their AI context/memory.

Current Context:
${JSON.stringify(currentContext, null, 2)}

Recent Interactions:
${JSON.stringify(interactionHistory.slice(0, 10), null, 2)}

Customer Profile:
${JSON.stringify(profile, null, 2)}

Respond with a JSON object containing any updates needed:
{
  "summary": "Updated 2-3 sentence summary of this customer",
  "key_facts": ["any new key facts discovered"],
  "sentiment_trend": "positive|neutral|negative",
  "engagement_level": "high|medium|low",
  "pain_points": ["any new pain points identified"],
  "goals": ["any goals or interests identified"],
  "conversation_style": "description of their communication style",
  "risk_level": "low|medium|high"
}

Only include fields that need updating. Be concise.
`;

  try {
    const response = await this.env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [
        { role: 'system', content: 'You are an AI that analyzes customer interactions and maintains their profile context. Respond only with valid JSON.' },
        { role: 'user', content: analysisPrompt }
      ],
      max_tokens: 1024,
      temperature: 0.3,
    });

    // Parse and apply updates
    const updates = JSON.parse(response.response);

    // Merge arrays instead of replacing
    if (updates.key_facts && Array.isArray(updates.key_facts)) {
      const existing = currentContext.key_facts.map(f => f.fact);
      updates.key_facts = [
        ...currentContext.key_facts,
        ...updates.key_facts
          .filter(f => !existing.includes(f))
          .map(f => ({ fact: f, source: 'ai', addedAt: new Date().toISOString() }))
      ];
    }

    if (updates.pain_points && Array.isArray(updates.pain_points)) {
      const existing = currentContext.pain_points.map(p => p.issue);
      updates.pain_points = [
        ...currentContext.pain_points,
        ...updates.pain_points
          .filter(p => !existing.includes(p))
          .map(p => ({ issue: p, severity: 'medium', identifiedAt: new Date().toISOString(), resolved: false, source: 'ai' }))
      ];
    }

    if (updates.goals && Array.isArray(updates.goals)) {
      updates.goals = [...new Set([...currentContext.goals, ...updates.goals])];
    }

    await this.updateAIContext(updates, 'ai_enrichment');

    return { success: true, updates };
  } catch (error) {
    console.error('AI context enrichment failed:', error);
    return { success: false, error: error.message };
  }
}
```

### Using Context in Conversations

```javascript
// Enhanced sendMessage that includes context
async sendMessageWithContext({ channel, content, ...params }) {
  // Get AI context to inform the response
  const { contextString } = await this.getContextForAI();

  // Send the message
  const message = await this.sendMessage({ channel, content, ...params });

  // Auto-update context based on outbound message
  await this.autoUpdateContextFromInteraction(
    `Outbound ${channel}`,
    content
  );

  return message;
}

// Enhanced receiveMessage that updates context
async receiveMessageWithContext({ channel, content, ...params }) {
  // Receive the message
  const message = await this.receiveMessage({ channel, content, ...params });

  // Auto-update context based on inbound message
  await this.autoUpdateContextFromInteraction(
    `Inbound ${channel}`,
    content
  );

  // Trigger AI enrichment if significant interaction
  if (content.length > 100) {
    // Queue enrichment (don't block)
    this.enrichContextWithAI().catch(console.error);
  }

  return message;
}
```

---

# 2. Conversation Durable Object

Manages individual conversation threads with full history, context, and real-time updates.

## Why DO over D1?

- **Real-time streaming**: WebSocket for live message updates
- **Conversation state**: Typing indicators, read receipts
- **Context window management**: Intelligent message selection for AI
- **No race conditions**: Single-threaded message ordering

```javascript
// src/durable-objects/ConversationDO.js
import { DurableObject } from "cloudflare:workers";

export class ConversationDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // In-memory state for real-time features
    this.typingUsers = new Map(); // userId -> timestamp
    this.activeParticipants = new Set();

    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  async initializeSchema() {
    this.sql.exec(`
      -- Conversation metadata
      CREATE TABLE IF NOT EXISTS metadata (
        id TEXT PRIMARY KEY DEFAULT 'conversation',
        customer_id TEXT,
        tenant_id TEXT,
        channel TEXT DEFAULT 'chat',
        status TEXT DEFAULT 'active',
        subject TEXT,
        assigned_to_id TEXT,
        assigned_to_name TEXT,
        priority TEXT DEFAULT 'normal',
        tags TEXT DEFAULT '[]',
        ai_enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        closed_at TEXT
      );

      -- Messages in conversation
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        sender_id TEXT,
        sender_name TEXT,
        sender_type TEXT DEFAULT 'user',
        attachments TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        tokens_used INTEGER DEFAULT 0,
        is_ai_generated INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- AI context for this conversation
      CREATE TABLE IF NOT EXISTS ai_state (
        id TEXT PRIMARY KEY DEFAULT 'state',
        system_prompt TEXT,
        context_messages TEXT DEFAULT '[]',
        total_tokens INTEGER DEFAULT 0,
        max_tokens INTEGER DEFAULT 32000,
        temperature REAL DEFAULT 0.7,
        model TEXT DEFAULT '@cf/qwen/qwen3-30b-a3b-fp8'
      );

      -- Read receipts
      CREATE TABLE IF NOT EXISTS read_receipts (
        user_id TEXT PRIMARY KEY,
        last_read_message_id TEXT,
        last_read_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

      INSERT OR IGNORE INTO metadata (id) VALUES ('conversation');
      INSERT OR IGNORE INTO ai_state (id) VALUES ('state');
    `);
  }

  // ============================================
  // CONVERSATION MANAGEMENT
  // ============================================

  async initialize({ customerId, tenantId, channel, subject, assignedTo }) {
    this.sql.exec(`
      UPDATE metadata SET
        customer_id = ?,
        tenant_id = ?,
        channel = ?,
        subject = ?,
        assigned_to_id = ?,
        updated_at = datetime('now')
      WHERE id = 'conversation'
    `, customerId, tenantId, channel, subject, assignedTo?.id);

    return this.getMetadata();
  }

  async getMetadata() {
    return this.sql.exec("SELECT * FROM metadata WHERE id = 'conversation'").one();
  }

  // ============================================
  // MESSAGE HANDLING
  // ============================================

  async addMessage({ role, content, senderId, senderName, senderType = 'user', contentType = 'text', attachments = [], isAI = false }) {
    const id = crypto.randomUUID();
    const tokensUsed = Math.ceil(content.length / 4); // Rough estimate

    this.sql.exec(`
      INSERT INTO messages (id, role, content, content_type, sender_id, sender_name, sender_type, attachments, tokens_used, is_ai_generated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, role, content, contentType, senderId, senderName, senderType, JSON.stringify(attachments), tokensUsed, isAI ? 1 : 0);

    // Update conversation timestamp
    this.sql.exec("UPDATE metadata SET updated_at = datetime('now') WHERE id = 'conversation'");

    // Broadcast to connected clients
    await this.broadcastMessage('new_message', {
      id,
      role,
      content,
      senderName,
      senderType,
      createdAt: new Date().toISOString()
    });

    return this.getMessage(id);
  }

  async getMessage(id) {
    return this.sql.exec("SELECT * FROM messages WHERE id = ?", id).one();
  }

  async getMessages({ limit = 50, before = null, after = null }) {
    let query = "SELECT * FROM messages WHERE 1=1";
    const params = [];

    if (before) {
      query += " AND created_at < ?";
      params.push(before);
    }
    if (after) {
      query += " AND created_at > ?";
      params.push(after);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const messages = this.sql.exec(query, ...params).toArray();
    return messages.reverse(); // Return in chronological order
  }

  // ============================================
  // AI RESPONSE GENERATION
  // ============================================

  async generateAIResponse(customerContext = null) {
    const metadata = await this.getMetadata();
    if (!metadata.ai_enabled) {
      return { error: 'AI is disabled for this conversation' };
    }

    const aiState = this.sql.exec("SELECT * FROM ai_state WHERE id = 'state'").one();
    const messages = await this.getMessages({ limit: 20 });

    // Build messages for AI
    const aiMessages = [
      {
        role: 'system',
        content: aiState.system_prompt || this.getDefaultSystemPrompt(customerContext)
      },
      ...messages.map(m => ({
        role: m.role === 'customer' ? 'user' : m.role,
        content: m.content
      }))
    ];

    try {
      const response = await this.env.AI.run(aiState.model, {
        messages: aiMessages,
        max_tokens: 1024,
        temperature: aiState.temperature,
        stream: false,
      });

      // Add AI response as message
      const aiMessage = await this.addMessage({
        role: 'assistant',
        content: response.response,
        senderType: 'ai',
        senderName: 'Kira',
        isAI: true
      });

      return aiMessage;
    } catch (error) {
      console.error('AI response generation failed:', error);
      return { error: error.message };
    }
  }

  getDefaultSystemPrompt(customerContext) {
    return `You are Kira, an AI assistant for PPP Academy.

${customerContext ? `## Customer Context\n${customerContext}\n` : ''}

Instructions:
- Be helpful, professional, and concise
- If you reference customer information, do so naturally
- Don't make up information not in the context
- If unsure, ask clarifying questions
- Use markdown formatting when helpful`;
  }

  // ============================================
  // REAL-TIME FEATURES
  // ============================================

  async setTyping(userId, isTyping) {
    if (isTyping) {
      this.typingUsers.set(userId, Date.now());
    } else {
      this.typingUsers.delete(userId);
    }

    await this.broadcastMessage('typing', {
      userId,
      isTyping,
      typingUsers: Array.from(this.typingUsers.keys())
    });
  }

  async markAsRead(userId, messageId) {
    this.sql.exec(`
      INSERT INTO read_receipts (user_id, last_read_message_id, last_read_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        last_read_message_id = ?,
        last_read_at = datetime('now')
    `, userId, messageId, messageId);

    await this.broadcastMessage('read_receipt', { userId, messageId });
  }

  // ============================================
  // WEBSOCKET HANDLING
  // ============================================

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      const url = new URL(request.url);
      const userId = url.searchParams.get('userId');
      const userName = url.searchParams.get('userName');

      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ userId, userName, connectedAt: Date.now() });

      this.activeParticipants.add(userId);

      // Notify others of join
      await this.broadcastMessage('participant_joined', { userId, userName });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected WebSocket", { status: 400 });
  }

  async webSocketMessage(ws, message) {
    const data = JSON.parse(message);
    const attachment = ws.deserializeAttachment();

    switch (data.type) {
      case 'typing':
        await this.setTyping(attachment.userId, data.isTyping);
        break;

      case 'message':
        await this.addMessage({
          role: data.role || 'user',
          content: data.content,
          senderId: attachment.userId,
          senderName: attachment.userName,
          senderType: 'user'
        });
        break;

      case 'read':
        await this.markAsRead(attachment.userId, data.messageId);
        break;
    }
  }

  async webSocketClose(ws, code, reason) {
    const attachment = ws.deserializeAttachment();
    if (attachment?.userId) {
      this.activeParticipants.delete(attachment.userId);
      this.typingUsers.delete(attachment.userId);
      await this.broadcastMessage('participant_left', { userId: attachment.userId });
    }
  }

  async broadcastMessage(type, data) {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch (e) {
        // Socket closed
      }
    }
  }
}
```

---

# 3. Rate Limiter Durable Object

Provides distributed rate limiting with in-memory counters and sliding windows.

## Why DO over D1?

- **In-memory counters**: Microsecond-level checks
- **No database overhead**: Rate checks happen entirely in memory
- **Atomic operations**: Single-threaded, no race conditions
- **Sliding windows**: Complex algorithms without distributed locking

```javascript
// src/durable-objects/RateLimiterDO.js
import { DurableObject } from "cloudflare:workers";

export class RateLimiterDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;

    // In-memory sliding window counters
    this.windows = new Map(); // key -> { count, windowStart }
    this.tokenBuckets = new Map(); // key -> { tokens, lastRefill }
  }

  // ============================================
  // SLIDING WINDOW RATE LIMITING
  // ============================================

  async checkRateLimit({ key, limit, windowMs }) {
    const now = Date.now();
    const windowKey = `${key}:sliding`;

    let window = this.windows.get(windowKey);

    if (!window || now - window.windowStart >= windowMs) {
      // New window
      window = { count: 0, windowStart: now };
    }

    if (window.count >= limit) {
      const resetIn = windowMs - (now - window.windowStart);
      return {
        allowed: false,
        remaining: 0,
        resetIn,
        retryAfter: Math.ceil(resetIn / 1000)
      };
    }

    window.count++;
    this.windows.set(windowKey, window);

    return {
      allowed: true,
      remaining: limit - window.count,
      resetIn: windowMs - (now - window.windowStart)
    };
  }

  // ============================================
  // TOKEN BUCKET RATE LIMITING
  // ============================================

  async checkTokenBucket({ key, maxTokens, refillRate, tokensNeeded = 1 }) {
    const now = Date.now();
    const bucketKey = `${key}:bucket`;

    let bucket = this.tokenBuckets.get(bucketKey);

    if (!bucket) {
      bucket = { tokens: maxTokens, lastRefill: now };
    }

    // Refill tokens based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / 1000) * refillRate;
    bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    if (bucket.tokens < tokensNeeded) {
      const waitTime = ((tokensNeeded - bucket.tokens) / refillRate) * 1000;
      return {
        allowed: false,
        tokens: bucket.tokens,
        retryAfter: Math.ceil(waitTime / 1000)
      };
    }

    bucket.tokens -= tokensNeeded;
    this.tokenBuckets.set(bucketKey, bucket);

    return {
      allowed: true,
      tokens: bucket.tokens
    };
  }

  // ============================================
  // CONCURRENT REQUEST LIMITING
  // ============================================

  async acquireLock({ key, maxConcurrent, timeoutMs = 30000 }) {
    const lockKey = `lock:${key}`;
    const now = Date.now();

    // Get current locks
    let locks = await this.ctx.storage.get(lockKey) || [];

    // Clean expired locks
    locks = locks.filter(l => now - l.acquiredAt < timeoutMs);

    if (locks.length >= maxConcurrent) {
      return { acquired: false, current: locks.length, max: maxConcurrent };
    }

    const lockId = crypto.randomUUID();
    locks.push({ lockId, acquiredAt: now });
    await this.ctx.storage.put(lockKey, locks);

    return { acquired: true, lockId, current: locks.length, max: maxConcurrent };
  }

  async releaseLock({ key, lockId }) {
    const lockKey = `lock:${key}`;
    let locks = await this.ctx.storage.get(lockKey) || [];
    locks = locks.filter(l => l.lockId !== lockId);
    await this.ctx.storage.put(lockKey, locks);
    return { released: true };
  }

  // ============================================
  // COMBINED CHECK (API Rate Limiting)
  // ============================================

  async checkAPIRateLimit({ apiKeyId, endpoint, config }) {
    const checks = [];

    // Per-minute limit
    if (config.perMinute) {
      checks.push(this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:minute`,
        limit: config.perMinute,
        windowMs: 60 * 1000
      }));
    }

    // Per-hour limit
    if (config.perHour) {
      checks.push(this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:hour`,
        limit: config.perHour,
        windowMs: 60 * 60 * 1000
      }));
    }

    // Per-day limit
    if (config.perDay) {
      checks.push(this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:day`,
        limit: config.perDay,
        windowMs: 24 * 60 * 60 * 1000
      }));
    }

    const results = await Promise.all(checks);
    const blocked = results.find(r => !r.allowed);

    if (blocked) {
      return {
        allowed: false,
        ...blocked
      };
    }

    return {
      allowed: true,
      limits: results
    };
  }
}
```

---

# 4. Agent Durable Object

Manages AI agent instances with their own personality, tools, and conversation memory.

## Why DO over D1?

- **Agent state**: Persistent memory across conversations
- **Tool execution**: Single-threaded tool calls
- **Learning**: Agent improves based on feedback
- **Isolation**: Each agent has independent state

```javascript
// src/durable-objects/AgentDO.js
import { DurableObject } from "cloudflare:workers";

export class AgentDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  async initializeSchema() {
    this.sql.exec(`
      -- Agent configuration
      CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY DEFAULT 'agent',
        name TEXT DEFAULT 'Kira',
        persona TEXT,
        system_prompt TEXT,
        model TEXT DEFAULT '@cf/qwen/qwen3-30b-a3b-fp8',
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 1024,
        tools TEXT DEFAULT '[]',
        knowledge_sources TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Agent memory (long-term learnings)
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance REAL DEFAULT 0.5,
        access_count INTEGER DEFAULT 0,
        last_accessed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Successful interaction patterns
      CREATE TABLE IF NOT EXISTS learned_patterns (
        id TEXT PRIMARY KEY,
        trigger TEXT NOT NULL,
        response_pattern TEXT NOT NULL,
        success_rate REAL DEFAULT 0,
        usage_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Feedback log
      CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        conversation_id TEXT,
        message_id TEXT,
        rating INTEGER,
        comment TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type);
      CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory(importance DESC);

      INSERT OR IGNORE INTO config (id) VALUES ('agent');
    `);
  }

  // ============================================
  // AGENT CONFIGURATION
  // ============================================

  async getConfig() {
    const config = this.sql.exec("SELECT * FROM config WHERE id = 'agent'").one();
    config.tools = JSON.parse(config.tools || '[]');
    config.knowledge_sources = JSON.parse(config.knowledge_sources || '[]');
    return config;
  }

  async updateConfig(updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    fields.push("updated_at = datetime('now')");
    values.push('agent');

    this.sql.exec(`UPDATE config SET ${fields.join(', ')} WHERE id = ?`, ...values);
    return this.getConfig();
  }

  // ============================================
  // MEMORY MANAGEMENT
  // ============================================

  async addMemory({ type, content, importance = 0.5 }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO memory (id, type, content, importance)
      VALUES (?, ?, ?, ?)
    `, id, type, content, importance);

    return { id, type, content, importance };
  }

  async recallMemories({ type = null, limit = 10, minImportance = 0 }) {
    let query = "SELECT * FROM memory WHERE importance >= ?";
    const params = [minImportance];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY importance DESC, last_accessed_at DESC LIMIT ?";
    params.push(limit);

    const memories = this.sql.exec(query, ...params).toArray();

    // Update access counts
    for (const memory of memories) {
      this.sql.exec(`
        UPDATE memory SET access_count = access_count + 1, last_accessed_at = datetime('now')
        WHERE id = ?
      `, memory.id);
    }

    return memories;
  }

  // ============================================
  // LEARNING FROM FEEDBACK
  // ============================================

  async recordFeedback({ conversationId, messageId, rating, comment }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO feedback (id, conversation_id, message_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
    `, id, conversationId, messageId, rating, comment);

    // If positive feedback, learn from it
    if (rating >= 4) {
      await this.learnFromPositiveFeedback(conversationId, messageId);
    }

    return { id, recorded: true };
  }

  async learnFromPositiveFeedback(conversationId, messageId) {
    // This would analyze the successful interaction and extract patterns
    // For now, just log it
    await this.addMemory({
      type: 'positive_feedback',
      content: `Positive feedback for message ${messageId} in conversation ${conversationId}`,
      importance: 0.7
    });
  }

  // ============================================
  // GENERATE RESPONSE
  // ============================================

  async generateResponse({ messages, customerContext = null }) {
    const config = await this.getConfig();
    const memories = await this.recallMemories({ limit: 5, minImportance: 0.3 });

    // Build system prompt with memories
    let systemPrompt = config.system_prompt || `You are ${config.name}, an AI assistant.`;

    if (config.persona) {
      systemPrompt += `\n\nPersonality: ${config.persona}`;
    }

    if (customerContext) {
      systemPrompt += `\n\n${customerContext}`;
    }

    if (memories.length > 0) {
      systemPrompt += `\n\nRelevant memories:\n${memories.map(m => `- ${m.content}`).join('\n')}`;
    }

    const aiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    const response = await this.env.AI.run(config.model, {
      messages: aiMessages,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
    });

    return {
      response: response.response,
      model: config.model,
      memoriesUsed: memories.length
    };
  }
}
```

---

# 5. Notification Durable Object

Manages per-user notification state, preferences, and real-time delivery.

## Why DO over D1?

- **Real-time delivery**: WebSocket push notifications
- **User presence**: Track online/offline status
- **Batching**: Aggregate notifications intelligently
- **Preferences**: Per-user delivery rules

```javascript
// src/durable-objects/NotificationDO.js
import { DurableObject } from "cloudflare:workers";

export class NotificationDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // In-memory presence state
    this.isOnline = false;
    this.lastSeen = null;
    this.pendingNotifications = [];

    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  async initializeSchema() {
    this.sql.exec(`
      -- User preferences
      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY DEFAULT 'prefs',
        email_enabled INTEGER DEFAULT 1,
        push_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        quiet_hours_start TEXT,
        quiet_hours_end TEXT,
        digest_frequency TEXT DEFAULT 'instant',
        channels TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Notifications
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        data TEXT DEFAULT '{}',
        priority TEXT DEFAULT 'normal',
        channel TEXT,
        status TEXT DEFAULT 'pending',
        delivered_at TEXT,
        read_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Notification history (for analytics)
      CREATE TABLE IF NOT EXISTS delivery_log (
        id TEXT PRIMARY KEY,
        notification_id TEXT,
        method TEXT,
        status TEXT,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

      INSERT OR IGNORE INTO preferences (id) VALUES ('prefs');
    `);
  }

  // ============================================
  // NOTIFICATION MANAGEMENT
  // ============================================

  async send({ type, title, body, data = {}, priority = 'normal', channel = null }) {
    const id = crypto.randomUUID();
    const prefs = await this.getPreferences();

    // Store notification
    this.sql.exec(`
      INSERT INTO notifications (id, type, title, body, data, priority, channel)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, id, type, title, body, JSON.stringify(data), priority, channel);

    const notification = { id, type, title, body, data, priority, channel, createdAt: new Date().toISOString() };

    // Try real-time delivery first
    if (this.isOnline) {
      await this.deliverRealtime(notification);
    } else {
      // Queue for when user comes online
      this.pendingNotifications.push(notification);

      // Maybe send email/push based on preferences
      if (prefs.email_enabled && priority === 'high') {
        await this.sendEmail(notification);
      }
    }

    return notification;
  }

  async deliverRealtime(notification) {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify({ type: 'notification', notification });

    for (const ws of sockets) {
      try {
        ws.send(message);

        // Mark as delivered
        this.sql.exec(
          "UPDATE notifications SET status = 'delivered', delivered_at = datetime('now') WHERE id = ?",
          notification.id
        );
      } catch (e) {
        // Socket closed
      }
    }
  }

  async sendEmail(notification) {
    // Send via email service
    this.sql.exec(`
      INSERT INTO delivery_log (id, notification_id, method, status)
      VALUES (?, ?, 'email', 'sent')
    `, crypto.randomUUID(), notification.id);
  }

  // ============================================
  // PRESENCE & WEBSOCKET
  // ============================================

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.isOnline = true;

      // Deliver pending notifications
      for (const notification of this.pendingNotifications) {
        server.send(JSON.stringify({ type: 'notification', notification }));
      }
      this.pendingNotifications = [];

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected WebSocket", { status: 400 });
  }

  async webSocketClose(ws, code, reason) {
    this.isOnline = false;
    this.lastSeen = new Date().toISOString();
  }

  async webSocketMessage(ws, message) {
    const data = JSON.parse(message);

    if (data.type === 'mark_read') {
      this.sql.exec(
        "UPDATE notifications SET read_at = datetime('now'), status = 'read' WHERE id = ?",
        data.notificationId
      );
    }
  }

  // ============================================
  // PREFERENCES
  // ============================================

  async getPreferences() {
    const prefs = this.sql.exec("SELECT * FROM preferences WHERE id = 'prefs'").one();
    prefs.channels = JSON.parse(prefs.channels || '{}');
    return prefs;
  }

  async updatePreferences(updates) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }

    values.push('prefs');
    this.sql.exec(`UPDATE preferences SET ${fields.join(', ')} WHERE id = ?`, ...values);

    return this.getPreferences();
  }

  // ============================================
  // QUERIES
  // ============================================

  async getUnread() {
    return this.sql.exec(
      "SELECT * FROM notifications WHERE read_at IS NULL ORDER BY created_at DESC LIMIT 50"
    ).toArray();
  }

  async getNotifications({ limit = 50, status = null }) {
    let query = "SELECT * FROM notifications WHERE 1=1";
    const params = [];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    return this.sql.exec(query, ...params).toArray();
  }
}
```

---

# 6. Workflow Durable Object

Manages long-running business processes with state machines.

## Why DO over D1?

- **State machine**: Persistent workflow state
- **Timers**: Alarms for scheduled steps
- **Retries**: Built-in retry logic
- **Isolation**: Each workflow instance independent

```javascript
// src/durable-objects/WorkflowDO.js
import { DurableObject } from "cloudflare:workers";

export class WorkflowDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  async initializeSchema() {
    this.sql.exec(`
      -- Workflow instance
      CREATE TABLE IF NOT EXISTS workflow (
        id TEXT PRIMARY KEY DEFAULT 'instance',
        definition_id TEXT,
        name TEXT,
        status TEXT DEFAULT 'pending',
        current_step TEXT,
        context TEXT DEFAULT '{}',
        input TEXT DEFAULT '{}',
        output TEXT DEFAULT '{}',
        error TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Step executions
      CREATE TABLE IF NOT EXISTS steps (
        id TEXT PRIMARY KEY,
        step_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        input TEXT DEFAULT '{}',
        output TEXT DEFAULT '{}',
        error TEXT,
        retry_count INTEGER DEFAULT 0,
        started_at TEXT,
        completed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Scheduled tasks (using alarms)
      CREATE TABLE IF NOT EXISTS scheduled (
        id TEXT PRIMARY KEY,
        step_id TEXT,
        scheduled_for TEXT NOT NULL,
        executed INTEGER DEFAULT 0
      );

      INSERT OR IGNORE INTO workflow (id) VALUES ('instance');
    `);
  }

  // ============================================
  // WORKFLOW LIFECYCLE
  // ============================================

  async start({ definitionId, name, input }) {
    this.sql.exec(`
      UPDATE workflow SET
        definition_id = ?,
        name = ?,
        status = 'running',
        input = ?,
        started_at = datetime('now')
      WHERE id = 'instance'
    `, definitionId, name, JSON.stringify(input));

    // Execute first step
    const definition = await this.getDefinition(definitionId);
    if (definition.steps.length > 0) {
      await this.executeStep(definition.steps[0], input);
    }

    return this.getStatus();
  }

  async getStatus() {
    const workflow = this.sql.exec("SELECT * FROM workflow WHERE id = 'instance'").one();
    workflow.context = JSON.parse(workflow.context || '{}');
    workflow.input = JSON.parse(workflow.input || '{}');
    workflow.output = JSON.parse(workflow.output || '{}');
    return workflow;
  }

  // ============================================
  // STEP EXECUTION
  // ============================================

  async executeStep(stepDef, input) {
    const executionId = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO steps (id, step_id, status, input, started_at)
      VALUES (?, ?, 'running', ?, datetime('now'))
    `, executionId, stepDef.id, JSON.stringify(input));

    this.sql.exec("UPDATE workflow SET current_step = ? WHERE id = 'instance'", stepDef.id);

    try {
      // Execute step based on type
      let output;

      switch (stepDef.type) {
        case 'action':
          output = await this.executeAction(stepDef, input);
          break;
        case 'wait':
          await this.scheduleWait(stepDef, executionId);
          return; // Don't complete yet
        case 'condition':
          output = await this.evaluateCondition(stepDef, input);
          break;
        case 'parallel':
          output = await this.executeParallel(stepDef, input);
          break;
        default:
          throw new Error(`Unknown step type: ${stepDef.type}`);
      }

      // Mark step complete
      this.sql.exec(`
        UPDATE steps SET status = 'completed', output = ?, completed_at = datetime('now')
        WHERE id = ?
      `, JSON.stringify(output), executionId);

      // Proceed to next step
      await this.proceedToNextStep(stepDef, output);

    } catch (error) {
      await this.handleStepError(executionId, stepDef, error);
    }
  }

  async executeAction(stepDef, input) {
    // Execute the action based on its definition
    // This would call external services, send emails, etc.
    return { executed: true, ...input };
  }

  async scheduleWait(stepDef, executionId) {
    const waitUntil = new Date(Date.now() + (stepDef.duration || 60000));

    this.sql.exec(`
      INSERT INTO scheduled (id, step_id, scheduled_for)
      VALUES (?, ?, ?)
    `, crypto.randomUUID(), stepDef.id, waitUntil.toISOString());

    // Set alarm
    await this.ctx.storage.setAlarm(waitUntil.getTime());
  }

  async alarm() {
    // Handle scheduled wakeup
    const scheduled = this.sql.exec(
      "SELECT * FROM scheduled WHERE executed = 0 AND scheduled_for <= datetime('now') LIMIT 1"
    ).one();

    if (scheduled) {
      this.sql.exec("UPDATE scheduled SET executed = 1 WHERE id = ?", scheduled.id);

      // Continue workflow
      const workflow = await this.getStatus();
      await this.proceedToNextStep({ id: scheduled.step_id }, workflow.context);
    }
  }

  async proceedToNextStep(currentStep, output) {
    const workflow = await this.getStatus();
    const definition = await this.getDefinition(workflow.definition_id);

    // Find next step
    const currentIndex = definition.steps.findIndex(s => s.id === currentStep.id);

    if (currentIndex < definition.steps.length - 1) {
      // More steps to execute
      const nextStep = definition.steps[currentIndex + 1];
      await this.executeStep(nextStep, { ...workflow.context, ...output });
    } else {
      // Workflow complete
      this.sql.exec(`
        UPDATE workflow SET status = 'completed', output = ?, completed_at = datetime('now')
        WHERE id = 'instance'
      `, JSON.stringify(output));
    }
  }

  async handleStepError(executionId, stepDef, error) {
    const step = this.sql.exec("SELECT * FROM steps WHERE id = ?", executionId).one();

    if (step.retry_count < (stepDef.maxRetries || 3)) {
      // Retry
      this.sql.exec(
        "UPDATE steps SET retry_count = retry_count + 1, error = ? WHERE id = ?",
        error.message, executionId
      );

      // Schedule retry with backoff
      const backoff = Math.pow(2, step.retry_count) * 1000;
      await this.ctx.storage.setAlarm(Date.now() + backoff);
    } else {
      // Mark failed
      this.sql.exec(`
        UPDATE steps SET status = 'failed', error = ?, completed_at = datetime('now')
        WHERE id = ?
      `, error.message, executionId);

      this.sql.exec(
        "UPDATE workflow SET status = 'failed', error = ? WHERE id = 'instance'",
        error.message
      );
    }
  }

  async getDefinition(definitionId) {
    // In production, fetch from D1 or config
    return {
      id: definitionId,
      steps: [
        { id: 'step1', type: 'action', name: 'Initialize' },
        { id: 'step2', type: 'wait', duration: 60000, name: 'Wait 1 minute' },
        { id: 'step3', type: 'action', name: 'Complete' },
      ]
    };
  }
}
```

---

# 7. Analytics Aggregator Durable Object

Real-time analytics aggregation per tenant with time-series data.

## Why DO over D1?

- **Real-time counters**: In-memory aggregation
- **Time bucketing**: Efficient time-series storage
- **No write amplification**: Batch writes
- **Hot path optimization**: Common queries in memory

```javascript
// src/durable-objects/AnalyticsDO.js
import { DurableObject } from "cloudflare:workers";

export class AnalyticsDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // In-memory aggregations (flushed periodically)
    this.counters = new Map();
    this.gauges = new Map();
    this.lastFlush = Date.now();

    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });

    // Schedule periodic flush
    this.ctx.storage.setAlarm(Date.now() + 60000);
  }

  async initializeSchema() {
    this.sql.exec(`
      -- Time-series metrics
      CREATE TABLE IF NOT EXISTS metrics (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        bucket TEXT NOT NULL,
        value REAL NOT NULL,
        count INTEGER DEFAULT 1,
        min_value REAL,
        max_value REAL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Daily aggregates
      CREATE TABLE IF NOT EXISTS daily_aggregates (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        metrics TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_metrics_name_bucket ON metrics(name, bucket);
      CREATE INDEX IF NOT EXISTS idx_daily_date ON daily_aggregates(date);
    `);
  }

  // ============================================
  // REAL-TIME TRACKING
  // ============================================

  async increment(name, value = 1) {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);

    // Auto-flush if too many pending
    if (this.counters.size > 100) {
      await this.flush();
    }
  }

  async gauge(name, value) {
    this.gauges.set(name, {
      value,
      timestamp: Date.now()
    });
  }

  async track(name, value) {
    const bucket = this.getBucket(Date.now(), 'minute');
    const key = `${name}:${bucket}`;

    const existing = this.counters.get(key) || { sum: 0, count: 0, min: value, max: value };
    existing.sum += value;
    existing.count += 1;
    existing.min = Math.min(existing.min, value);
    existing.max = Math.max(existing.max, value);

    this.counters.set(key, existing);
  }

  getBucket(timestamp, granularity) {
    const date = new Date(timestamp);

    switch (granularity) {
      case 'minute':
        return `${date.toISOString().slice(0, 16)}`;
      case 'hour':
        return `${date.toISOString().slice(0, 13)}`;
      case 'day':
        return `${date.toISOString().slice(0, 10)}`;
      default:
        return date.toISOString();
    }
  }

  // ============================================
  // FLUSH & PERSIST
  // ============================================

  async flush() {
    const now = Date.now();
    const bucket = this.getBucket(now, 'minute');

    // Persist counters
    for (const [key, value] of this.counters) {
      const [name, metricBucket] = key.includes(':') ? key.split(':') : [key, bucket];

      if (typeof value === 'number') {
        // Simple counter
        this.sql.exec(`
          INSERT INTO metrics (id, name, bucket, value, count)
          VALUES (?, ?, ?, ?, 1)
          ON CONFLICT(id) DO UPDATE SET value = value + ?, count = count + 1
        `, `${name}:${metricBucket}`, name, metricBucket, value, value);
      } else {
        // Aggregated metric
        this.sql.exec(`
          INSERT INTO metrics (id, name, bucket, value, count, min_value, max_value)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            value = value + ?,
            count = count + ?,
            min_value = MIN(min_value, ?),
            max_value = MAX(max_value, ?)
        `,
          `${name}:${metricBucket}`, name, metricBucket, value.sum, value.count, value.min, value.max,
          value.sum, value.count, value.min, value.max
        );
      }
    }

    this.counters.clear();
    this.lastFlush = now;
  }

  async alarm() {
    await this.flush();

    // Aggregate daily if new day
    const today = this.getBucket(Date.now(), 'day');
    const existingDaily = this.sql.exec(
      "SELECT * FROM daily_aggregates WHERE date = ?", today
    ).one();

    if (!existingDaily) {
      await this.aggregateDaily(today);
    }

    // Schedule next flush
    await this.ctx.storage.setAlarm(Date.now() + 60000);
  }

  async aggregateDaily(date) {
    const metrics = this.sql.exec(`
      SELECT name, SUM(value) as total, SUM(count) as count,
             MIN(min_value) as min, MAX(max_value) as max
      FROM metrics
      WHERE bucket LIKE ?
      GROUP BY name
    `, `${date}%`).toArray();

    this.sql.exec(`
      INSERT INTO daily_aggregates (id, date, metrics)
      VALUES (?, ?, ?)
    `, `daily:${date}`, date, JSON.stringify(metrics));
  }

  // ============================================
  // QUERIES
  // ============================================

  async getMetrics({ name, from, to, granularity = 'hour' }) {
    // Flush first to ensure fresh data
    await this.flush();

    const fromBucket = this.getBucket(new Date(from).getTime(), granularity);
    const toBucket = this.getBucket(new Date(to).getTime(), granularity);

    return this.sql.exec(`
      SELECT * FROM metrics
      WHERE name = ? AND bucket >= ? AND bucket <= ?
      ORDER BY bucket ASC
    `, name, fromBucket, toBucket).toArray();
  }

  async getDashboard() {
    await this.flush();

    const today = this.getBucket(Date.now(), 'day');

    // Today's totals
    const todayMetrics = this.sql.exec(`
      SELECT name, SUM(value) as total, SUM(count) as count
      FROM metrics
      WHERE bucket LIKE ?
      GROUP BY name
    `, `${today}%`).toArray();

    // Current gauges
    const currentGauges = Object.fromEntries(this.gauges);

    // Last 7 days trend
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const weeklyTrend = this.sql.exec(`
      SELECT date, metrics FROM daily_aggregates
      WHERE date >= ?
      ORDER BY date DESC
    `, weekAgo).toArray();

    return {
      today: todayMetrics,
      gauges: currentGauges,
      weeklyTrend
    };
  }
}
```

---

# Summary: Complete DO Architecture

| Durable Object | Purpose | Key Advantage |
|----------------|---------|---------------|
| **TenantDO** | Organization management | Centralized settings, billing |
| **CustomerDO** | Contact relationship + AI Context | Memory that follows customer |
| **ConversationDO** | Chat threads | Real-time messaging, AI responses |
| **RateLimiterDO** | API rate limiting | Microsecond checks, sliding windows |
| **AgentDO** | AI bot instances | Persistent personality, learning |
| **NotificationDO** | User notifications | Real-time push, preferences |
| **WorkflowDO** | Business processes | State machines, timers, retries |
| **AnalyticsDO** | Metrics aggregation | Real-time counters, time-series |

## wrangler.toml (Complete)

```toml
name = "ppp-academy-api"
main = "src/index.js"
compatibility_date = "2025-11-27"

# Durable Object bindings
[[durable_objects.bindings]]
name = "TENANT"
class_name = "TenantDO"

[[durable_objects.bindings]]
name = "CUSTOMER"
class_name = "CustomerDO"

[[durable_objects.bindings]]
name = "CONVERSATION"
class_name = "ConversationDO"

[[durable_objects.bindings]]
name = "RATE_LIMITER"
class_name = "RateLimiterDO"

[[durable_objects.bindings]]
name = "AGENT"
class_name = "AgentDO"

[[durable_objects.bindings]]
name = "NOTIFICATION"
class_name = "NotificationDO"

[[durable_objects.bindings]]
name = "WORKFLOW"
class_name = "WorkflowDO"

[[durable_objects.bindings]]
name = "ANALYTICS"
class_name = "AnalyticsDO"

# Migrations
[[migrations]]
tag = "v1"
new_sqlite_classes = [
  "TenantDO",
  "CustomerDO",
  "ConversationDO",
  "RateLimiterDO",
  "AgentDO",
  "NotificationDO",
  "WorkflowDO",
  "AnalyticsDO"
]
```

## Sources

- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/)
- [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [Durable Objects Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/)
