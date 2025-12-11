import { DurableObject } from "cloudflare:workers";

export class ConversationDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.typingUsers = new Map();
    this.activeParticipants = new Set();

    // Initialize schema in blockConcurrencyWhile
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  async initializeSchema() {
    const sql = this.ctx.storage.sql;

    // Metadata table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        customer_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        subject TEXT,
        assigned_to TEXT,
        priority TEXT DEFAULT 'normal',
        tags TEXT,
        ai_enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Messages table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sender_id TEXT,
        sender_name TEXT,
        sender_type TEXT,
        attachments TEXT,
        tokens_used INTEGER DEFAULT 0,
        is_ai_generated INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // AI state table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS ai_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        system_prompt TEXT,
        context_messages TEXT,
        total_tokens INTEGER DEFAULT 0,
        max_tokens INTEGER DEFAULT 2048,
        temperature REAL DEFAULT 0.7,
        model TEXT DEFAULT '@cf/aisingapore/gemma-sea-lion-v4-27b-it'
      )
    `);

    // Read receipts table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS read_receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        read_at INTEGER NOT NULL,
        UNIQUE(user_id, message_id)
      )
    `);

    // Create indices for better performance
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_read_receipts_user ON read_receipts(user_id)`);
  }

  async initialize(metadata) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Check if already initialized
    const existing = sql.exec("SELECT id FROM metadata WHERE id = 1").toArray();
    if (existing.length > 0) {
      throw new Error("Conversation already initialized");
    }

    // Insert metadata
    const stmt = sql.exec(`
      INSERT INTO metadata (
        id, customer_id, tenant_id, channel, status, subject,
        assigned_to, priority, tags, ai_enabled, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      1,
      metadata.customer_id,
      metadata.tenant_id,
      metadata.channel,
      metadata.status || 'open',
      metadata.subject || null,
      metadata.assigned_to || null,
      metadata.priority || 'normal',
      metadata.tags ? JSON.stringify(metadata.tags) : null,
      metadata.ai_enabled !== false ? 1 : 0,
      now,
      now
    );

    // Initialize AI state with default system prompt
    const defaultPrompt = this.getDefaultSystemPrompt(metadata);
    sql.exec(`
      INSERT INTO ai_state (
        id, system_prompt, context_messages, total_tokens,
        max_tokens, temperature, model
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      1,
      defaultPrompt,
      JSON.stringify([]),
      0,
      metadata.max_tokens || 2048,
      metadata.temperature || 0.7,
      metadata.model || '@cf/aisingapore/gemma-sea-lion-v4-27b-it'
    );

    return { success: true, created_at: now };
  }

  async getMetadata() {
    const sql = this.ctx.storage.sql;
    const result = sql.exec("SELECT * FROM metadata WHERE id = 1").toArray();

    if (result.length === 0) {
      return null;
    }

    const metadata = result[0];
    return {
      ...metadata,
      tags: metadata.tags ? JSON.parse(metadata.tags) : [],
      ai_enabled: metadata.ai_enabled === 1
    };
  }

  async addMessage(message) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const result = sql.exec(`
      INSERT INTO messages (
        role, content, sender_id, sender_name, sender_type,
        attachments, tokens_used, is_ai_generated, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `,
      message.role,
      message.content,
      message.sender_id || null,
      message.sender_name || null,
      message.sender_type || null,
      message.attachments ? JSON.stringify(message.attachments) : null,
      message.tokens_used || 0,
      message.is_ai_generated ? 1 : 0,
      now
    );

    const messageId = result.toArray()[0].id;

    // Update conversation updated_at
    sql.exec("UPDATE metadata SET updated_at = ? WHERE id = 1", now);

    const savedMessage = {
      id: messageId,
      ...message,
      created_at: now,
      attachments: message.attachments || null
    };

    // Broadcast to WebSocket connections
    await this.broadcastMessage({
      type: 'new_message',
      message: savedMessage
    });

    return savedMessage;
  }

  async getMessage(messageId) {
    const sql = this.ctx.storage.sql;
    const result = sql.exec("SELECT * FROM messages WHERE id = ?", messageId).toArray();

    if (result.length === 0) {
      return null;
    }

    const message = result[0];
    return {
      ...message,
      attachments: message.attachments ? JSON.parse(message.attachments) : null,
      is_ai_generated: message.is_ai_generated === 1
    };
  }

  async getMessages(options = {}) {
    const sql = this.ctx.storage.sql;
    const limit = options.limit || 100;
    const offset = options.offset || 0;

    let query = "SELECT * FROM messages ORDER BY created_at DESC";
    const params = [];

    if (limit) {
      query += " LIMIT ?";
      params.push(limit);
    }

    if (offset) {
      query += " OFFSET ?";
      params.push(offset);
    }

    const results = sql.exec(query, ...params).toArray();

    return results.map(msg => ({
      ...msg,
      attachments: msg.attachments ? JSON.parse(msg.attachments) : null,
      is_ai_generated: msg.is_ai_generated === 1
    }));
  }

  getDefaultSystemPrompt(customerContext = {}) {
    const { customer_id, tenant_id, channel } = customerContext;

    return `You are Kira, a helpful AI assistant powered by KeyReply - an intelligent conversational platform for customer engagement.

Your role:
- Provide accurate, helpful information and support
- Maintain a professional yet friendly tone
- Be concise but thorough in your responses
- Ask clarifying questions when needed
- Escalate complex issues to human agents when appropriate

Customer Context:
- Customer ID: ${customer_id || 'Unknown'}
- Tenant: ${tenant_id || 'Unknown'}
- Channel: ${channel || 'Unknown'}

Guidelines:
- Always prioritize customer success and satisfaction
- Provide examples when explaining complex concepts
- Reference specific resources when relevant
- Be patient and helpful with customers at all levels`;
  }

  async generateAIResponse(customerContext = {}) {
    const sql = this.ctx.storage.sql;

    // Get AI state
    const aiStateResult = sql.exec("SELECT * FROM ai_state WHERE id = 1").toArray();
    if (aiStateResult.length === 0) {
      throw new Error("AI state not initialized");
    }
    const aiState = aiStateResult[0];

    // Get recent messages for context
    const messages = await this.getMessages({ limit: 10 });
    const reversedMessages = messages.reverse();

    // Build messages array for AI
    const aiMessages = [
      {
        role: 'system',
        content: aiState.system_prompt || this.getDefaultSystemPrompt(customerContext)
      }
    ];

    // Add conversation history
    for (const msg of reversedMessages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        aiMessages.push({
          role: msg.role,
          content: msg.content
        });
      }
    }

    // Generate response using Workers AI
    const response = await this.env.AI.run(aiState.model, {
      messages: aiMessages,
      temperature: aiState.temperature,
      max_tokens: aiState.max_tokens
    });

    const aiContent = response.response || response.text || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    // Update total tokens
    sql.exec(
      "UPDATE ai_state SET total_tokens = total_tokens + ? WHERE id = 1",
      tokensUsed
    );

    // Save AI response as message
    const aiMessage = await this.addMessage({
      role: 'assistant',
      content: aiContent,
      sender_id: 'ai',
      sender_name: 'AI Assistant',
      sender_type: 'ai',
      tokens_used: tokensUsed,
      is_ai_generated: true
    });

    return aiMessage;
  }

  async setTyping(userId, userName, isTyping) {
    if (isTyping) {
      this.typingUsers.set(userId, {
        name: userName,
        timestamp: Date.now()
      });
    } else {
      this.typingUsers.delete(userId);
    }

    // Broadcast typing indicator
    await this.broadcastMessage({
      type: 'typing_indicator',
      user_id: userId,
      user_name: userName,
      is_typing: isTyping,
      typing_users: Array.from(this.typingUsers.entries()).map(([id, info]) => ({
        user_id: id,
        user_name: info.name
      }))
    });

    return { success: true };
  }

  async markAsRead(userId, messageId) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    sql.exec(`
      INSERT OR REPLACE INTO read_receipts (user_id, message_id, read_at)
      VALUES (?, ?, ?)
    `, userId, messageId, now);

    // Broadcast read receipt
    await this.broadcastMessage({
      type: 'read_receipt',
      user_id: userId,
      message_id: messageId,
      read_at: now
    });

    return { success: true };
  }

  async broadcastMessage(data) {
    // Get all connected WebSocket sessions
    const sessions = this.ctx.getWebSockets();
    const message = JSON.stringify(data);

    for (const ws of sessions) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Error broadcasting to WebSocket:', error);
      }
    }
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      this.activeParticipants.add(server);

      // Send current state to new connection
      const metadata = await this.getMetadata();
      server.send(JSON.stringify({
        type: 'connection_established',
        metadata: metadata
      }));

      return new Response(null, {
        status: 101,
        webSocket: client
      });
    }

    // REST API endpoints
    if (request.method === "POST" && url.pathname === "/initialize") {
      const body = await request.json();
      const result = await this.initialize(body);
      return Response.json(result);
    }

    if (request.method === "GET" && url.pathname === "/metadata") {
      const metadata = await this.getMetadata();
      return Response.json(metadata);
    }

    if (request.method === "POST" && url.pathname === "/messages") {
      const body = await request.json();
      const message = await this.addMessage(body);
      return Response.json(message);
    }

    if (request.method === "GET" && url.pathname === "/messages") {
      const limit = parseInt(url.searchParams.get("limit")) || 100;
      const offset = parseInt(url.searchParams.get("offset")) || 0;
      const messages = await this.getMessages({ limit, offset });
      return Response.json(messages);
    }

    if (request.method === "POST" && url.pathname === "/generate-ai-response") {
      const body = await request.json();
      const message = await this.generateAIResponse(body.customerContext || {});
      return Response.json(message);
    }

    if (request.method === "POST" && url.pathname === "/typing") {
      const body = await request.json();
      const result = await this.setTyping(body.user_id, body.user_name, body.is_typing);
      return Response.json(result);
    }

    if (request.method === "POST" && url.pathname === "/mark-read") {
      const body = await request.json();
      const result = await this.markAsRead(body.user_id, body.message_id);
      return Response.json(result);
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'typing':
          await this.setTyping(data.user_id, data.user_name, data.is_typing);
          break;

        case 'mark_read':
          await this.markAsRead(data.user_id, data.message_id);
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    this.activeParticipants.delete(ws);

    // Clean up typing indicators for this connection
    // Note: We'd need to track which user each WebSocket belongs to for proper cleanup
    console.log('WebSocket closed:', { code, reason, wasClean });
  }

  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    this.activeParticipants.delete(ws);
  }
}
