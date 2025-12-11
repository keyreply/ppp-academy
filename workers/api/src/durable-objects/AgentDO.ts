import { DurableObject } from "cloudflare:workers";

export class AgentDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;

    // Initialize schema in blockConcurrencyWhile
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  async initializeSchema() {
    const sql = this.ctx.storage.sql;

    // Config table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        persona TEXT,
        system_prompt TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
        temperature REAL DEFAULT 0.7,
        max_tokens INTEGER DEFAULT 2048,
        tools TEXT,
        knowledge_sources TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Memory table - stores agent's learned information
    sql.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 5,
        access_count INTEGER DEFAULT 0,
        last_accessed_at INTEGER,
        created_at INTEGER NOT NULL
      )
    `);

    // Learned patterns table - stores successful interaction patterns
    sql.exec(`
      CREATE TABLE IF NOT EXISTS learned_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trigger TEXT NOT NULL,
        response_pattern TEXT NOT NULL,
        success_rate REAL DEFAULT 0.0,
        usage_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Feedback table - stores user feedback on responses
    sql.exec(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Create indices for better performance
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_memory_type ON memory(type)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_memory_importance ON memory(importance)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_memory_accessed ON memory(last_accessed_at)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_patterns_trigger ON learned_patterns(trigger)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_conversation ON feedback(conversation_id)`);
  }

  async getConfig() {
    const sql = this.ctx.storage.sql;
    const result = sql.exec("SELECT * FROM config WHERE id = 1").toArray();

    if (result.length === 0) {
      return null;
    }

    const config = result[0];
    return {
      ...config,
      tools: config.tools ? JSON.parse(config.tools) : [],
      knowledge_sources: config.knowledge_sources ? JSON.parse(config.knowledge_sources) : []
    };
  }

  async updateConfig(configData) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Check if config exists
    const existing = sql.exec("SELECT id FROM config WHERE id = 1").toArray();

    if (existing.length === 0) {
      // Insert new config
      sql.exec(`
        INSERT INTO config (
          id, name, persona, system_prompt, model, temperature,
          max_tokens, tools, knowledge_sources, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        1,
        configData.name,
        configData.persona || null,
        configData.system_prompt,
        configData.model || '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
        configData.temperature || 0.7,
        configData.max_tokens || 2048,
        configData.tools ? JSON.stringify(configData.tools) : null,
        configData.knowledge_sources ? JSON.stringify(configData.knowledge_sources) : null,
        now,
        now
      );
    } else {
      // Update existing config
      const updates = [];
      const params = [];

      if (configData.name !== undefined) {
        updates.push("name = ?");
        params.push(configData.name);
      }
      if (configData.persona !== undefined) {
        updates.push("persona = ?");
        params.push(configData.persona);
      }
      if (configData.system_prompt !== undefined) {
        updates.push("system_prompt = ?");
        params.push(configData.system_prompt);
      }
      if (configData.model !== undefined) {
        updates.push("model = ?");
        params.push(configData.model);
      }
      if (configData.temperature !== undefined) {
        updates.push("temperature = ?");
        params.push(configData.temperature);
      }
      if (configData.max_tokens !== undefined) {
        updates.push("max_tokens = ?");
        params.push(configData.max_tokens);
      }
      if (configData.tools !== undefined) {
        updates.push("tools = ?");
        params.push(JSON.stringify(configData.tools));
      }
      if (configData.knowledge_sources !== undefined) {
        updates.push("knowledge_sources = ?");
        params.push(JSON.stringify(configData.knowledge_sources));
      }

      updates.push("updated_at = ?");
      params.push(now);

      if (updates.length > 0) {
        sql.exec(
          `UPDATE config SET ${updates.join(", ")} WHERE id = 1`,
          ...params
        );
      }
    }

    return await this.getConfig();
  }

  async addMemory(memoryData) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const result = sql.exec(`
      INSERT INTO memory (
        type, content, importance, access_count, created_at
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `,
      memoryData.type,
      memoryData.content,
      memoryData.importance || 5,
      0,
      now
    );

    const memoryId = result.toArray()[0].id;

    return {
      id: memoryId,
      type: memoryData.type,
      content: memoryData.content,
      importance: memoryData.importance || 5,
      access_count: 0,
      created_at: now
    };
  }

  async recallMemories(type = null, limit = 10, minImportance = 0) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    let query = "SELECT * FROM memory WHERE importance >= ?";
    const params = [minImportance];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }

    query += " ORDER BY importance DESC, last_accessed_at DESC LIMIT ?";
    params.push(limit);

    const memories = sql.exec(query, ...params).toArray();

    // Update access count and last accessed time for retrieved memories
    if (memories.length > 0) {
      const memoryIds = memories.map(m => m.id);
      const placeholders = memoryIds.map(() => '?').join(',');
      sql.exec(
        `UPDATE memory
         SET access_count = access_count + 1, last_accessed_at = ?
         WHERE id IN (${placeholders})`,
        now,
        ...memoryIds
      );
    }

    return memories;
  }

  async recordFeedback(feedbackData) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const result = sql.exec(`
      INSERT INTO feedback (
        conversation_id, message_id, rating, comment, created_at
      ) VALUES (?, ?, ?, ?, ?)
      RETURNING id
    `,
      feedbackData.conversation_id,
      feedbackData.message_id,
      feedbackData.rating,
      feedbackData.comment || null,
      now
    );

    const feedbackId = result.toArray()[0].id;

    // If positive feedback, learn from it
    if (feedbackData.rating >= 4) {
      await this.learnFromPositiveFeedback(feedbackData);
    }

    return {
      id: feedbackId,
      ...feedbackData,
      created_at: now
    };
  }

  async learnFromPositiveFeedback(feedbackData) {
    // This method could be enhanced to analyze the conversation
    // and extract patterns from successful interactions

    // For now, we'll create a simple memory entry for highly-rated interactions
    if (feedbackData.rating === 5 && feedbackData.comment) {
      await this.addMemory({
        type: 'positive_interaction',
        content: `High rating (5/5) for conversation ${feedbackData.conversation_id}, message ${feedbackData.message_id}. Comment: ${feedbackData.comment}`,
        importance: 8
      });
    }

    return { success: true };
  }

  async generateResponse(messages, customerContext = {}) {
    const sql = this.ctx.storage.sql;

    // Get agent config
    const config = await this.getConfig();
    if (!config) {
      throw new Error("Agent config not initialized");
    }

    // Recall relevant memories
    const memories = await this.recallMemories(null, 5, 6);

    // Build enhanced system prompt with memories
    let enhancedSystemPrompt = config.system_prompt;

    if (config.persona) {
      enhancedSystemPrompt += `\n\nPersona: ${config.persona}`;
    }

    if (memories.length > 0) {
      enhancedSystemPrompt += '\n\nRelevant Context from Previous Interactions:';
      memories.forEach((memory, idx) => {
        enhancedSystemPrompt += `\n${idx + 1}. [${memory.type}] ${memory.content}`;
      });
    }

    if (Object.keys(customerContext).length > 0) {
      enhancedSystemPrompt += '\n\nCustomer Context:';
      for (const [key, value] of Object.entries(customerContext)) {
        enhancedSystemPrompt += `\n- ${key}: ${value}`;
      }
    }

    // Build messages array for AI
    const aiMessages = [
      {
        role: 'system',
        content: enhancedSystemPrompt
      },
      ...messages
    ];

    // Generate response using Workers AI
    const response = await this.env.AI.run(config.model, {
      messages: aiMessages,
      temperature: config.temperature,
      max_tokens: config.max_tokens
    });

    const aiContent = response.response || response.text || '';
    const tokensUsed = response.usage?.total_tokens || 0;

    // Store interaction as memory if it seems important
    // This is a simple heuristic - could be enhanced with more sophisticated analysis
    if (messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage.role === 'user') {
        const messageLength = lastUserMessage.content.length;
        const importance = messageLength > 200 ? 7 : 5;

        await this.addMemory({
          type: 'conversation',
          content: `Q: ${lastUserMessage.content.substring(0, 200)}... A: ${aiContent.substring(0, 200)}...`,
          importance: importance
        });
      }
    }

    return {
      content: aiContent,
      tokens_used: tokensUsed,
      memories_used: memories.length,
      model: config.model
    };
  }

  async getStats() {
    const sql = this.ctx.storage.sql;

    const memoryCount = sql.exec("SELECT COUNT(*) as count FROM memory").toArray()[0].count;
    const patternCount = sql.exec("SELECT COUNT(*) as count FROM learned_patterns").toArray()[0].count;
    const feedbackCount = sql.exec("SELECT COUNT(*) as count FROM feedback").toArray()[0].count;

    const avgRating = sql.exec("SELECT AVG(rating) as avg FROM feedback").toArray()[0].avg || 0;

    const topMemories = sql.exec(`
      SELECT type, COUNT(*) as count
      FROM memory
      GROUP BY type
      ORDER BY count DESC
      LIMIT 5
    `).toArray();

    return {
      memory_count: memoryCount,
      pattern_count: patternCount,
      feedback_count: feedbackCount,
      average_rating: avgRating,
      top_memory_types: topMemories
    };
  }

  async fetch(request) {
    const url = new URL(request.url);

    // GET /config - Get agent configuration
    if (request.method === "GET" && url.pathname === "/config") {
      const config = await this.getConfig();
      return Response.json(config);
    }

    // POST /config - Update agent configuration
    if (request.method === "POST" && url.pathname === "/config") {
      const body = await request.json();
      const config = await this.updateConfig(body);
      return Response.json(config);
    }

    // POST /memory - Add new memory
    if (request.method === "POST" && url.pathname === "/memory") {
      const body = await request.json();
      const memory = await this.addMemory(body);
      return Response.json(memory);
    }

    // GET /memories - Recall memories
    if (request.method === "GET" && url.pathname === "/memories") {
      const type = url.searchParams.get("type");
      const limit = parseInt(url.searchParams.get("limit")) || 10;
      const minImportance = parseInt(url.searchParams.get("min_importance")) || 0;

      const memories = await this.recallMemories(type, limit, minImportance);
      return Response.json(memories);
    }

    // POST /feedback - Record feedback
    if (request.method === "POST" && url.pathname === "/feedback") {
      const body = await request.json();
      const feedback = await this.recordFeedback(body);
      return Response.json(feedback);
    }

    // POST /generate - Generate AI response
    if (request.method === "POST" && url.pathname === "/generate") {
      const body = await request.json();
      const result = await this.generateResponse(
        body.messages || [],
        body.customerContext || {}
      );
      return Response.json(result);
    }

    // GET /stats - Get agent statistics
    if (request.method === "GET" && url.pathname === "/stats") {
      const stats = await this.getStats();
      return Response.json(stats);
    }

    return new Response("Not found", { status: 404 });
  }
}
