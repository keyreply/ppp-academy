# Customer Durable Object Implementation Plan

## Implementation Status
- [x] **Phase 1: Durable Object Class Definition**
    - [x] Schema Initialization (Profile, Messages, Calls)
    - [x] Class Skeleton
- [ ] **Phase 2: Contact Points & Profile**
    - [x] Profile Management
    - [ ] Contact Points CRUD
- [ ] **Phase 3: Message Handling**
    - [ ] Send/Receive Email
    - [ ] Send/Receive WhatsApp
- [ ] **Phase 4: Call Management**
    - [ ] Log Call
    - [ ] Store Call Metadata
- [ ] **Phase 5: Activity Timeline**


## Overview

This plan implements a **Customer Durable Object** to represent and manage the complete lifecycle of customer relationships in the PPP Academy SaaS platform. Each customer gets their own Durable Object instance with embedded SQLite storage for managing contact points (email, WhatsApp), call interactions, message history, and real-time communication.

**Key principles:**
- One Durable Object per customer - complete isolation
- Embedded SQLite for all customer data
- WebSocket hibernation for real-time updates
- Unified API for all contact channels

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────────┐
│   Frontend      │────▶│  Worker API      │────▶│   Customer Durable Object   │
│   (React/Vite)  │     │  (Hono Router)   │     │   ┌─────────────────────┐   │
└─────────────────┘     └────────┬─────────┘     │   │  SQLite Database    │   │
        │                        │               │   │  - Contact Points   │   │
        │ WebSocket              │ RPC           │   │  - Messages         │   │
        │                        │               │   │  - Calls            │   │
        ▼                        ▼               │   │  - Activities       │   │
┌─────────────────┐     ┌──────────────────┐     │   └─────────────────────┘   │
│   Real-time     │◀───▶│   WebSocket      │◀───▶│                             │
│   Dashboard     │     │   Hibernation    │     │   Utility Functions:        │
└─────────────────┘     └──────────────────┘     │   - sendEmail()             │
                                                 │   - sendWhatsApp()          │
┌─────────────────┐                              │   - logCall()               │
│   Email Service │◀─────────────────────────────│   - receiveMessage()        │
│   (Resend)      │                              │   - getTimeline()           │
└─────────────────┘                              └─────────────────────────────┘
        │
┌───────▼─────────┐
│   WhatsApp API  │
│   (Meta Cloud)  │
└─────────────────┘
```

## Why Durable Objects for Customers?

| Feature | Benefit |
|---------|---------|
| **Single-threaded execution** | No race conditions for customer state |
| **Embedded SQLite** | Zero-latency queries, 10GB per customer |
| **WebSocket hibernation** | Real-time updates without cost overhead |
| **Global distribution** | Customer DO spawns near first request |
| **Strong consistency** | All customer operations atomic |
| **30-day PITR** | Point-in-time recovery for compliance |

## Implementation Steps

### Phase 1: Durable Object Class Definition

#### 1.1 wrangler.toml Configuration

```toml
name = "ppp-academy-api"
main = "src/index.js"
compatibility_date = "2025-11-27"
account_id = "2e25a3c929c0317b8c569a9e7491cf78"

# Customer Durable Object binding
[[durable_objects.bindings]]
name = "CUSTOMER"
class_name = "CustomerDO"

# SQLite migrations
[[migrations]]
tag = "v1"
new_sqlite_classes = ["CustomerDO"]

# Other bindings...
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "ppp-academy-docs"

[[d1_databases]]
binding = "DB"
database_name = "ppp-academy-db"
database_id = "<your-database-id>"

[ai]
binding = "AI"
```

#### 1.2 Customer Durable Object Class

```javascript
// src/durable-objects/CustomerDO.js
import { DurableObject } from "cloudflare:workers";

export class CustomerDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // Initialize database schema
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  // ============================================
  // DATABASE SCHEMA
  // ============================================

  async initializeSchema() {
    this.sql.exec(`
      -- Customer profile
      CREATE TABLE IF NOT EXISTS profile (
        id TEXT PRIMARY KEY DEFAULT 'customer',
        external_id TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        whatsapp_id TEXT,
        company TEXT,
        title TEXT,
        avatar_url TEXT,
        timezone TEXT DEFAULT 'UTC',
        language TEXT DEFAULT 'en',
        status TEXT DEFAULT 'active',
        lead_score INTEGER DEFAULT 0,
        tags TEXT DEFAULT '[]',
        custom_fields TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Contact points (email, phone, whatsapp, etc.)
      CREATE TABLE IF NOT EXISTS contact_points (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        label TEXT,
        is_primary INTEGER DEFAULT 0,
        is_verified INTEGER DEFAULT 0,
        verified_at TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Messages (all channels)
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        direction TEXT NOT NULL,
        from_address TEXT,
        to_address TEXT,
        subject TEXT,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        status TEXT DEFAULT 'sent',
        external_id TEXT,
        reply_to_id TEXT,
        attachments TEXT DEFAULT '[]',
        metadata TEXT DEFAULT '{}',
        sent_at TEXT,
        delivered_at TEXT,
        read_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Call interactions
      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        direction TEXT NOT NULL,
        from_number TEXT,
        to_number TEXT,
        status TEXT DEFAULT 'initiated',
        duration_seconds INTEGER,
        recording_url TEXT,
        transcript TEXT,
        summary TEXT,
        sentiment TEXT,
        external_id TEXT,
        agent_id TEXT,
        agent_name TEXT,
        notes TEXT,
        metadata TEXT DEFAULT '{}',
        started_at TEXT,
        answered_at TEXT,
        ended_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Activity timeline (all events)
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        channel TEXT,
        reference_type TEXT,
        reference_id TEXT,
        actor_type TEXT,
        actor_id TEXT,
        actor_name TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Notes and comments
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        author_id TEXT,
        author_name TEXT,
        is_pinned INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Tasks and follow-ups
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        priority TEXT DEFAULT 'medium',
        due_at TEXT,
        completed_at TEXT,
        assigned_to_id TEXT,
        assigned_to_name TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
      CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
      CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON activities(type);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);

      -- Initialize profile if not exists
      INSERT OR IGNORE INTO profile (id) VALUES ('customer');
    `);
  }

  // ============================================
  // PROFILE MANAGEMENT
  // ============================================

  async getProfile() {
    return this.sql.exec("SELECT * FROM profile WHERE id = 'customer'").one();
  }

  async updateProfile(data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'external_id', 'name', 'email', 'phone', 'whatsapp_id',
      'company', 'title', 'avatar_url', 'timezone', 'language',
      'status', 'lead_score', 'tags', 'custom_fields'
    ];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    if (fields.length === 0) return this.getProfile();

    fields.push("updated_at = datetime('now')");
    values.push('customer');

    this.sql.exec(
      `UPDATE profile SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    await this.logActivity('profile_updated', 'Profile updated', { fields: Object.keys(data) });
    await this.broadcastUpdate('profile', await this.getProfile());

    return this.getProfile();
  }

  // ============================================
  // CONTACT POINTS MANAGEMENT
  // ============================================

  async addContactPoint({ type, value, label, isPrimary = false, metadata = {} }) {
    const id = crypto.randomUUID();

    // If setting as primary, unset others of same type
    if (isPrimary) {
      this.sql.exec(
        "UPDATE contact_points SET is_primary = 0 WHERE type = ?",
        type
      );
    }

    this.sql.exec(`
      INSERT INTO contact_points (id, type, value, label, is_primary, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `, id, type, value, label, isPrimary ? 1 : 0, JSON.stringify(metadata));

    await this.logActivity('contact_added', `Added ${type} contact: ${value}`, {
      contactType: type,
      contactId: id
    });

    return this.getContactPoint(id);
  }

  async getContactPoints(type = null) {
    if (type) {
      return this.sql.exec(
        "SELECT * FROM contact_points WHERE type = ? ORDER BY is_primary DESC, created_at DESC",
        type
      ).toArray();
    }
    return this.sql.exec(
      "SELECT * FROM contact_points ORDER BY type, is_primary DESC, created_at DESC"
    ).toArray();
  }

  async getContactPoint(id) {
    return this.sql.exec("SELECT * FROM contact_points WHERE id = ?", id).one();
  }

  async getPrimaryContact(type) {
    const result = this.sql.exec(
      "SELECT * FROM contact_points WHERE type = ? AND is_primary = 1",
      type
    );
    const rows = result.toArray();
    return rows.length > 0 ? rows[0] : null;
  }

  async verifyContactPoint(id) {
    this.sql.exec(
      "UPDATE contact_points SET is_verified = 1, verified_at = datetime('now') WHERE id = ?",
      id
    );
    return this.getContactPoint(id);
  }

  async removeContactPoint(id) {
    const contact = await this.getContactPoint(id);
    this.sql.exec("DELETE FROM contact_points WHERE id = ?", id);

    await this.logActivity('contact_removed', `Removed ${contact.type} contact`, {
      contactType: contact.type,
      contactId: id
    });

    return { success: true };
  }

  // ============================================
  // EMAIL FUNCTIONS
  // ============================================

  async sendEmail({ to, subject, content, contentType = 'html', replyToId = null, attachments = [] }) {
    const id = crypto.randomUUID();
    const profile = await this.getProfile();

    // Get email address
    const toAddress = to || profile.email;
    if (!toAddress) {
      throw new Error('No email address available');
    }

    // Store message record
    this.sql.exec(`
      INSERT INTO messages (id, channel, direction, from_address, to_address, subject, content, content_type, reply_to_id, attachments, status, sent_at)
      VALUES (?, 'email', 'outbound', ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `, id, 'noreply@ppp-academy.com', toAddress, subject, content, contentType, replyToId, JSON.stringify(attachments));

    try {
      // Send via Resend
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'PPP Academy <noreply@ppp-academy.com>',
          to: [toAddress],
          subject,
          [contentType === 'html' ? 'html' : 'text']: content,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        this.sql.exec(
          "UPDATE messages SET status = 'sent', external_id = ? WHERE id = ?",
          result.id, id
        );

        await this.logActivity('email_sent', `Sent email: ${subject}`, {
          messageId: id,
          channel: 'email',
          to: toAddress
        });
      } else {
        this.sql.exec(
          "UPDATE messages SET status = 'failed', metadata = ? WHERE id = ?",
          JSON.stringify({ error: result }), id
        );
      }

      await this.broadcastUpdate('message', await this.getMessage(id));
      return this.getMessage(id);

    } catch (error) {
      this.sql.exec(
        "UPDATE messages SET status = 'failed', metadata = ? WHERE id = ?",
        JSON.stringify({ error: error.message }), id
      );
      throw error;
    }
  }

  async receiveEmail({ from, subject, content, externalId, metadata = {} }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO messages (id, channel, direction, from_address, to_address, subject, content, external_id, metadata, status)
      VALUES (?, 'email', 'inbound', ?, 'customer', ?, ?, ?, ?, 'received')
    `, id, from, subject, content, externalId, JSON.stringify(metadata));

    await this.logActivity('email_received', `Received email: ${subject}`, {
      messageId: id,
      channel: 'email',
      from
    });

    await this.broadcastUpdate('message', await this.getMessage(id));
    return this.getMessage(id);
  }

  // ============================================
  // WHATSAPP FUNCTIONS
  // ============================================

  async sendWhatsApp({ to, content, contentType = 'text', templateName = null, templateParams = {} }) {
    const id = crypto.randomUUID();
    const profile = await this.getProfile();

    const toNumber = to || profile.phone || profile.whatsapp_id;
    if (!toNumber) {
      throw new Error('No WhatsApp number available');
    }

    // Store message record
    this.sql.exec(`
      INSERT INTO messages (id, channel, direction, from_address, to_address, content, content_type, status, sent_at, metadata)
      VALUES (?, 'whatsapp', 'outbound', 'business', ?, ?, ?, 'pending', datetime('now'), ?)
    `, id, toNumber, content, contentType, JSON.stringify({ templateName, templateParams }));

    try {
      // Send via WhatsApp Business API (Meta Cloud API)
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            templateName
              ? {
                  messaging_product: 'whatsapp',
                  to: toNumber,
                  type: 'template',
                  template: {
                    name: templateName,
                    language: { code: 'en' },
                    components: templateParams.components || [],
                  },
                }
              : {
                  messaging_product: 'whatsapp',
                  to: toNumber,
                  type: contentType,
                  [contentType]: contentType === 'text' ? { body: content } : content,
                }
          ),
        }
      );

      const result = await response.json();

      if (response.ok && result.messages?.[0]?.id) {
        this.sql.exec(
          "UPDATE messages SET status = 'sent', external_id = ? WHERE id = ?",
          result.messages[0].id, id
        );

        await this.logActivity('whatsapp_sent', 'Sent WhatsApp message', {
          messageId: id,
          channel: 'whatsapp',
          to: toNumber
        });
      } else {
        this.sql.exec(
          "UPDATE messages SET status = 'failed', metadata = ? WHERE id = ?",
          JSON.stringify({ error: result }), id
        );
      }

      await this.broadcastUpdate('message', await this.getMessage(id));
      return this.getMessage(id);

    } catch (error) {
      this.sql.exec(
        "UPDATE messages SET status = 'failed', metadata = ? WHERE id = ?",
        JSON.stringify({ error: error.message }), id
      );
      throw error;
    }
  }

  async receiveWhatsApp({ from, content, contentType = 'text', externalId, timestamp, metadata = {} }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO messages (id, channel, direction, from_address, to_address, content, content_type, external_id, metadata, status, created_at)
      VALUES (?, 'whatsapp', 'inbound', ?, 'business', ?, ?, ?, ?, 'received', ?)
    `, id, from, content, contentType, externalId, JSON.stringify(metadata), timestamp || new Date().toISOString());

    // Update profile with WhatsApp ID if not set
    const profile = await this.getProfile();
    if (!profile.whatsapp_id) {
      await this.updateProfile({ whatsapp_id: from });
    }

    await this.logActivity('whatsapp_received', 'Received WhatsApp message', {
      messageId: id,
      channel: 'whatsapp',
      from
    });

    await this.broadcastUpdate('message', await this.getMessage(id));
    return this.getMessage(id);
  }

  // ============================================
  // CALL MANAGEMENT
  // ============================================

  async logCall({
    type = 'voice',
    direction,
    fromNumber,
    toNumber,
    status = 'completed',
    durationSeconds = 0,
    recordingUrl = null,
    transcript = null,
    summary = null,
    sentiment = null,
    agentId = null,
    agentName = null,
    notes = null,
    externalId = null,
    startedAt = null,
    answeredAt = null,
    endedAt = null,
    metadata = {}
  }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO calls (
        id, type, direction, from_number, to_number, status, duration_seconds,
        recording_url, transcript, summary, sentiment, external_id,
        agent_id, agent_name, notes, metadata, started_at, answered_at, ended_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id, type, direction, fromNumber, toNumber, status, durationSeconds,
      recordingUrl, transcript, summary, sentiment, externalId,
      agentId, agentName, notes, JSON.stringify(metadata),
      startedAt, answeredAt, endedAt
    );

    await this.logActivity('call_logged', `${direction} ${type} call (${this.formatDuration(durationSeconds)})`, {
      callId: id,
      type,
      direction,
      duration: durationSeconds
    });

    await this.broadcastUpdate('call', await this.getCall(id));
    return this.getCall(id);
  }

  async updateCall(id, data) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        fields.push(`${this.toSnakeCase(key)} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    values.push(id);
    this.sql.exec(`UPDATE calls SET ${fields.join(', ')} WHERE id = ?`, ...values);

    await this.broadcastUpdate('call', await this.getCall(id));
    return this.getCall(id);
  }

  async getCall(id) {
    return this.sql.exec("SELECT * FROM calls WHERE id = ?", id).one();
  }

  async getCalls({ limit = 50, offset = 0, type = null, direction = null }) {
    let query = "SELECT * FROM calls WHERE 1=1";
    const params = [];

    if (type) {
      query += " AND type = ?";
      params.push(type);
    }
    if (direction) {
      query += " AND direction = ?";
      params.push(direction);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.sql.exec(query, ...params).toArray();
  }

  // ============================================
  // MESSAGE MANAGEMENT
  // ============================================

  async getMessage(id) {
    return this.sql.exec("SELECT * FROM messages WHERE id = ?", id).one();
  }

  async getMessages({ channel = null, direction = null, limit = 50, offset = 0 }) {
    let query = "SELECT * FROM messages WHERE 1=1";
    const params = [];

    if (channel) {
      query += " AND channel = ?";
      params.push(channel);
    }
    if (direction) {
      query += " AND direction = ?";
      params.push(direction);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.sql.exec(query, ...params).toArray();
  }

  async updateMessageStatus(id, status, metadata = {}) {
    const updates = [`status = ?`];
    const params = [status];

    if (status === 'delivered') {
      updates.push("delivered_at = datetime('now')");
    } else if (status === 'read') {
      updates.push("read_at = datetime('now')");
    }

    if (Object.keys(metadata).length > 0) {
      updates.push("metadata = json_patch(metadata, ?)");
      params.push(JSON.stringify(metadata));
    }

    params.push(id);
    this.sql.exec(`UPDATE messages SET ${updates.join(', ')} WHERE id = ?`, ...params);

    await this.broadcastUpdate('message', await this.getMessage(id));
    return this.getMessage(id);
  }

  // ============================================
  // UNIFIED SEND/RECEIVE
  // ============================================

  async sendMessage({ channel, ...params }) {
    switch (channel) {
      case 'email':
        return this.sendEmail(params);
      case 'whatsapp':
        return this.sendWhatsApp(params);
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  async receiveMessage({ channel, ...params }) {
    switch (channel) {
      case 'email':
        return this.receiveEmail(params);
      case 'whatsapp':
        return this.receiveWhatsApp(params);
      default:
        throw new Error(`Unknown channel: ${channel}`);
    }
  }

  // ============================================
  // ACTIVITY TIMELINE
  // ============================================

  async logActivity(type, title, { description = null, channel = null, referenceType = null, referenceId = null, actorType = 'system', actorId = null, actorName = null, metadata = {} } = {}) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO activities (id, type, title, description, channel, reference_type, reference_id, actor_type, actor_id, actor_name, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, type, title, description, channel, referenceType, referenceId, actorType, actorId, actorName, JSON.stringify(metadata));

    return { id, type, title };
  }

  async getTimeline({ limit = 50, offset = 0, types = null, channels = null }) {
    let query = "SELECT * FROM activities WHERE 1=1";
    const params = [];

    if (types && types.length > 0) {
      query += ` AND type IN (${types.map(() => '?').join(',')})`;
      params.push(...types);
    }
    if (channels && channels.length > 0) {
      query += ` AND channel IN (${channels.map(() => '?').join(',')})`;
      params.push(...channels);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    return this.sql.exec(query, ...params).toArray();
  }

  async getActivitySummary() {
    const result = this.sql.exec(`
      SELECT
        type,
        COUNT(*) as count,
        MAX(created_at) as last_activity
      FROM activities
      GROUP BY type
      ORDER BY count DESC
    `).toArray();

    return result;
  }

  // ============================================
  // NOTES MANAGEMENT
  // ============================================

  async addNote({ content, authorId = null, authorName = null, isPinned = false }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO notes (id, content, author_id, author_name, is_pinned)
      VALUES (?, ?, ?, ?, ?)
    `, id, content, authorId, authorName, isPinned ? 1 : 0);

    await this.logActivity('note_added', 'Added note', {
      referenceType: 'note',
      referenceId: id,
      actorId: authorId,
      actorName: authorName
    });

    return this.getNote(id);
  }

  async getNote(id) {
    return this.sql.exec("SELECT * FROM notes WHERE id = ?", id).one();
  }

  async getNotes({ limit = 50, pinnedFirst = true }) {
    const orderBy = pinnedFirst
      ? "ORDER BY is_pinned DESC, created_at DESC"
      : "ORDER BY created_at DESC";

    return this.sql.exec(`SELECT * FROM notes ${orderBy} LIMIT ?`, limit).toArray();
  }

  async updateNote(id, { content, isPinned }) {
    const updates = [];
    const params = [];

    if (content !== undefined) {
      updates.push("content = ?");
      params.push(content);
    }
    if (isPinned !== undefined) {
      updates.push("is_pinned = ?");
      params.push(isPinned ? 1 : 0);
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    this.sql.exec(`UPDATE notes SET ${updates.join(', ')} WHERE id = ?`, ...params);
    return this.getNote(id);
  }

  async deleteNote(id) {
    this.sql.exec("DELETE FROM notes WHERE id = ?", id);
    return { success: true };
  }

  // ============================================
  // TASKS MANAGEMENT
  // ============================================

  async addTask({ title, description = null, priority = 'medium', dueAt = null, assignedToId = null, assignedToName = null }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO tasks (id, title, description, priority, due_at, assigned_to_id, assigned_to_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, id, title, description, priority, dueAt, assignedToId, assignedToName);

    await this.logActivity('task_created', `Task: ${title}`, {
      referenceType: 'task',
      referenceId: id,
      metadata: { priority, dueAt }
    });

    return this.getTask(id);
  }

  async getTask(id) {
    return this.sql.exec("SELECT * FROM tasks WHERE id = ?", id).one();
  }

  async getTasks({ status = null, limit = 50 }) {
    if (status) {
      return this.sql.exec(
        "SELECT * FROM tasks WHERE status = ? ORDER BY due_at ASC, created_at DESC LIMIT ?",
        status, limit
      ).toArray();
    }
    return this.sql.exec(
      "SELECT * FROM tasks ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, due_at ASC LIMIT ?",
      limit
    ).toArray();
  }

  async updateTask(id, data) {
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        updates.push(`${this.toSnakeCase(key)} = ?`);
        params.push(value);
      }
    }

    if (data.status === 'completed') {
      updates.push("completed_at = datetime('now')");
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    this.sql.exec(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, ...params);

    if (data.status === 'completed') {
      const task = await this.getTask(id);
      await this.logActivity('task_completed', `Completed: ${task.title}`, {
        referenceType: 'task',
        referenceId: id
      });
    }

    return this.getTask(id);
  }

  // ============================================
  // WEBSOCKET HIBERNATION (REAL-TIME UPDATES)
  // ============================================

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time updates
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Accept with hibernation
      this.ctx.acceptWebSocket(server);

      // Store session info
      const sessionId = crypto.randomUUID();
      server.serializeAttachment({ sessionId, connectedAt: Date.now() });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected WebSocket", { status: 400 });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'subscribe':
          // Store subscription preferences
          const attachment = ws.deserializeAttachment() || {};
          attachment.subscriptions = data.channels || ['all'];
          ws.serializeAttachment(attachment);
          ws.send(JSON.stringify({ type: 'subscribed', channels: attachment.subscriptions }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }

  async webSocketClose(ws, code, reason) {
    // Cleanup handled automatically by hibernation
    console.log(`WebSocket closed: ${code} - ${reason}`);
  }

  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
  }

  async broadcastUpdate(type, data) {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify({ type: 'update', updateType: type, data, timestamp: Date.now() });

    for (const ws of sockets) {
      try {
        const attachment = ws.deserializeAttachment() || {};
        const subscriptions = attachment.subscriptions || ['all'];

        if (subscriptions.includes('all') || subscriptions.includes(type)) {
          ws.send(message);
        }
      } catch (error) {
        console.error('Broadcast error:', error);
      }
    }
  }

  // ============================================
  // ANALYTICS & INSIGHTS
  // ============================================

  async getStats() {
    const messagesStats = this.sql.exec(`
      SELECT
        channel,
        direction,
        COUNT(*) as count
      FROM messages
      GROUP BY channel, direction
    `).toArray();

    const callsStats = this.sql.exec(`
      SELECT
        type,
        direction,
        COUNT(*) as count,
        SUM(duration_seconds) as total_duration,
        AVG(duration_seconds) as avg_duration
      FROM calls
      GROUP BY type, direction
    `).toArray();

    const recentActivity = this.sql.exec(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM activities
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `).toArray();

    const taskStats = this.sql.exec(`
      SELECT status, COUNT(*) as count
      FROM tasks
      GROUP BY status
    `).toArray();

    return {
      messages: messagesStats,
      calls: callsStats,
      activityByDay: recentActivity,
      tasks: taskStats,
    };
  }

  async getEngagementScore() {
    const stats = await this.getStats();
    const profile = await this.getProfile();

    // Simple engagement scoring
    let score = profile.lead_score || 0;

    // Boost for recent activity
    const recentMessages = this.sql.exec(
      "SELECT COUNT(*) as count FROM messages WHERE created_at >= datetime('now', '-7 days')"
    ).one().count;

    const recentCalls = this.sql.exec(
      "SELECT COUNT(*) as count FROM calls WHERE created_at >= datetime('now', '-7 days')"
    ).one().count;

    score += recentMessages * 5;
    score += recentCalls * 10;

    return { score, breakdown: { baseScore: profile.lead_score, recentMessages, recentCalls } };
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  formatDuration(seconds) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Export all data (for compliance/portability)
  async exportData() {
    return {
      profile: await this.getProfile(),
      contactPoints: await this.getContactPoints(),
      messages: this.sql.exec("SELECT * FROM messages ORDER BY created_at").toArray(),
      calls: this.sql.exec("SELECT * FROM calls ORDER BY created_at").toArray(),
      activities: this.sql.exec("SELECT * FROM activities ORDER BY created_at").toArray(),
      notes: this.sql.exec("SELECT * FROM notes ORDER BY created_at").toArray(),
      tasks: this.sql.exec("SELECT * FROM tasks ORDER BY created_at").toArray(),
      exportedAt: new Date().toISOString(),
    };
  }

  // Delete all customer data (GDPR compliance)
  async deleteAllData() {
    this.ctx.storage.deleteAll();
    return { success: true, message: 'All customer data deleted' };
  }
}
```

### Phase 2: Worker API Integration

#### 2.1 Customer Routes

```javascript
// routes/customers.js
import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const customers = new Hono();

// Helper to get Customer DO stub
function getCustomerStub(env, customerId) {
  const id = env.CUSTOMER.idFromName(customerId);
  return env.CUSTOMER.get(id);
}

// Get customer profile
customers.get('/:customerId', async (c) => {
  const { customerId } = c.req.param();
  const stub = getCustomerStub(c.env, customerId);

  const profile = await stub.getProfile();
  return c.json({ customer: profile });
});

// Update customer profile
customers.patch('/:customerId', async (c) => {
  const { customerId } = c.req.param();
  const data = await c.req.json();
  const stub = getCustomerStub(c.env, customerId);

  const profile = await stub.updateProfile(data);
  return c.json({ customer: profile });
});

// Get customer timeline
customers.get('/:customerId/timeline', async (c) => {
  const { customerId } = c.req.param();
  const { limit, offset, types, channels } = c.req.query();
  const stub = getCustomerStub(c.env, customerId);

  const timeline = await stub.getTimeline({
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    types: types?.split(','),
    channels: channels?.split(','),
  });

  return c.json({ timeline });
});

// Send message (unified endpoint)
customers.post('/:customerId/messages', async (c) => {
  const { customerId } = c.req.param();
  const data = await c.req.json();
  const stub = getCustomerStub(c.env, customerId);

  const message = await stub.sendMessage(data);
  return c.json({ message }, 201);
});

// Get messages
customers.get('/:customerId/messages', async (c) => {
  const { customerId } = c.req.param();
  const { channel, direction, limit, offset } = c.req.query();
  const stub = getCustomerStub(c.env, customerId);

  const messages = await stub.getMessages({
    channel,
    direction,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });

  return c.json({ messages });
});

// Log call
customers.post('/:customerId/calls', async (c) => {
  const { customerId } = c.req.param();
  const data = await c.req.json();
  const stub = getCustomerStub(c.env, customerId);

  const call = await stub.logCall(data);
  return c.json({ call }, 201);
});

// Get calls
customers.get('/:customerId/calls', async (c) => {
  const { customerId } = c.req.param();
  const { type, direction, limit, offset } = c.req.query();
  const stub = getCustomerStub(c.env, customerId);

  const calls = await stub.getCalls({
    type,
    direction,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
  });

  return c.json({ calls });
});

// Contact points
customers.get('/:customerId/contacts', async (c) => {
  const { customerId } = c.req.param();
  const { type } = c.req.query();
  const stub = getCustomerStub(c.env, customerId);

  const contacts = await stub.getContactPoints(type);
  return c.json({ contacts });
});

customers.post('/:customerId/contacts', async (c) => {
  const { customerId } = c.req.param();
  const data = await c.req.json();
  const stub = getCustomerStub(c.env, customerId);

  const contact = await stub.addContactPoint(data);
  return c.json({ contact }, 201);
});

// Notes
customers.get('/:customerId/notes', async (c) => {
  const { customerId } = c.req.param();
  const stub = getCustomerStub(c.env, customerId);

  const notes = await stub.getNotes({});
  return c.json({ notes });
});

customers.post('/:customerId/notes', async (c) => {
  const { customerId } = c.req.param();
  const data = await c.req.json();
  const userId = getUserId(c);
  const user = c.get('user');
  const stub = getCustomerStub(c.env, customerId);

  const note = await stub.addNote({
    ...data,
    authorId: userId,
    authorName: user.name,
  });
  return c.json({ note }, 201);
});

// Tasks
customers.get('/:customerId/tasks', async (c) => {
  const { customerId } = c.req.param();
  const { status } = c.req.query();
  const stub = getCustomerStub(c.env, customerId);

  const tasks = await stub.getTasks({ status });
  return c.json({ tasks });
});

customers.post('/:customerId/tasks', async (c) => {
  const { customerId } = c.req.param();
  const data = await c.req.json();
  const stub = getCustomerStub(c.env, customerId);

  const task = await stub.addTask(data);
  return c.json({ task }, 201);
});

customers.patch('/:customerId/tasks/:taskId', async (c) => {
  const { customerId, taskId } = c.req.param();
  const data = await c.req.json();
  const stub = getCustomerStub(c.env, customerId);

  const task = await stub.updateTask(taskId, data);
  return c.json({ task });
});

// Stats & Analytics
customers.get('/:customerId/stats', async (c) => {
  const { customerId } = c.req.param();
  const stub = getCustomerStub(c.env, customerId);

  const stats = await stub.getStats();
  return c.json({ stats });
});

// WebSocket endpoint for real-time updates
customers.get('/:customerId/ws', async (c) => {
  const { customerId } = c.req.param();

  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket' }, 400);
  }

  const stub = getCustomerStub(c.env, customerId);
  return stub.fetch(c.req.raw);
});

// Export data (GDPR)
customers.get('/:customerId/export', async (c) => {
  const { customerId } = c.req.param();
  const stub = getCustomerStub(c.env, customerId);

  const data = await stub.exportData();
  return c.json(data);
});

// Delete all data (GDPR)
customers.delete('/:customerId', async (c) => {
  const { customerId } = c.req.param();
  const stub = getCustomerStub(c.env, customerId);

  const result = await stub.deleteAllData();
  return c.json(result);
});

export default customers;
```

### Phase 3: Webhook Handlers for Incoming Messages

#### 3.1 WhatsApp Webhook

```javascript
// routes/webhooks/whatsapp.js
import { Hono } from 'hono';

const whatsapp = new Hono();

// Webhook verification
whatsapp.get('/', async (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');

  if (mode === 'subscribe' && token === c.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return c.text(challenge);
  }
  return c.text('Forbidden', 403);
});

// Incoming messages
whatsapp.post('/', async (c) => {
  const body = await c.req.json();

  // Process webhook payload
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (value?.messages) {
    for (const message of value.messages) {
      const from = message.from;
      const type = message.type;

      // Find or create customer by WhatsApp number
      const customerId = await getOrCreateCustomerByWhatsApp(c.env, from);
      const stub = c.env.CUSTOMER.get(c.env.CUSTOMER.idFromName(customerId));

      // Extract content based on message type
      let content = '';
      let contentType = 'text';

      switch (type) {
        case 'text':
          content = message.text.body;
          break;
        case 'image':
          content = message.image.id;
          contentType = 'image';
          break;
        case 'document':
          content = message.document.id;
          contentType = 'document';
          break;
        case 'audio':
          content = message.audio.id;
          contentType = 'audio';
          break;
        case 'video':
          content = message.video.id;
          contentType = 'video';
          break;
        default:
          content = JSON.stringify(message);
      }

      await stub.receiveWhatsApp({
        from,
        content,
        contentType,
        externalId: message.id,
        timestamp: new Date(parseInt(message.timestamp) * 1000).toISOString(),
        metadata: { type, raw: message },
      });
    }
  }

  // Status updates
  if (value?.statuses) {
    for (const status of value.statuses) {
      // Update message status
      // Find message by external_id and update
    }
  }

  return c.json({ success: true });
});

async function getOrCreateCustomerByWhatsApp(env, whatsappId) {
  // Look up in D1 or create new customer
  const existing = await env.DB.prepare(
    "SELECT customer_id FROM customer_contacts WHERE type = 'whatsapp' AND value = ?"
  ).bind(whatsappId).first();

  if (existing) {
    return existing.customer_id;
  }

  // Create new customer
  const customerId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO customer_contacts (customer_id, type, value) VALUES (?, 'whatsapp', ?)"
  ).bind(customerId, whatsappId).run();

  // Initialize the customer DO
  const stub = env.CUSTOMER.get(env.CUSTOMER.idFromName(customerId));
  await stub.updateProfile({ whatsapp_id: whatsappId });
  await stub.addContactPoint({ type: 'whatsapp', value: whatsappId, isPrimary: true });

  return customerId;
}

export default whatsapp;
```

#### 3.2 Email Webhook (Resend)

```javascript
// routes/webhooks/email.js
import { Hono } from 'hono';

const email = new Hono();

email.post('/', async (c) => {
  const body = await c.req.json();
  const event = body.type;

  switch (event) {
    case 'email.delivered':
      // Update message status
      await updateMessageByExternalId(c.env, body.data.email_id, 'delivered');
      break;

    case 'email.bounced':
      await updateMessageByExternalId(c.env, body.data.email_id, 'bounced', {
        bounceType: body.data.bounce?.type,
      });
      break;

    case 'email.opened':
      await updateMessageByExternalId(c.env, body.data.email_id, 'read');
      break;

    case 'email.clicked':
      // Log click event
      break;
  }

  return c.json({ received: true });
});

async function updateMessageByExternalId(env, externalId, status, metadata = {}) {
  // Find the customer and message, then update
  // This requires a lookup table in D1
}

export default email;
```

### Phase 4: Frontend Real-Time Integration

```javascript
// services/customerSocket.js
export class CustomerSocket {
  constructor(customerId, apiUrl) {
    this.customerId = customerId;
    this.apiUrl = apiUrl;
    this.ws = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  connect() {
    const wsUrl = this.apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    this.ws = new WebSocket(`${wsUrl}/customers/${this.customerId}/ws`);

    this.ws.onopen = () => {
      console.log('Connected to customer updates');
      this.reconnectAttempts = 0;

      // Subscribe to all updates
      this.ws.send(JSON.stringify({ type: 'subscribe', channels: ['all'] }));
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'update') {
        this.emit(data.updateType, data.data);
        this.emit('*', data);
      }
    };

    this.ws.onclose = () => {
      console.log('Disconnected from customer updates');
      this.tryReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  tryReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
      setTimeout(() => this.connect(), delay);
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach(cb => cb(data));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Usage in React component
// const socket = new CustomerSocket(customerId, API_URL);
// socket.connect();
// socket.on('message', (msg) => setMessages(prev => [msg, ...prev]));
// socket.on('call', (call) => setCalls(prev => [call, ...prev]));
```

## File Structure

```
worker/
├── src/
│   ├── index.js
│   ├── durable-objects/
│   │   └── CustomerDO.js        # Customer Durable Object class
│   ├── routes/
│   │   ├── customers.js         # Customer API routes
│   │   └── webhooks/
│   │       ├── whatsapp.js      # WhatsApp webhook handler
│   │       └── email.js         # Email webhook handler
│   └── middleware/
│       └── auth.js
├── wrangler.toml
└── package.json

src/
├── components/
│   └── Customer/
│       ├── CustomerProfile.jsx
│       ├── Timeline.jsx
│       ├── MessageComposer.jsx
│       ├── CallLog.jsx
│       └── ContactPoints.jsx
└── services/
    └── customerSocket.js        # WebSocket client
```

## API Summary

### Customer Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers/:id` | Get profile |
| PATCH | `/customers/:id` | Update profile |
| DELETE | `/customers/:id` | Delete all data (GDPR) |
| GET | `/customers/:id/export` | Export all data |

### Communication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/customers/:id/messages` | Send message (any channel) |
| GET | `/customers/:id/messages` | Get messages |
| POST | `/customers/:id/calls` | Log call |
| GET | `/customers/:id/calls` | Get calls |

### CRM Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/customers/:id/timeline` | Activity timeline |
| GET/POST | `/customers/:id/contacts` | Contact points |
| GET/POST | `/customers/:id/notes` | Notes |
| GET/POST/PATCH | `/customers/:id/tasks` | Tasks |
| GET | `/customers/:id/stats` | Analytics |
| GET | `/customers/:id/ws` | WebSocket |

## Environment Variables

```bash
# Secrets
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put WHATSAPP_ACCESS_TOKEN
npx wrangler secret put WHATSAPP_WEBHOOK_VERIFY_TOKEN

# Environment variables (wrangler.toml)
[vars]
WHATSAPP_PHONE_NUMBER_ID = "your-phone-number-id"
```

## Cost Estimation

### Durable Objects Pricing
| Metric | Free Tier | Paid |
|--------|-----------|------|
| Requests | 1M/month | $0.15/M |
| Duration | 400K GB-s | $12.50/M GB-s |
| Storage | 1GB | $0.20/GB |

### Estimated Usage (1000 customers)
- **Requests**: ~100K/month (profile views, messages) ✓ Free
- **Duration**: ~10K GB-s (with hibernation) ✓ Free
- **Storage**: ~100MB (1000 × 100KB avg) ✓ Free

**WebSocket Hibernation Savings**: Without hibernation, 1000 connected customers would cost ~$36K/month. With hibernation, only active execution is billed: **~$5/month**.

## Sources

- [Cloudflare Durable Objects Overview](https://developers.cloudflare.com/durable-objects/)
- [Durable Objects Getting Started](https://developers.cloudflare.com/durable-objects/get-started/)
- [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [WebSocket Hibernation](https://developers.cloudflare.com/durable-objects/examples/websocket-hibernation-server/)
- [Durable Objects Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/)
