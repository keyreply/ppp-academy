import { DurableObject } from "cloudflare:workers";

/**
 * CustomerDO - Customer Durable Object with AI Context/Memory
 *
 * Manages individual customer relationships across all touchpoints with:
 * - Customer profile and contact points
 * - Messages (email, WhatsApp, SMS) with attachments
 * - Call logs with recordings, transcripts, and sentiment
 * - Activities timeline
 * - Notes and tasks
 * - AI Context/Memory for personalized interactions
 * - Real-time WebSocket updates with hibernation
 * - GDPR compliance (export/delete)
 */
export class CustomerDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.ctx = ctx;

    // Initialize database schema on first access
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  /**
   * Initialize SQLite schema for customer data
   */
  async initializeSchema() {
    const sql = this.ctx.storage.sql;

    // Customer profile table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS customer (
        id TEXT PRIMARY KEY DEFAULT 'customer',
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        whatsapp_id TEXT,
        company TEXT,
        title TEXT,
        status TEXT DEFAULT 'active',
        lead_score INTEGER DEFAULT 0,
        tags TEXT,
        custom_fields TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Contact points table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS contact_points (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        verified INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // Messages table (email, WhatsApp, SMS)
    sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        direction TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        subject TEXT,
        body TEXT,
        html_body TEXT,
        status TEXT DEFAULT 'pending',
        attachments TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        sent_at INTEGER,
        delivered_at INTEGER,
        read_at INTEGER
      )
    `);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)`);

    // Calls table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        from_number TEXT,
        to_number TEXT,
        status TEXT DEFAULT 'initiated',
        duration INTEGER DEFAULT 0,
        recording_url TEXT,
        transcript TEXT,
        summary TEXT,
        sentiment TEXT,
        key_points TEXT,
        action_items TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        ended_at INTEGER
      )
    `);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at DESC)`);

    // Activities timeline
    sql.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        actor TEXT,
        metadata TEXT,
        created_at INTEGER NOT NULL
      )
    `);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC)`);

    // Notes table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        author TEXT,
        pinned INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at DESC)`);

    // Tasks table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        assigned_to TEXT,
        due_date INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);

    // AI Context/Memory table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS ai_context (
        id TEXT PRIMARY KEY DEFAULT 'context',
        summary TEXT,
        key_facts TEXT,
        preferences TEXT,
        pain_points TEXT,
        goals TEXT,
        relationship_notes TEXT,
        conversation_style TEXT,
        best_contact_time TEXT,
        response_urgency TEXT,
        escalation_triggers TEXT,
        products_owned TEXT,
        products_interested TEXT,
        lifetime_value REAL DEFAULT 0,
        risk_level TEXT,
        last_interaction_summary TEXT,
        sentiment_trend TEXT,
        engagement_level TEXT,
        updated_at INTEGER NOT NULL
      )
    `);
  }

  /**
   * Get or create customer profile
   */
  async getCustomer() {
    const sql = this.ctx.storage.sql;
    const result = sql.exec("SELECT * FROM customer WHERE id = 'customer'").toArray();

    if (result.length > 0) {
      const customer = result[0];
      return {
        ...customer,
        tags: customer.tags ? JSON.parse(customer.tags) : [],
        custom_fields: customer.custom_fields ? JSON.parse(customer.custom_fields) : {}
      };
    }

    return null;
  }

  /**
   * Create or update customer profile
   */
  async upsertCustomer(data) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const existing = await this.getCustomer();
    const tags = data.tags ? JSON.stringify(data.tags) : '[]';
    const custom_fields = data.custom_fields ? JSON.stringify(data.custom_fields) : '{}';

    if (existing) {
      sql.exec(`
        UPDATE customer SET
          name = ?1,
          email = ?2,
          phone = ?3,
          whatsapp_id = ?4,
          company = ?5,
          title = ?6,
          status = ?7,
          lead_score = ?8,
          tags = ?9,
          custom_fields = ?10,
          updated_at = ?11
        WHERE id = 'customer'
      `,
        data.name || existing.name,
        data.email || existing.email,
        data.phone || existing.phone,
        data.whatsapp_id || existing.whatsapp_id,
        data.company || existing.company,
        data.title || existing.title,
        data.status || existing.status,
        data.lead_score !== undefined ? data.lead_score : existing.lead_score,
        tags,
        custom_fields,
        now
      );
    } else {
      sql.exec(`
        INSERT INTO customer (
          id, tenant_id, name, email, phone, whatsapp_id,
          company, title, status, lead_score, tags, custom_fields,
          created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
      `,
        'customer',
        data.tenant_id,
        data.name,
        data.email || null,
        data.phone || null,
        data.whatsapp_id || null,
        data.company || null,
        data.title || null,
        data.status || 'active',
        data.lead_score || 0,
        tags,
        custom_fields,
        now,
        now
      );
    }

    await this.logActivity('customer_updated', 'Customer profile updated', null, data);
    await this.broadcastUpdate({ type: 'customer_updated', data: await this.getCustomer() });

    return await this.getCustomer();
  }

  // ============================================
  // Contact Points Management
  // ============================================

  async addContactPoint(type, value, isPrimary = false) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    if (isPrimary) {
      sql.exec("UPDATE contact_points SET is_primary = 0 WHERE type = ?", type);
    }

    sql.exec(`
      INSERT INTO contact_points (id, type, value, is_primary, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5)
    `, id, type, value, isPrimary ? 1 : 0, now);

    return { id, type, value, is_primary: isPrimary, created_at: now };
  }

  async getContactPoints() {
    const sql = this.ctx.storage.sql;
    return sql.exec("SELECT * FROM contact_points ORDER BY is_primary DESC, created_at ASC").toArray();
  }

  // ============================================
  // Messages Management (Email, WhatsApp, SMS)
  // ============================================

  /**
   * Send email message
   */
  async sendEmail(to, subject, body, htmlBody = null, attachments = []) {
    return await this.sendMessage('email', {
      to_address: to,
      subject,
      body,
      html_body: htmlBody,
      attachments
    });
  }

  /**
   * Receive email message
   */
  async receiveEmail(from, subject, body, htmlBody = null, attachments = []) {
    return await this.receiveMessage('email', {
      from_address: from,
      subject,
      body,
      html_body: htmlBody,
      attachments
    });
  }

  /**
   * Send WhatsApp message
   */
  async sendWhatsApp(to, body, attachments = []) {
    return await this.sendMessage('whatsapp', {
      to_address: to,
      body,
      attachments
    });
  }

  /**
   * Receive WhatsApp message
   */
  async receiveWhatsApp(from, body, attachments = []) {
    return await this.receiveMessage('whatsapp', {
      from_address: from,
      body,
      attachments
    });
  }

  /**
   * Unified send message function
   */
  async sendMessage(channel, data) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    const customer = await this.getCustomer();
    const from_address = data.from_address || customer?.email || customer?.whatsapp_id;

    sql.exec(`
      INSERT INTO messages (
        id, channel, direction, from_address, to_address,
        subject, body, html_body, status, attachments, metadata, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `,
      id,
      channel,
      'outbound',
      from_address,
      data.to_address,
      data.subject || null,
      data.body,
      data.html_body || null,
      'sent',
      JSON.stringify(data.attachments || []),
      JSON.stringify(data.metadata || {}),
      now
    );

    await this.logActivity('message_sent', `${channel} message sent`, null, { channel, id });
    await this.broadcastUpdate({ type: 'message_sent', channel, message_id: id });

    // Auto-update AI context from interaction
    await this.autoUpdateContextFromInteraction('message', 'outbound', data.body);

    return { id, channel, direction: 'outbound', created_at: now, ...data };
  }

  /**
   * Unified receive message function
   */
  async receiveMessage(channel, data) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    const customer = await this.getCustomer();
    const to_address = data.to_address || customer?.email || customer?.whatsapp_id;

    sql.exec(`
      INSERT INTO messages (
        id, channel, direction, from_address, to_address,
        subject, body, html_body, status, attachments, metadata, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
    `,
      id,
      channel,
      'inbound',
      data.from_address,
      to_address,
      data.subject || null,
      data.body,
      data.html_body || null,
      'received',
      JSON.stringify(data.attachments || []),
      JSON.stringify(data.metadata || {}),
      now
    );

    await this.logActivity('message_received', `${channel} message received`, null, { channel, id });
    await this.broadcastUpdate({ type: 'message_received', channel, message_id: id });

    // Auto-update AI context from interaction
    await this.autoUpdateContextFromInteraction('message', 'inbound', data.body);

    return { id, channel, direction: 'inbound', created_at: now, ...data };
  }

  /**
   * Get messages with filters
   */
  async getMessages(filters = {}) {
    const sql = this.ctx.storage.sql;
    let query = "SELECT * FROM messages WHERE 1=1";
    const params = [];

    if (filters.channel) {
      query += " AND channel = ?";
      params.push(filters.channel);
    }

    if (filters.direction) {
      query += " AND direction = ?";
      params.push(filters.direction);
    }

    query += " ORDER BY created_at DESC";

    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    const result = sql.exec(query, ...params).toArray();
    return result.map(msg => ({
      ...msg,
      attachments: msg.attachments ? JSON.parse(msg.attachments) : [],
      metadata: msg.metadata ? JSON.parse(msg.metadata) : {}
    }));
  }

  /**
   * Update message status
   */
  async updateMessageStatus(messageId, status, timestamp = null) {
    const sql = this.ctx.storage.sql;
    const now = timestamp || Date.now();

    let field = 'sent_at';
    if (status === 'delivered') field = 'delivered_at';
    if (status === 'read') field = 'read_at';

    sql.exec(`UPDATE messages SET status = ?1, ${field} = ?2 WHERE id = ?3`, status, now, messageId);
    await this.broadcastUpdate({ type: 'message_status_updated', message_id: messageId, status });
  }

  // ============================================
  // Calls Management
  // ============================================

  /**
   * Log a new call
   */
  async logCall(data) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    sql.exec(`
      INSERT INTO calls (
        id, direction, from_number, to_number, status, metadata, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
    `,
      id,
      data.direction,
      data.from_number,
      data.to_number,
      data.status || 'initiated',
      JSON.stringify(data.metadata || {}),
      now
    );

    await this.logActivity('call_logged', `${data.direction} call`, null, { id });
    await this.broadcastUpdate({ type: 'call_logged', call_id: id });

    return { id, created_at: now, ...data };
  }

  /**
   * Update call details
   */
  async updateCall(callId, updates) {
    const sql = this.ctx.storage.sql;
    const sets = [];
    const params = [];

    if (updates.status) {
      sets.push('status = ?');
      params.push(updates.status);
    }

    if (updates.duration !== undefined) {
      sets.push('duration = ?');
      params.push(updates.duration);
    }

    if (updates.recording_url) {
      sets.push('recording_url = ?');
      params.push(updates.recording_url);
    }

    if (updates.transcript) {
      sets.push('transcript = ?');
      params.push(updates.transcript);
    }

    if (updates.summary) {
      sets.push('summary = ?');
      params.push(updates.summary);
    }

    if (updates.sentiment) {
      sets.push('sentiment = ?');
      params.push(updates.sentiment);
    }

    if (updates.key_points) {
      sets.push('key_points = ?');
      params.push(JSON.stringify(updates.key_points));
    }

    if (updates.action_items) {
      sets.push('action_items = ?');
      params.push(JSON.stringify(updates.action_items));
    }

    if (updates.started_at) {
      sets.push('started_at = ?');
      params.push(updates.started_at);
    }

    if (updates.ended_at) {
      sets.push('ended_at = ?');
      params.push(updates.ended_at);
    }

    params.push(callId);

    if (sets.length > 0) {
      sql.exec(`UPDATE calls SET ${sets.join(', ')} WHERE id = ?`, ...params);
      await this.broadcastUpdate({ type: 'call_updated', call_id: callId });

      // Auto-update AI context from call
      if (updates.summary || updates.transcript) {
        await this.autoUpdateContextFromInteraction(
          'call',
          'both',
          updates.summary || updates.transcript,
          { sentiment: updates.sentiment }
        );
      }
    }
  }

  /**
   * Get calls with filters
   */
  async getCalls(filters = {}) {
    const sql = this.ctx.storage.sql;
    let query = "SELECT * FROM calls WHERE 1=1";
    const params = [];

    if (filters.direction) {
      query += " AND direction = ?";
      params.push(filters.direction);
    }

    query += " ORDER BY created_at DESC";

    if (filters.limit) {
      query += " LIMIT ?";
      params.push(filters.limit);
    }

    const result = sql.exec(query, ...params).toArray();
    return result.map(call => ({
      ...call,
      key_points: call.key_points ? JSON.parse(call.key_points) : [],
      action_items: call.action_items ? JSON.parse(call.action_items) : [],
      metadata: call.metadata ? JSON.parse(call.metadata) : {}
    }));
  }

  // ============================================
  // Activities Timeline
  // ============================================

  async logActivity(type, title, description = null, metadata = {}) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    sql.exec(`
      INSERT INTO activities (id, type, title, description, metadata, created_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `, id, type, title, description, JSON.stringify(metadata), now);

    return { id, type, title, description, metadata, created_at: now };
  }

  async getTimeline(limit = 50) {
    const sql = this.ctx.storage.sql;
    const result = sql.exec(
      "SELECT * FROM activities ORDER BY created_at DESC LIMIT ?",
      limit
    ).toArray();

    return result.map(activity => ({
      ...activity,
      metadata: activity.metadata ? JSON.parse(activity.metadata) : {}
    }));
  }

  async getActivitySummary(days = 30) {
    const sql = this.ctx.storage.sql;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

    const result = sql.exec(`
      SELECT type, COUNT(*) as count
      FROM activities
      WHERE created_at > ?
      GROUP BY type
    `, cutoff).toArray();

    return result.reduce((acc, row) => {
      acc[row.type] = row.count;
      return acc;
    }, {});
  }

  // ============================================
  // Notes Management
  // ============================================

  async addNote(content, author = null, pinned = false) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    sql.exec(`
      INSERT INTO notes (id, content, author, pinned, created_at, updated_at)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6)
    `, id, content, author, pinned ? 1 : 0, now, now);

    await this.logActivity('note_added', 'Note added', content.substring(0, 100), { author });
    await this.broadcastUpdate({ type: 'note_added', note_id: id });

    return { id, content, author, pinned, created_at: now, updated_at: now };
  }

  async getNotes(limit = 50) {
    const sql = this.ctx.storage.sql;
    return sql.exec(
      "SELECT * FROM notes ORDER BY pinned DESC, created_at DESC LIMIT ?",
      limit
    ).toArray();
  }

  async updateNote(noteId, updates) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();
    const sets = [];
    const params = [];

    if (updates.content) {
      sets.push('content = ?');
      params.push(updates.content);
    }

    if (updates.pinned !== undefined) {
      sets.push('pinned = ?');
      params.push(updates.pinned ? 1 : 0);
    }

    sets.push('updated_at = ?');
    params.push(now);
    params.push(noteId);

    sql.exec(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`, ...params);
    await this.broadcastUpdate({ type: 'note_updated', note_id: noteId });
  }

  async deleteNote(noteId) {
    const sql = this.ctx.storage.sql;
    sql.exec("DELETE FROM notes WHERE id = ?", noteId);
    await this.broadcastUpdate({ type: 'note_deleted', note_id: noteId });
  }

  // ============================================
  // Tasks Management
  // ============================================

  async addTask(data) {
    const sql = this.ctx.storage.sql;
    const id = crypto.randomUUID();
    const now = Date.now();

    sql.exec(`
      INSERT INTO tasks (
        id, title, description, status, priority, assigned_to, due_date, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    `,
      id,
      data.title,
      data.description || null,
      data.status || 'pending',
      data.priority || 'medium',
      data.assigned_to || null,
      data.due_date || null,
      now,
      now
    );

    await this.logActivity('task_created', `Task: ${data.title}`, null, { id });
    await this.broadcastUpdate({ type: 'task_created', task_id: id });

    return { id, created_at: now, updated_at: now, ...data };
  }

  async getTasks(filters = {}) {
    const sql = this.ctx.storage.sql;
    let query = "SELECT * FROM tasks WHERE 1=1";
    const params = [];

    if (filters.status) {
      query += " AND status = ?";
      params.push(filters.status);
    }

    if (filters.assigned_to) {
      query += " AND assigned_to = ?";
      params.push(filters.assigned_to);
    }

    query += " ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END, due_date ASC";

    return sql.exec(query, ...params).toArray();
  }

  async updateTask(taskId, updates) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();
    const sets = ['updated_at = ?'];
    const params = [now];

    if (updates.title) {
      sets.push('title = ?');
      params.push(updates.title);
    }

    if (updates.description !== undefined) {
      sets.push('description = ?');
      params.push(updates.description);
    }

    if (updates.status) {
      sets.push('status = ?');
      params.push(updates.status);

      if (updates.status === 'completed') {
        sets.push('completed_at = ?');
        params.push(now);
      }
    }

    if (updates.priority) {
      sets.push('priority = ?');
      params.push(updates.priority);
    }

    if (updates.assigned_to !== undefined) {
      sets.push('assigned_to = ?');
      params.push(updates.assigned_to);
    }

    if (updates.due_date !== undefined) {
      sets.push('due_date = ?');
      params.push(updates.due_date);
    }

    params.push(taskId);

    sql.exec(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ?`, ...params);
    await this.broadcastUpdate({ type: 'task_updated', task_id: taskId });

    if (updates.status === 'completed') {
      await this.logActivity('task_completed', 'Task completed', null, { task_id: taskId });
    }
  }

  async deleteTask(taskId) {
    const sql = this.ctx.storage.sql;
    sql.exec("DELETE FROM tasks WHERE id = ?", taskId);
    await this.broadcastUpdate({ type: 'task_deleted', task_id: taskId });
  }

  // ============================================
  // AI Context/Memory Management
  // ============================================

  /**
   * Get AI context
   */
  async getAIContext() {
    const sql = this.ctx.storage.sql;
    const result = sql.exec("SELECT * FROM ai_context WHERE id = 'context'").toArray();

    if (result.length > 0) {
      const context = result[0];
      return {
        ...context,
        key_facts: context.key_facts ? JSON.parse(context.key_facts) : [],
        preferences: context.preferences ? JSON.parse(context.preferences) : {},
        pain_points: context.pain_points ? JSON.parse(context.pain_points) : [],
        goals: context.goals ? JSON.parse(context.goals) : [],
        escalation_triggers: context.escalation_triggers ? JSON.parse(context.escalation_triggers) : [],
        products_owned: context.products_owned ? JSON.parse(context.products_owned) : [],
        products_interested: context.products_interested ? JSON.parse(context.products_interested) : []
      };
    }

    // Create default context
    const now = Date.now();
    sql.exec(`
      INSERT INTO ai_context (id, key_facts, preferences, pain_points, goals,
        escalation_triggers, products_owned, products_interested, updated_at)
      VALUES ('context', '[]', '{}', '[]', '[]', '[]', '[]', '[]', ?)
    `, now);

    return {
      id: 'context',
      key_facts: [],
      preferences: {},
      pain_points: [],
      goals: [],
      escalation_triggers: [],
      products_owned: [],
      products_interested: [],
      updated_at: now
    };
  }

  /**
   * Update AI context
   */
  async updateAIContext(updates) {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Ensure context exists
    await this.getAIContext();

    const sets = ['updated_at = ?'];
    const params = [now];

    const fields = [
      'summary', 'relationship_notes', 'conversation_style',
      'best_contact_time', 'response_urgency', 'risk_level',
      'last_interaction_summary', 'sentiment_trend', 'engagement_level'
    ];

    for (const field of fields) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(updates[field]);
      }
    }

    const jsonFields = [
      'key_facts', 'preferences', 'pain_points', 'goals',
      'escalation_triggers', 'products_owned', 'products_interested'
    ];

    for (const field of jsonFields) {
      if (updates[field] !== undefined) {
        sets.push(`${field} = ?`);
        params.push(JSON.stringify(updates[field]));
      }
    }

    if (updates.lifetime_value !== undefined) {
      sets.push('lifetime_value = ?');
      params.push(updates.lifetime_value);
    }

    sql.exec(`UPDATE ai_context SET ${sets.join(', ')} WHERE id = 'context'`, ...params);
    await this.broadcastUpdate({ type: 'ai_context_updated' });

    return await this.getAIContext();
  }

  /**
   * Add a key fact to AI context
   */
  async addKeyFact(fact) {
    const context = await this.getAIContext();
    const key_facts = context.key_facts || [];

    // Avoid duplicates
    if (!key_facts.includes(fact)) {
      key_facts.push(fact);
      await this.updateAIContext({ key_facts });
    }

    return key_facts;
  }

  /**
   * Add a pain point
   */
  async addPainPoint(painPoint) {
    const context = await this.getAIContext();
    const pain_points = context.pain_points || [];

    pain_points.push({
      description: painPoint,
      identified_at: Date.now(),
      resolved: false
    });

    await this.updateAIContext({ pain_points });
    return pain_points;
  }

  /**
   * Resolve a pain point
   */
  async resolvePainPoint(index) {
    const context = await this.getAIContext();
    const pain_points = context.pain_points || [];

    if (pain_points[index]) {
      pain_points[index].resolved = true;
      pain_points[index].resolved_at = Date.now();
      await this.updateAIContext({ pain_points });
    }

    return pain_points;
  }

  /**
   * Get formatted context for AI injection
   */
  async getContextForAI() {
    const customer = await this.getCustomer();
    const context = await this.getAIContext();
    const recentMessages = await this.getMessages({ limit: 10 });
    const recentCalls = await this.getCalls({ limit: 5 });

    let formatted = `Customer Profile:\n`;
    formatted += `Name: ${customer?.name || 'Unknown'}\n`;
    formatted += `Company: ${customer?.company || 'N/A'}\n`;
    formatted += `Title: ${customer?.title || 'N/A'}\n`;
    formatted += `Status: ${customer?.status || 'active'}\n`;
    formatted += `Lead Score: ${customer?.lead_score || 0}/100\n\n`;

    if (context.summary) {
      formatted += `Summary: ${context.summary}\n\n`;
    }

    if (context.key_facts && context.key_facts.length > 0) {
      formatted += `Key Facts:\n`;
      context.key_facts.forEach((fact, i) => {
        formatted += `${i + 1}. ${fact}\n`;
      });
      formatted += `\n`;
    }

    if (context.pain_points && context.pain_points.length > 0) {
      const unresolved = context.pain_points.filter(p => !p.resolved);
      if (unresolved.length > 0) {
        formatted += `Pain Points:\n`;
        unresolved.forEach((pain, i) => {
          formatted += `${i + 1}. ${pain.description}\n`;
        });
        formatted += `\n`;
      }
    }

    if (context.goals && context.goals.length > 0) {
      formatted += `Goals:\n`;
      context.goals.forEach((goal, i) => {
        formatted += `${i + 1}. ${goal}\n`;
      });
      formatted += `\n`;
    }

    if (context.preferences && Object.keys(context.preferences).length > 0) {
      formatted += `Preferences:\n`;
      for (const [key, value] of Object.entries(context.preferences)) {
        formatted += `- ${key}: ${value}\n`;
      }
      formatted += `\n`;
    }

    if (context.conversation_style) {
      formatted += `Conversation Style: ${context.conversation_style}\n`;
    }

    if (context.sentiment_trend) {
      formatted += `Sentiment Trend: ${context.sentiment_trend}\n`;
    }

    if (context.engagement_level) {
      formatted += `Engagement Level: ${context.engagement_level}\n`;
    }

    if (recentMessages.length > 0) {
      formatted += `\nRecent Messages (${recentMessages.length}):\n`;
      recentMessages.slice(0, 5).forEach(msg => {
        const date = new Date(msg.created_at).toISOString().split('T')[0];
        formatted += `- [${date}] ${msg.direction} via ${msg.channel}: ${msg.body?.substring(0, 100)}...\n`;
      });
    }

    if (recentCalls.length > 0) {
      formatted += `\nRecent Calls (${recentCalls.length}):\n`;
      recentCalls.slice(0, 3).forEach(call => {
        const date = new Date(call.created_at).toISOString().split('T')[0];
        formatted += `- [${date}] ${call.direction}, duration: ${call.duration}s, sentiment: ${call.sentiment || 'N/A'}\n`;
      });
    }

    return formatted;
  }

  /**
   * Auto-update context from interaction
   */
  async autoUpdateContextFromInteraction(type, direction, content, metadata = {}) {
    const context = await this.getAIContext();
    const now = Date.now();

    // Update last interaction summary
    const summary = content.substring(0, 200);
    await this.updateAIContext({
      last_interaction_summary: summary
    });

    // Update sentiment trend if provided
    if (metadata.sentiment) {
      await this.updateAIContext({
        sentiment_trend: metadata.sentiment
      });
    }

    // Calculate engagement level based on frequency
    const recentActivities = await this.getActivitySummary(7);
    const totalInteractions = Object.values(recentActivities).reduce((a, b) => a + b, 0);

    let engagement_level = 'low';
    if (totalInteractions > 20) engagement_level = 'high';
    else if (totalInteractions > 10) engagement_level = 'medium';

    await this.updateAIContext({ engagement_level });
  }

  /**
   * Enrich context using Workers AI
   */
  async enrichContextWithAI(prompt = null) {
    if (!this.env.AI) {
      throw new Error('Workers AI not available');
    }

    const customer = await this.getCustomer();
    const context = await this.getAIContext();
    const recentMessages = await this.getMessages({ limit: 20 });
    const recentCalls = await this.getCalls({ limit: 10 });

    // Build conversation history
    let conversationHistory = 'Recent conversation history:\n\n';

    recentMessages.forEach(msg => {
      conversationHistory += `[${msg.direction} ${msg.channel}] ${msg.body}\n\n`;
    });

    recentCalls.forEach(call => {
      if (call.summary) {
        conversationHistory += `[${call.direction} call] Summary: ${call.summary}\n\n`;
      }
    });

    const enrichmentPrompt = prompt || `
      Analyze this customer's conversation history and current context.
      Extract key insights including:
      1. Key facts about the customer
      2. Their pain points
      3. Their goals and objectives
      4. Communication preferences
      5. Conversation style
      6. Sentiment trend

      Current context:
      ${JSON.stringify(context, null, 2)}

      Customer profile:
      ${JSON.stringify(customer, null, 2)}

      ${conversationHistory}

      Provide your analysis in JSON format with these fields:
      {
        "key_facts": ["fact1", "fact2"],
        "pain_points": ["pain1", "pain2"],
        "goals": ["goal1", "goal2"],
        "conversation_style": "description",
        "sentiment_trend": "positive|neutral|negative"
      }
    `;

    try {
      // Use Gemma Sea Lion (SEA language support, 128K context)
      const response = await this.env.AI.run('@cf/aisingapore/gemma-sea-lion-v4-27b-it', {
        messages: [
          { role: 'system', content: 'You are a customer relationship analyst. Analyze conversations and extract key insights.' },
          { role: 'user', content: enrichmentPrompt }
        ]
      });

      // Parse AI response
      const aiInsights = JSON.parse(response.response || '{}');

      // Merge with existing context
      const updates = {
        key_facts: [...(context.key_facts || []), ...(aiInsights.key_facts || [])].slice(-20),
        pain_points: [...(context.pain_points || []), ...((aiInsights.pain_points || []).map(p => ({ description: p, identified_at: Date.now(), resolved: false })))],
        goals: [...(context.goals || []), ...(aiInsights.goals || [])].slice(-10),
        conversation_style: aiInsights.conversation_style || context.conversation_style,
        sentiment_trend: aiInsights.sentiment_trend || context.sentiment_trend
      };

      await this.updateAIContext(updates);

      return aiInsights;
    } catch (error) {
      console.error('AI enrichment failed:', error);
      throw error;
    }
  }

  // ============================================
  // Statistics and Analytics
  // ============================================

  async getStats() {
    const sql = this.ctx.storage.sql;

    const messageCount = sql.exec("SELECT COUNT(*) as count FROM messages").one().count;
    const callCount = sql.exec("SELECT COUNT(*) as count FROM calls").one().count;
    const noteCount = sql.exec("SELECT COUNT(*) as count FROM notes").one().count;
    const taskCount = sql.exec("SELECT COUNT(*) as count FROM tasks WHERE status != 'completed'").one().count;

    const recentMessages = sql.exec(
      "SELECT channel, COUNT(*) as count FROM messages WHERE created_at > ? GROUP BY channel",
      Date.now() - (30 * 24 * 60 * 60 * 1000)
    ).toArray();

    return {
      total_messages: messageCount,
      total_calls: callCount,
      total_notes: noteCount,
      pending_tasks: taskCount,
      messages_by_channel: recentMessages.reduce((acc, row) => {
        acc[row.channel] = row.count;
        return acc;
      }, {})
    };
  }

  async getEngagementScore() {
    const sql = this.ctx.storage.sql;
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

    const messageCount = sql.exec(
      "SELECT COUNT(*) as count FROM messages WHERE created_at > ?",
      thirtyDaysAgo
    ).one().count;

    const callCount = sql.exec(
      "SELECT COUNT(*) as count FROM calls WHERE created_at > ?",
      thirtyDaysAgo
    ).one().count;

    const activityCount = sql.exec(
      "SELECT COUNT(*) as count FROM activities WHERE created_at > ?",
      thirtyDaysAgo
    ).one().count;

    // Simple engagement score: weighted sum
    const score = (messageCount * 2) + (callCount * 5) + activityCount;

    let level = 'low';
    if (score > 100) level = 'high';
    else if (score > 50) level = 'medium';

    return {
      score,
      level,
      messages: messageCount,
      calls: callCount,
      activities: activityCount
    };
  }

  // ============================================
  // WebSocket Real-time Updates with Hibernation
  // ============================================

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'subscribe':
          // Client subscribed, send current state
          const customer = await this.getCustomer();
          ws.send(JSON.stringify({ type: 'customer_data', data: customer }));
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // WebSocket closed, cleanup if needed
    ws.close(1000, "Goodbye");
  }

  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
  }

  /**
   * Broadcast update to all connected WebSocket clients
   */
  async broadcastUpdate(update) {
    this.ctx.getWebSockets().forEach(ws => {
      try {
        ws.send(JSON.stringify(update));
      } catch (error) {
        console.error('Failed to send to WebSocket:', error);
      }
    });
  }

  // ============================================
  // GDPR Compliance
  // ============================================

  /**
   * Export all customer data
   */
  async exportData() {
    const customer = await this.getCustomer();
    const contactPoints = await this.getContactPoints();
    const messages = await this.getMessages();
    const calls = await this.getCalls();
    const activities = await this.getTimeline(1000);
    const notes = await this.getNotes(1000);
    const tasks = await this.getTasks();
    const aiContext = await this.getAIContext();

    return {
      customer,
      contact_points: contactPoints,
      messages,
      calls,
      activities,
      notes,
      tasks,
      ai_context: aiContext,
      exported_at: new Date().toISOString()
    };
  }

  /**
   * Delete all customer data (GDPR right to be forgotten)
   */
  async deleteAllData() {
    const sql = this.ctx.storage.sql;

    sql.exec("DELETE FROM customer");
    sql.exec("DELETE FROM contact_points");
    sql.exec("DELETE FROM messages");
    sql.exec("DELETE FROM calls");
    sql.exec("DELETE FROM activities");
    sql.exec("DELETE FROM notes");
    sql.exec("DELETE FROM tasks");
    sql.exec("DELETE FROM ai_context");

    await this.logActivity('data_deleted', 'All customer data deleted (GDPR)', null, {});

    return { success: true, deleted_at: Date.now() };
  }

  // ============================================
  // HTTP Fetch Handler
  // ============================================

  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    try {
      // Route handling
      if (path === '/customer' && request.method === 'GET') {
        const customer = await this.getCustomer();
        return Response.json(customer || { error: 'Customer not found' });
      }

      if (path === '/customer' && request.method === 'POST') {
        const data = await request.json();
        const customer = await this.upsertCustomer(data);
        return Response.json(customer);
      }

      if (path === '/messages' && request.method === 'GET') {
        const channel = url.searchParams.get('channel');
        const messages = await this.getMessages({ channel });
        return Response.json(messages);
      }

      if (path === '/messages/send' && request.method === 'POST') {
        const data = await request.json();
        const message = await this.sendMessage(data.channel, data);
        return Response.json(message);
      }

      if (path === '/calls' && request.method === 'GET') {
        const calls = await this.getCalls();
        return Response.json(calls);
      }

      if (path === '/calls' && request.method === 'POST') {
        const data = await request.json();
        const call = await this.logCall(data);
        return Response.json(call);
      }

      if (path.startsWith('/calls/') && request.method === 'PATCH') {
        const callId = path.split('/')[2];
        const updates = await request.json();
        await this.updateCall(callId, updates);
        return Response.json({ success: true });
      }

      if (path === '/timeline' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const timeline = await this.getTimeline(limit);
        return Response.json(timeline);
      }

      if (path === '/notes' && request.method === 'GET') {
        const notes = await this.getNotes();
        return Response.json(notes);
      }

      if (path === '/notes' && request.method === 'POST') {
        const data = await request.json();
        const note = await this.addNote(data.content, data.author, data.pinned);
        return Response.json(note);
      }

      if (path === '/tasks' && request.method === 'GET') {
        const status = url.searchParams.get('status');
        const tasks = await this.getTasks({ status });
        return Response.json(tasks);
      }

      if (path === '/tasks' && request.method === 'POST') {
        const data = await request.json();
        const task = await this.addTask(data);
        return Response.json(task);
      }

      if (path.startsWith('/tasks/') && request.method === 'PATCH') {
        const taskId = path.split('/')[2];
        const updates = await request.json();
        await this.updateTask(taskId, updates);
        return Response.json({ success: true });
      }

      if (path === '/ai-context' && request.method === 'GET') {
        const context = await this.getAIContext();
        return Response.json(context);
      }

      if (path === '/ai-context' && request.method === 'PATCH') {
        const updates = await request.json();
        const context = await this.updateAIContext(updates);
        return Response.json(context);
      }

      if (path === '/ai-context/formatted' && request.method === 'GET') {
        const formatted = await this.getContextForAI();
        return new Response(formatted, { headers: { 'Content-Type': 'text/plain' } });
      }

      if (path === '/ai-context/enrich' && request.method === 'POST') {
        const data = await request.json();
        const insights = await this.enrichContextWithAI(data.prompt);
        return Response.json(insights);
      }

      if (path === '/stats' && request.method === 'GET') {
        const stats = await this.getStats();
        return Response.json(stats);
      }

      if (path === '/engagement' && request.method === 'GET') {
        const engagement = await this.getEngagementScore();
        return Response.json(engagement);
      }

      if (path === '/export' && request.method === 'GET') {
        const data = await this.exportData();
        return Response.json(data);
      }

      if (path === '/delete-all' && request.method === 'DELETE') {
        const result = await this.deleteAllData();
        return Response.json(result);
      }

      return Response.json({ error: 'Not found' }, { status: 404 });

    } catch (error) {
      console.error('CustomerDO error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }
}
