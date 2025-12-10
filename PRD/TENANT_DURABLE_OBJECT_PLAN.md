# Tenant Durable Object Implementation Plan

## Implementation Status
- [ ] **Phase 1: Durable Object Class Definition**
    - [ ] Schema Initialization
    - [ ] In-memory Rate Limiting
- [ ] **Phase 2: Use Management**
    - [ ] Track Usage
    - [ ] Check Quotas
- [ ] **Phase 3: Member Management**
    - [ ] Invite Member
    - [ ] Role Management
- [ ] **Phase 4: Settings & Config**
    - [ ] Organization Settings
    - [ ] API Key Management


## Overview

This plan implements a **Tenant Durable Object** to represent and manage the complete lifecycle of a tenant (organization/company) in the PPP Academy SaaS platform. Each tenant gets their own Durable Object instance with embedded SQLite storage for managing users, settings, billing, usage tracking, and organizational data.

**Key principles:**
- One Durable Object per tenant - complete data isolation
- Embedded SQLite for tenant-specific configuration
- Real-time usage tracking and rate limiting
- Centralized settings and feature flags
- Multi-user management within tenant

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────────┐
│   Frontend      │────▶│  Worker API      │────▶│   Tenant Durable Object     │
│   (React/Vite)  │     │  (Hono Router)   │     │   ┌─────────────────────┐   │
└─────────────────┘     └────────┬─────────┘     │   │  SQLite Database    │   │
                                 │               │   │  - Users/Members    │   │
                                 │ RPC           │   │  - Settings         │   │
                                 │               │   │  - Usage/Billing    │   │
                                 ▼               │   │  - API Keys         │   │
                        ┌──────────────────┐     │   │  - Audit Logs       │   │
                        │   Customer DO    │◀───▶│   └─────────────────────┘   │
                        │   (per customer) │     │                             │
                        └──────────────────┘     │   Utility Functions:        │
                                                 │   - checkQuota()            │
                        ┌──────────────────┐     │   - trackUsage()            │
                        │   RAG System     │◀───▶│   - inviteUser()            │
                        │   (Vectorize)    │     │   - getSettings()           │
                        └──────────────────┘     │   - generateApiKey()        │
                                                 └─────────────────────────────┘
```

## Relationship: Tenant vs Customer Durable Objects

```
┌─────────────────────────────────────────────────────────────────┐
│                        Tenant DO                                 │
│  (Organization-level: users, billing, settings)                 │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ User 1   │  │ User 2   │  │ User 3   │  │ User N   │        │
│  │ (Admin)  │  │ (Member) │  │ (Viewer) │  │          │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ owns many
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Customer DOs                                │
│  (Contact-level: messages, calls, timeline)                     │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │Customer 1│  │Customer 2│  │Customer 3│  │Customer N│        │
│  │  DO      │  │  DO      │  │  DO      │  │  DO      │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

## Why Durable Objects for Tenants?

| Feature | Benefit |
|---------|---------|
| **Single-threaded execution** | No race conditions for usage counters |
| **Embedded SQLite** | Zero-latency settings queries |
| **Real-time rate limiting** | In-memory counters with persistence |
| **Strong consistency** | Billing and quota updates atomic |
| **Global distribution** | Tenant DO near primary users |
| **WebSocket support** | Real-time admin dashboard updates |

## Implementation Steps

### Phase 1: Durable Object Class Definition

#### 1.1 wrangler.toml Configuration

```toml
name = "ppp-academy-api"
main = "src/index.js"
compatibility_date = "2025-11-27"
account_id = "2e25a3c929c0317b8c569a9e7491cf78"

# Tenant Durable Object binding
[[durable_objects.bindings]]
name = "TENANT"
class_name = "TenantDO"

# Customer Durable Object binding
[[durable_objects.bindings]]
name = "CUSTOMER"
class_name = "CustomerDO"

# SQLite migrations
[[migrations]]
tag = "v1"
new_sqlite_classes = ["TenantDO", "CustomerDO"]

# Other bindings...
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "ppp-academy-docs"

[[d1_databases]]
binding = "DB"
database_name = "ppp-academy-db"
database_id = "<your-database-id>"

[[vectorize]]
binding = "VECTORIZE"
index_name = "ppp-academy-vectors"

[ai]
binding = "AI"
```

#### 1.2 Tenant Durable Object Class

```javascript
// src/durable-objects/TenantDO.js
import { DurableObject } from "cloudflare:workers";

export class TenantDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // In-memory rate limiting counters
    this.usageCounters = new Map();
    this.lastCounterReset = Date.now();

    // Initialize database schema
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
      await this.loadUsageCounters();
    });
  }

  // ============================================
  // DATABASE SCHEMA
  // ============================================

  async initializeSchema() {
    this.sql.exec(`
      -- Tenant profile/organization
      CREATE TABLE IF NOT EXISTS organization (
        id TEXT PRIMARY KEY DEFAULT 'tenant',
        name TEXT NOT NULL DEFAULT 'My Organization',
        slug TEXT UNIQUE,
        domain TEXT,
        logo_url TEXT,
        timezone TEXT DEFAULT 'UTC',
        locale TEXT DEFAULT 'en',
        industry TEXT,
        size TEXT,
        website TEXT,
        address TEXT,
        billing_email TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Subscription & billing
      CREATE TABLE IF NOT EXISTS subscription (
        id TEXT PRIMARY KEY DEFAULT 'current',
        plan_id TEXT DEFAULT 'free',
        plan_name TEXT DEFAULT 'Free',
        status TEXT DEFAULT 'active',
        billing_cycle TEXT DEFAULT 'monthly',
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Plan limits & quotas
      CREATE TABLE IF NOT EXISTS plan_limits (
        id TEXT PRIMARY KEY DEFAULT 'current',
        max_users INTEGER DEFAULT 1,
        max_customers INTEGER DEFAULT 100,
        max_documents INTEGER DEFAULT 50,
        max_storage_mb INTEGER DEFAULT 100,
        max_api_calls_per_month INTEGER DEFAULT 1000,
        max_ai_queries_per_month INTEGER DEFAULT 100,
        max_emails_per_month INTEGER DEFAULT 100,
        max_whatsapp_per_month INTEGER DEFAULT 0,
        features TEXT DEFAULT '["basic"]',
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Usage tracking (current period)
      CREATE TABLE IF NOT EXISTS usage (
        id TEXT PRIMARY KEY DEFAULT 'current',
        period_start TEXT,
        period_end TEXT,
        users_count INTEGER DEFAULT 0,
        customers_count INTEGER DEFAULT 0,
        documents_count INTEGER DEFAULT 0,
        storage_used_mb REAL DEFAULT 0,
        api_calls INTEGER DEFAULT 0,
        ai_queries INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        whatsapp_sent INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Usage history (monthly snapshots)
      CREATE TABLE IF NOT EXISTS usage_history (
        id TEXT PRIMARY KEY,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        users_count INTEGER DEFAULT 0,
        customers_count INTEGER DEFAULT 0,
        documents_count INTEGER DEFAULT 0,
        storage_used_mb REAL DEFAULT 0,
        api_calls INTEGER DEFAULT 0,
        ai_queries INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        whatsapp_sent INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Team members
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        name TEXT,
        avatar_url TEXT,
        role TEXT DEFAULT 'member',
        status TEXT DEFAULT 'active',
        permissions TEXT DEFAULT '[]',
        invited_by TEXT,
        invited_at TEXT,
        joined_at TEXT,
        last_active_at TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Pending invitations
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        permissions TEXT DEFAULT '[]',
        invited_by_id TEXT,
        invited_by_name TEXT,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        accepted_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- API keys
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_prefix TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        permissions TEXT DEFAULT '["read"]',
        rate_limit INTEGER DEFAULT 100,
        last_used_at TEXT,
        expires_at TEXT,
        created_by_id TEXT,
        created_by_name TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Settings (key-value store)
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        is_secret INTEGER DEFAULT 0,
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Feature flags
      CREATE TABLE IF NOT EXISTS feature_flags (
        key TEXT PRIMARY KEY,
        enabled INTEGER DEFAULT 0,
        rollout_percentage INTEGER DEFAULT 100,
        conditions TEXT DEFAULT '{}',
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Audit log
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        actor_type TEXT DEFAULT 'user',
        actor_id TEXT,
        actor_name TEXT,
        actor_ip TEXT,
        details TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      -- Webhooks configuration
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL,
        secret TEXT,
        is_active INTEGER DEFAULT 1,
        last_triggered_at TEXT,
        last_status INTEGER,
        failure_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Integrations
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT DEFAULT '{}',
        credentials TEXT DEFAULT '{}',
        status TEXT DEFAULT 'active',
        last_synced_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
      CREATE INDEX IF NOT EXISTS idx_members_email ON members(email);
      CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
      CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
      CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);
      CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id);
      CREATE INDEX IF NOT EXISTS idx_settings_category ON settings(category);

      -- Initialize default records if not exists
      INSERT OR IGNORE INTO organization (id) VALUES ('tenant');
      INSERT OR IGNORE INTO subscription (id) VALUES ('current');
      INSERT OR IGNORE INTO plan_limits (id) VALUES ('current');
      INSERT OR IGNORE INTO usage (id, period_start, period_end)
        VALUES ('current', datetime('now', 'start of month'), datetime('now', 'start of month', '+1 month'));
    `);
  }

  async loadUsageCounters() {
    // Load current usage into memory for fast rate limiting
    const usage = await this.getUsage();
    this.usageCounters.set('api_calls', usage.api_calls || 0);
    this.usageCounters.set('ai_queries', usage.ai_queries || 0);
    this.usageCounters.set('emails_sent', usage.emails_sent || 0);
    this.usageCounters.set('whatsapp_sent', usage.whatsapp_sent || 0);
  }

  // ============================================
  // ORGANIZATION MANAGEMENT
  // ============================================

  async getOrganization() {
    return this.sql.exec("SELECT * FROM organization WHERE id = 'tenant'").one();
  }

  async updateOrganization(data) {
    const fields = [];
    const values = [];

    const allowedFields = [
      'name', 'slug', 'domain', 'logo_url', 'timezone', 'locale',
      'industry', 'size', 'website', 'address', 'billing_email', 'status'
    ];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.getOrganization();

    fields.push("updated_at = datetime('now')");
    values.push('tenant');

    this.sql.exec(
      `UPDATE organization SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    await this.audit('organization.updated', 'organization', 'tenant', { fields: Object.keys(data) });
    return this.getOrganization();
  }

  // ============================================
  // SUBSCRIPTION & BILLING
  // ============================================

  async getSubscription() {
    return this.sql.exec("SELECT * FROM subscription WHERE id = 'current'").one();
  }

  async updateSubscription(data) {
    const fields = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        fields.push(`${this.toSnakeCase(key)} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    fields.push("updated_at = datetime('now')");
    values.push('current');

    this.sql.exec(
      `UPDATE subscription SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    // Update plan limits if plan changed
    if (data.planId) {
      await this.updatePlanLimits(data.planId);
    }

    await this.audit('subscription.updated', 'subscription', 'current', data);
    return this.getSubscription();
  }

  async updatePlanLimits(planId) {
    // Plan definitions
    const plans = {
      free: {
        max_users: 1,
        max_customers: 100,
        max_documents: 50,
        max_storage_mb: 100,
        max_api_calls_per_month: 1000,
        max_ai_queries_per_month: 100,
        max_emails_per_month: 100,
        max_whatsapp_per_month: 0,
        features: ['basic'],
      },
      starter: {
        max_users: 5,
        max_customers: 500,
        max_documents: 200,
        max_storage_mb: 1000,
        max_api_calls_per_month: 10000,
        max_ai_queries_per_month: 1000,
        max_emails_per_month: 1000,
        max_whatsapp_per_month: 100,
        features: ['basic', 'email', 'whatsapp', 'api'],
      },
      professional: {
        max_users: 20,
        max_customers: 5000,
        max_documents: 1000,
        max_storage_mb: 10000,
        max_api_calls_per_month: 100000,
        max_ai_queries_per_month: 10000,
        max_emails_per_month: 10000,
        max_whatsapp_per_month: 1000,
        features: ['basic', 'email', 'whatsapp', 'api', 'webhooks', 'integrations', 'analytics'],
      },
      enterprise: {
        max_users: -1, // unlimited
        max_customers: -1,
        max_documents: -1,
        max_storage_mb: 100000,
        max_api_calls_per_month: -1,
        max_ai_queries_per_month: -1,
        max_emails_per_month: -1,
        max_whatsapp_per_month: -1,
        features: ['basic', 'email', 'whatsapp', 'api', 'webhooks', 'integrations', 'analytics', 'sso', 'audit', 'custom'],
      },
    };

    const limits = plans[planId] || plans.free;

    this.sql.exec(`
      UPDATE plan_limits SET
        max_users = ?,
        max_customers = ?,
        max_documents = ?,
        max_storage_mb = ?,
        max_api_calls_per_month = ?,
        max_ai_queries_per_month = ?,
        max_emails_per_month = ?,
        max_whatsapp_per_month = ?,
        features = ?,
        updated_at = datetime('now')
      WHERE id = 'current'
    `,
      limits.max_users,
      limits.max_customers,
      limits.max_documents,
      limits.max_storage_mb,
      limits.max_api_calls_per_month,
      limits.max_ai_queries_per_month,
      limits.max_emails_per_month,
      limits.max_whatsapp_per_month,
      JSON.stringify(limits.features)
    );
  }

  async getPlanLimits() {
    const limits = this.sql.exec("SELECT * FROM plan_limits WHERE id = 'current'").one();
    limits.features = JSON.parse(limits.features || '[]');
    return limits;
  }

  // ============================================
  // USAGE TRACKING & QUOTAS
  // ============================================

  async getUsage() {
    return this.sql.exec("SELECT * FROM usage WHERE id = 'current'").one();
  }

  async trackUsage(metric, amount = 1) {
    const validMetrics = [
      'api_calls', 'ai_queries', 'emails_sent', 'whatsapp_sent',
      'users_count', 'customers_count', 'documents_count', 'storage_used_mb'
    ];

    if (!validMetrics.includes(metric)) {
      throw new Error(`Invalid metric: ${metric}`);
    }

    // Update in-memory counter
    const current = this.usageCounters.get(metric) || 0;
    this.usageCounters.set(metric, current + amount);

    // Persist to storage
    this.sql.exec(
      `UPDATE usage SET ${metric} = ${metric} + ?, updated_at = datetime('now') WHERE id = 'current'`,
      amount
    );

    return { metric, newValue: current + amount };
  }

  async setUsage(metric, value) {
    this.usageCounters.set(metric, value);
    this.sql.exec(
      `UPDATE usage SET ${metric} = ?, updated_at = datetime('now') WHERE id = 'current'`,
      value
    );
  }

  async checkQuota(metric) {
    const limits = await this.getPlanLimits();
    const usage = await this.getUsage();

    const limitKey = `max_${metric}`;
    const limit = limits[limitKey];

    // -1 means unlimited
    if (limit === -1) {
      return { allowed: true, limit: -1, used: usage[metric], remaining: -1 };
    }

    const used = usage[metric] || 0;
    const remaining = Math.max(0, limit - used);

    return {
      allowed: remaining > 0,
      limit,
      used,
      remaining,
    };
  }

  async checkAndTrackUsage(metric, amount = 1) {
    const quota = await this.checkQuota(metric);

    if (!quota.allowed) {
      throw new Error(`Quota exceeded for ${metric}. Limit: ${quota.limit}, Used: ${quota.used}`);
    }

    if (quota.limit !== -1 && quota.remaining < amount) {
      throw new Error(`Insufficient quota for ${metric}. Remaining: ${quota.remaining}, Requested: ${amount}`);
    }

    await this.trackUsage(metric, amount);
    return { ...quota, used: quota.used + amount, remaining: quota.remaining - amount };
  }

  async resetUsagePeriod() {
    const currentUsage = await this.getUsage();

    // Archive current period
    const historyId = crypto.randomUUID();
    this.sql.exec(`
      INSERT INTO usage_history (id, period_start, period_end, users_count, customers_count, documents_count, storage_used_mb, api_calls, ai_queries, emails_sent, whatsapp_sent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      historyId,
      currentUsage.period_start,
      currentUsage.period_end,
      currentUsage.users_count,
      currentUsage.customers_count,
      currentUsage.documents_count,
      currentUsage.storage_used_mb,
      currentUsage.api_calls,
      currentUsage.ai_queries,
      currentUsage.emails_sent,
      currentUsage.whatsapp_sent
    );

    // Reset current period (keep resource counts, reset action counts)
    this.sql.exec(`
      UPDATE usage SET
        period_start = datetime('now', 'start of month'),
        period_end = datetime('now', 'start of month', '+1 month'),
        api_calls = 0,
        ai_queries = 0,
        emails_sent = 0,
        whatsapp_sent = 0,
        updated_at = datetime('now')
      WHERE id = 'current'
    `);

    // Reset in-memory counters
    this.usageCounters.set('api_calls', 0);
    this.usageCounters.set('ai_queries', 0);
    this.usageCounters.set('emails_sent', 0);
    this.usageCounters.set('whatsapp_sent', 0);

    await this.audit('usage.reset', 'usage', 'current', { previousPeriod: currentUsage.period_start });
  }

  async getUsageHistory(limit = 12) {
    return this.sql.exec(
      "SELECT * FROM usage_history ORDER BY period_start DESC LIMIT ?",
      limit
    ).toArray();
  }

  // ============================================
  // TEAM MEMBER MANAGEMENT
  // ============================================

  async addMember({ userId, email, name, role = 'member', permissions = [], invitedBy = null }) {
    // Check user limit
    const quota = await this.checkQuota('users_count');
    if (!quota.allowed) {
      throw new Error('User limit reached for your plan');
    }

    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO members (id, user_id, email, name, role, permissions, invited_by, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, id, userId, email, name, role, JSON.stringify(permissions), invitedBy);

    await this.trackUsage('users_count', 1);
    await this.audit('member.added', 'member', id, { email, role });

    return this.getMember(id);
  }

  async getMember(id) {
    const member = this.sql.exec("SELECT * FROM members WHERE id = ?", id).one();
    if (member) {
      member.permissions = JSON.parse(member.permissions || '[]');
    }
    return member;
  }

  async getMemberByUserId(userId) {
    const member = this.sql.exec("SELECT * FROM members WHERE user_id = ?", userId).one();
    if (member) {
      member.permissions = JSON.parse(member.permissions || '[]');
    }
    return member;
  }

  async getMemberByEmail(email) {
    const member = this.sql.exec("SELECT * FROM members WHERE email = ?", email).one();
    if (member) {
      member.permissions = JSON.parse(member.permissions || '[]');
    }
    return member;
  }

  async getMembers({ role = null, status = 'active' }) {
    let query = "SELECT * FROM members WHERE status = ?";
    const params = [status];

    if (role) {
      query += " AND role = ?";
      params.push(role);
    }

    query += " ORDER BY created_at DESC";

    const members = this.sql.exec(query, ...params).toArray();
    return members.map(m => ({ ...m, permissions: JSON.parse(m.permissions || '[]') }));
  }

  async updateMember(id, data) {
    const updates = [];
    const params = [];

    const allowedFields = ['name', 'role', 'permissions', 'status', 'avatar_url'];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    this.sql.exec(`UPDATE members SET ${updates.join(', ')} WHERE id = ?`, ...params);

    await this.audit('member.updated', 'member', id, { fields: Object.keys(data) });
    return this.getMember(id);
  }

  async updateMemberActivity(userId) {
    this.sql.exec(
      "UPDATE members SET last_active_at = datetime('now') WHERE user_id = ?",
      userId
    );
  }

  async removeMember(id) {
    const member = await this.getMember(id);
    if (!member) throw new Error('Member not found');

    this.sql.exec("UPDATE members SET status = 'removed' WHERE id = ?", id);
    await this.trackUsage('users_count', -1);
    await this.audit('member.removed', 'member', id, { email: member.email });

    return { success: true };
  }

  // ============================================
  // INVITATIONS
  // ============================================

  async createInvitation({ email, role = 'member', permissions = [], invitedById, invitedByName }) {
    // Check if already a member
    const existing = await this.getMemberByEmail(email);
    if (existing) {
      throw new Error('User is already a member');
    }

    // Check pending invitation
    const pending = this.sql.exec(
      "SELECT * FROM invitations WHERE email = ? AND accepted_at IS NULL AND expires_at > datetime('now')",
      email
    ).toArray();

    if (pending.length > 0) {
      throw new Error('Invitation already pending for this email');
    }

    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    this.sql.exec(`
      INSERT INTO invitations (id, email, role, permissions, invited_by_id, invited_by_name, token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, id, email, role, JSON.stringify(permissions), invitedById, invitedByName, token, expiresAt);

    await this.audit('invitation.created', 'invitation', id, { email, role });

    return { id, email, role, token, expiresAt };
  }

  async acceptInvitation(token, userId, userName) {
    const invitation = this.sql.exec(
      "SELECT * FROM invitations WHERE token = ? AND accepted_at IS NULL AND expires_at > datetime('now')",
      token
    ).one();

    if (!invitation) {
      throw new Error('Invalid or expired invitation');
    }

    // Mark invitation as accepted
    this.sql.exec(
      "UPDATE invitations SET accepted_at = datetime('now') WHERE id = ?",
      invitation.id
    );

    // Create member
    const member = await this.addMember({
      userId,
      email: invitation.email,
      name: userName,
      role: invitation.role,
      permissions: JSON.parse(invitation.permissions || '[]'),
      invitedBy: invitation.invited_by_id,
    });

    await this.audit('invitation.accepted', 'invitation', invitation.id, { email: invitation.email });

    return member;
  }

  async getPendingInvitations() {
    return this.sql.exec(
      "SELECT * FROM invitations WHERE accepted_at IS NULL AND expires_at > datetime('now') ORDER BY created_at DESC"
    ).toArray();
  }

  async cancelInvitation(id) {
    this.sql.exec("DELETE FROM invitations WHERE id = ?", id);
    return { success: true };
  }

  // ============================================
  // API KEY MANAGEMENT
  // ============================================

  async generateApiKey({ name, permissions = ['read'], rateLimit = 100, expiresAt = null, createdById, createdByName }) {
    const id = crypto.randomUUID();
    const key = `ppp_${this.generateRandomString(32)}`;
    const keyPrefix = key.substring(0, 12);
    const keyHash = await this.hashApiKey(key);

    this.sql.exec(`
      INSERT INTO api_keys (id, name, key_prefix, key_hash, permissions, rate_limit, expires_at, created_by_id, created_by_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, name, keyPrefix, keyHash, JSON.stringify(permissions), rateLimit, expiresAt, createdById, createdByName);

    await this.audit('api_key.created', 'api_key', id, { name, permissions });

    // Return the full key only once
    return {
      id,
      name,
      key, // Only returned on creation
      keyPrefix,
      permissions,
      rateLimit,
      expiresAt,
    };
  }

  async validateApiKey(key) {
    const keyPrefix = key.substring(0, 12);
    const keyHash = await this.hashApiKey(key);

    const apiKey = this.sql.exec(
      "SELECT * FROM api_keys WHERE key_prefix = ? AND key_hash = ? AND is_active = 1",
      keyPrefix, keyHash
    ).one();

    if (!apiKey) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return { valid: false, error: 'API key expired' };
    }

    // Update last used
    this.sql.exec(
      "UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?",
      apiKey.id
    );

    return {
      valid: true,
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        permissions: JSON.parse(apiKey.permissions || '[]'),
        rateLimit: apiKey.rate_limit,
      },
    };
  }

  async getApiKeys() {
    const keys = this.sql.exec(
      "SELECT id, name, key_prefix, permissions, rate_limit, last_used_at, expires_at, is_active, created_at FROM api_keys ORDER BY created_at DESC"
    ).toArray();

    return keys.map(k => ({
      ...k,
      permissions: JSON.parse(k.permissions || '[]'),
    }));
  }

  async revokeApiKey(id) {
    this.sql.exec("UPDATE api_keys SET is_active = 0 WHERE id = ?", id);
    await this.audit('api_key.revoked', 'api_key', id, {});
    return { success: true };
  }

  async deleteApiKey(id) {
    this.sql.exec("DELETE FROM api_keys WHERE id = ?", id);
    await this.audit('api_key.deleted', 'api_key', id, {});
    return { success: true };
  }

  // ============================================
  // SETTINGS MANAGEMENT
  // ============================================

  async getSetting(key) {
    const setting = this.sql.exec("SELECT * FROM settings WHERE key = ?", key).one();
    if (!setting) return null;

    try {
      return JSON.parse(setting.value);
    } catch {
      return setting.value;
    }
  }

  async setSetting(key, value, category = 'general', isSecret = false) {
    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    this.sql.exec(`
      INSERT INTO settings (key, value, category, is_secret, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, category = ?, is_secret = ?, updated_at = datetime('now')
    `, key, stringValue, category, isSecret ? 1 : 0, stringValue, category, isSecret ? 1 : 0);

    await this.audit('setting.updated', 'setting', key, { category });
    return { key, value, category };
  }

  async getSettings(category = null) {
    let query = "SELECT * FROM settings";
    const params = [];

    if (category) {
      query += " WHERE category = ?";
      params.push(category);
    }

    query += " ORDER BY category, key";

    const settings = this.sql.exec(query, ...params).toArray();

    return settings.reduce((acc, s) => {
      // Don't expose secret values
      let value = s.is_secret ? '********' : s.value;
      try {
        value = s.is_secret ? '********' : JSON.parse(s.value);
      } catch {}

      acc[s.key] = { value, category: s.category, isSecret: !!s.is_secret };
      return acc;
    }, {});
  }

  async deleteSetting(key) {
    this.sql.exec("DELETE FROM settings WHERE key = ?", key);
    return { success: true };
  }

  // ============================================
  // FEATURE FLAGS
  // ============================================

  async isFeatureEnabled(key, context = {}) {
    const flag = this.sql.exec("SELECT * FROM feature_flags WHERE key = ?", key).one();

    if (!flag) return false;
    if (!flag.enabled) return false;

    // Check rollout percentage
    if (flag.rollout_percentage < 100) {
      const hash = this.simpleHash(context.userId || context.sessionId || '');
      if ((hash % 100) >= flag.rollout_percentage) {
        return false;
      }
    }

    // Check conditions
    const conditions = JSON.parse(flag.conditions || '{}');
    for (const [conditionKey, conditionValue] of Object.entries(conditions)) {
      if (context[conditionKey] !== conditionValue) {
        return false;
      }
    }

    return true;
  }

  async setFeatureFlag(key, { enabled, rolloutPercentage = 100, conditions = {} }) {
    this.sql.exec(`
      INSERT INTO feature_flags (key, enabled, rollout_percentage, conditions, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET enabled = ?, rollout_percentage = ?, conditions = ?, updated_at = datetime('now')
    `, key, enabled ? 1 : 0, rolloutPercentage, JSON.stringify(conditions),
       enabled ? 1 : 0, rolloutPercentage, JSON.stringify(conditions));

    await this.audit('feature_flag.updated', 'feature_flag', key, { enabled, rolloutPercentage });
    return { key, enabled, rolloutPercentage, conditions };
  }

  async getFeatureFlags() {
    const flags = this.sql.exec("SELECT * FROM feature_flags ORDER BY key").toArray();
    return flags.map(f => ({
      ...f,
      enabled: !!f.enabled,
      conditions: JSON.parse(f.conditions || '{}'),
    }));
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  async audit(action, resourceType, resourceId, details = {}, actor = {}) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO audit_log (id, action, resource_type, resource_id, actor_type, actor_id, actor_name, actor_ip, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      id, action, resourceType, resourceId,
      actor.type || 'system', actor.id || null, actor.name || null, actor.ip || null,
      JSON.stringify(details)
    );

    return { id, action };
  }

  async getAuditLog({ limit = 100, offset = 0, action = null, resourceType = null, actorId = null }) {
    let query = "SELECT * FROM audit_log WHERE 1=1";
    const params = [];

    if (action) {
      query += " AND action LIKE ?";
      params.push(`%${action}%`);
    }
    if (resourceType) {
      query += " AND resource_type = ?";
      params.push(resourceType);
    }
    if (actorId) {
      query += " AND actor_id = ?";
      params.push(actorId);
    }

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const logs = this.sql.exec(query, ...params).toArray();
    return logs.map(l => ({ ...l, details: JSON.parse(l.details || '{}') }));
  }

  // ============================================
  // WEBHOOKS
  // ============================================

  async registerWebhook({ url, events, secret = null }) {
    const id = crypto.randomUUID();
    const webhookSecret = secret || `whsec_${this.generateRandomString(32)}`;

    this.sql.exec(`
      INSERT INTO webhooks (id, url, events, secret)
      VALUES (?, ?, ?, ?)
    `, id, url, JSON.stringify(events), webhookSecret);

    await this.audit('webhook.created', 'webhook', id, { url, events });

    return { id, url, events, secret: webhookSecret };
  }

  async getWebhooks() {
    const hooks = this.sql.exec("SELECT * FROM webhooks ORDER BY created_at DESC").toArray();
    return hooks.map(h => ({
      ...h,
      events: JSON.parse(h.events || '[]'),
      secret: '********', // Don't expose secret
    }));
  }

  async triggerWebhooks(event, payload) {
    const hooks = this.sql.exec(
      "SELECT * FROM webhooks WHERE is_active = 1"
    ).toArray();

    for (const hook of hooks) {
      const events = JSON.parse(hook.events || '[]');
      if (!events.includes(event) && !events.includes('*')) continue;

      try {
        const signature = await this.signWebhookPayload(payload, hook.secret);

        const response = await fetch(hook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': event,
          },
          body: JSON.stringify(payload),
        });

        this.sql.exec(`
          UPDATE webhooks SET last_triggered_at = datetime('now'), last_status = ?, failure_count = 0 WHERE id = ?
        `, response.status, hook.id);

      } catch (error) {
        this.sql.exec(`
          UPDATE webhooks SET last_triggered_at = datetime('now'), failure_count = failure_count + 1 WHERE id = ?
        `, hook.id);

        // Disable after 10 consecutive failures
        if (hook.failure_count >= 9) {
          this.sql.exec("UPDATE webhooks SET is_active = 0 WHERE id = ?", hook.id);
        }
      }
    }
  }

  async deleteWebhook(id) {
    this.sql.exec("DELETE FROM webhooks WHERE id = ?", id);
    await this.audit('webhook.deleted', 'webhook', id, {});
    return { success: true };
  }

  // ============================================
  // INTEGRATIONS
  // ============================================

  async addIntegration({ provider, name, config = {}, credentials = {} }) {
    const id = crypto.randomUUID();

    this.sql.exec(`
      INSERT INTO integrations (id, provider, name, config, credentials)
      VALUES (?, ?, ?, ?, ?)
    `, id, provider, name, JSON.stringify(config), JSON.stringify(credentials));

    await this.audit('integration.added', 'integration', id, { provider, name });

    return this.getIntegration(id);
  }

  async getIntegration(id) {
    const integration = this.sql.exec("SELECT * FROM integrations WHERE id = ?", id).one();
    if (integration) {
      integration.config = JSON.parse(integration.config || '{}');
      // Don't expose credentials
      integration.credentials = '********';
    }
    return integration;
  }

  async getIntegrations() {
    const integrations = this.sql.exec("SELECT * FROM integrations ORDER BY created_at DESC").toArray();
    return integrations.map(i => ({
      ...i,
      config: JSON.parse(i.config || '{}'),
      credentials: '********',
    }));
  }

  async updateIntegration(id, data) {
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(data)) {
      if (['config', 'credentials', 'status', 'name'].includes(key)) {
        updates.push(`${key} = ?`);
        params.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    this.sql.exec(`UPDATE integrations SET ${updates.join(', ')} WHERE id = ?`, ...params);

    return this.getIntegration(id);
  }

  async removeIntegration(id) {
    this.sql.exec("DELETE FROM integrations WHERE id = ?", id);
    await this.audit('integration.removed', 'integration', id, {});
    return { success: true };
  }

  // ============================================
  // CUSTOMER MANAGEMENT (Links to Customer DOs)
  // ============================================

  async registerCustomer(customerId) {
    // Check customer limit
    const quota = await this.checkQuota('customers_count');
    if (!quota.allowed) {
      throw new Error('Customer limit reached for your plan');
    }

    await this.trackUsage('customers_count', 1);
    await this.audit('customer.registered', 'customer', customerId, {});

    return { customerId, registered: true };
  }

  async unregisterCustomer(customerId) {
    await this.trackUsage('customers_count', -1);
    await this.audit('customer.unregistered', 'customer', customerId, {});

    return { customerId, unregistered: true };
  }

  // ============================================
  // WEBSOCKET FOR ADMIN DASHBOARD
  // ============================================

  async fetch(request) {
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);

      const sessionId = crypto.randomUUID();
      server.serializeAttachment({ sessionId, connectedAt: Date.now() });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected WebSocket", { status: 400 });
  }

  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'get_stats':
          const stats = await this.getQuickStats();
          ws.send(JSON.stringify({ type: 'stats', data: stats }));
          break;

        default:
          ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  }

  async webSocketClose(ws, code, reason) {
    console.log(`Admin WebSocket closed: ${code} - ${reason}`);
  }

  async broadcastToAdmins(type, data) {
    const sockets = this.ctx.getWebSockets();
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    for (const ws of sockets) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Broadcast error:', error);
      }
    }
  }

  // ============================================
  // ANALYTICS & INSIGHTS
  // ============================================

  async getQuickStats() {
    const usage = await this.getUsage();
    const limits = await this.getPlanLimits();
    const subscription = await this.getSubscription();
    const memberCount = this.sql.exec("SELECT COUNT(*) as count FROM members WHERE status = 'active'").one().count;

    return {
      subscription: {
        plan: subscription.plan_name,
        status: subscription.status,
      },
      usage: {
        users: { used: memberCount, limit: limits.max_users },
        customers: { used: usage.customers_count, limit: limits.max_customers },
        documents: { used: usage.documents_count, limit: limits.max_documents },
        storage: { used: usage.storage_used_mb, limit: limits.max_storage_mb },
        apiCalls: { used: usage.api_calls, limit: limits.max_api_calls_per_month },
        aiQueries: { used: usage.ai_queries, limit: limits.max_ai_queries_per_month },
      },
      period: {
        start: usage.period_start,
        end: usage.period_end,
      },
    };
  }

  async getDashboardData() {
    const stats = await this.getQuickStats();
    const recentAudit = await this.getAuditLog({ limit: 10 });
    const members = await this.getMembers({});
    const usageHistory = await this.getUsageHistory(6);

    return {
      stats,
      recentActivity: recentAudit,
      teamMembers: members,
      usageHistory,
    };
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    return result;
  }

  async hashApiKey(key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async signWebhookPayload(payload, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(JSON.stringify(payload))
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  // Export all data (for migration/backup)
  async exportData() {
    return {
      organization: await this.getOrganization(),
      subscription: await this.getSubscription(),
      planLimits: await this.getPlanLimits(),
      usage: await this.getUsage(),
      usageHistory: await this.getUsageHistory(24),
      members: await this.getMembers({}),
      settings: await this.getSettings(),
      featureFlags: await this.getFeatureFlags(),
      webhooks: await this.getWebhooks(),
      integrations: await this.getIntegrations(),
      auditLog: await this.getAuditLog({ limit: 1000 }),
      exportedAt: new Date().toISOString(),
    };
  }
}
```

### Phase 2: Worker API Integration

#### 2.1 Tenant Routes

```javascript
// routes/tenants.js
import { Hono } from 'hono';
import { getUserId, getTenantId } from '../middleware/auth';

const tenants = new Hono();

// Helper to get Tenant DO stub
function getTenantStub(env, tenantId) {
  const id = env.TENANT.idFromName(tenantId);
  return env.TENANT.get(id);
}

// Get organization details
tenants.get('/organization', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const org = await stub.getOrganization();
  return c.json({ organization: org });
});

// Update organization
tenants.patch('/organization', async (c) => {
  const tenantId = getTenantId(c);
  const data = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const org = await stub.updateOrganization(data);
  return c.json({ organization: org });
});

// Subscription & Billing
tenants.get('/subscription', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const [subscription, limits, usage] = await Promise.all([
    stub.getSubscription(),
    stub.getPlanLimits(),
    stub.getUsage(),
  ]);

  return c.json({ subscription, limits, usage });
});

// Usage & Quotas
tenants.get('/usage', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const [usage, limits, history] = await Promise.all([
    stub.getUsage(),
    stub.getPlanLimits(),
    stub.getUsageHistory(12),
  ]);

  return c.json({ usage, limits, history });
});

tenants.get('/quota/:metric', async (c) => {
  const tenantId = getTenantId(c);
  const { metric } = c.req.param();
  const stub = getTenantStub(c.env, tenantId);

  const quota = await stub.checkQuota(metric);
  return c.json({ quota });
});

// Team Members
tenants.get('/members', async (c) => {
  const tenantId = getTenantId(c);
  const { role, status } = c.req.query();
  const stub = getTenantStub(c.env, tenantId);

  const members = await stub.getMembers({ role, status: status || 'active' });
  return c.json({ members });
});

tenants.post('/members/invite', async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const user = c.get('user');
  const { email, role, permissions } = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const invitation = await stub.createInvitation({
    email,
    role,
    permissions,
    invitedById: userId,
    invitedByName: user.name,
  });

  // TODO: Send invitation email

  return c.json({ invitation }, 201);
});

tenants.get('/invitations', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const invitations = await stub.getPendingInvitations();
  return c.json({ invitations });
});

tenants.patch('/members/:memberId', async (c) => {
  const tenantId = getTenantId(c);
  const { memberId } = c.req.param();
  const data = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const member = await stub.updateMember(memberId, data);
  return c.json({ member });
});

tenants.delete('/members/:memberId', async (c) => {
  const tenantId = getTenantId(c);
  const { memberId } = c.req.param();
  const stub = getTenantStub(c.env, tenantId);

  await stub.removeMember(memberId);
  return c.json({ success: true });
});

// API Keys
tenants.get('/api-keys', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const keys = await stub.getApiKeys();
  return c.json({ apiKeys: keys });
});

tenants.post('/api-keys', async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const user = c.get('user');
  const { name, permissions, rateLimit, expiresAt } = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const apiKey = await stub.generateApiKey({
    name,
    permissions,
    rateLimit,
    expiresAt,
    createdById: userId,
    createdByName: user.name,
  });

  return c.json({ apiKey }, 201);
});

tenants.delete('/api-keys/:keyId', async (c) => {
  const tenantId = getTenantId(c);
  const { keyId } = c.req.param();
  const stub = getTenantStub(c.env, tenantId);

  await stub.revokeApiKey(keyId);
  return c.json({ success: true });
});

// Settings
tenants.get('/settings', async (c) => {
  const tenantId = getTenantId(c);
  const { category } = c.req.query();
  const stub = getTenantStub(c.env, tenantId);

  const settings = await stub.getSettings(category);
  return c.json({ settings });
});

tenants.put('/settings/:key', async (c) => {
  const tenantId = getTenantId(c);
  const { key } = c.req.param();
  const { value, category, isSecret } = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const setting = await stub.setSetting(key, value, category, isSecret);
  return c.json({ setting });
});

// Feature Flags
tenants.get('/features', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const flags = await stub.getFeatureFlags();
  return c.json({ features: flags });
});

tenants.get('/features/:key', async (c) => {
  const tenantId = getTenantId(c);
  const { key } = c.req.param();
  const userId = getUserId(c);
  const stub = getTenantStub(c.env, tenantId);

  const enabled = await stub.isFeatureEnabled(key, { userId });
  return c.json({ key, enabled });
});

// Webhooks
tenants.get('/webhooks', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const webhooks = await stub.getWebhooks();
  return c.json({ webhooks });
});

tenants.post('/webhooks', async (c) => {
  const tenantId = getTenantId(c);
  const { url, events } = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const webhook = await stub.registerWebhook({ url, events });
  return c.json({ webhook }, 201);
});

tenants.delete('/webhooks/:webhookId', async (c) => {
  const tenantId = getTenantId(c);
  const { webhookId } = c.req.param();
  const stub = getTenantStub(c.env, tenantId);

  await stub.deleteWebhook(webhookId);
  return c.json({ success: true });
});

// Integrations
tenants.get('/integrations', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const integrations = await stub.getIntegrations();
  return c.json({ integrations });
});

tenants.post('/integrations', async (c) => {
  const tenantId = getTenantId(c);
  const data = await c.req.json();
  const stub = getTenantStub(c.env, tenantId);

  const integration = await stub.addIntegration(data);
  return c.json({ integration }, 201);
});

// Audit Log
tenants.get('/audit-log', async (c) => {
  const tenantId = getTenantId(c);
  const { limit, offset, action, resourceType } = c.req.query();
  const stub = getTenantStub(c.env, tenantId);

  const logs = await stub.getAuditLog({
    limit: parseInt(limit) || 100,
    offset: parseInt(offset) || 0,
    action,
    resourceType,
  });

  return c.json({ auditLog: logs });
});

// Dashboard
tenants.get('/dashboard', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const data = await stub.getDashboardData();
  return c.json(data);
});

// WebSocket
tenants.get('/ws', async (c) => {
  const tenantId = getTenantId(c);

  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket' }, 400);
  }

  const stub = getTenantStub(c.env, tenantId);
  return stub.fetch(c.req.raw);
});

// Export data
tenants.get('/export', async (c) => {
  const tenantId = getTenantId(c);
  const stub = getTenantStub(c.env, tenantId);

  const data = await stub.exportData();
  return c.json(data);
});

export default tenants;
```

### Phase 3: Auth Middleware with Tenant Context

```javascript
// middleware/auth.js
export async function authMiddleware(c, next) {
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');

  if (!sessionToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Validate session and get tenant
  const session = await c.env.DB.prepare(`
    SELECT s.id, s.user_id, s.tenant_id, s.expires_at,
           u.email, u.name, m.role, m.permissions
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN tenant_members m ON m.user_id = u.id AND m.tenant_id = s.tenant_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionToken).first();

  if (!session) {
    return c.json({ error: 'Session expired or invalid' }, 401);
  }

  // Attach to context
  c.set('user', {
    id: session.user_id,
    email: session.email,
    name: session.name,
  });
  c.set('userId', session.user_id);
  c.set('tenantId', session.tenant_id);
  c.set('role', session.role);
  c.set('permissions', JSON.parse(session.permissions || '[]'));

  // Update member activity in Tenant DO
  const tenantStub = c.env.TENANT.get(c.env.TENANT.idFromName(session.tenant_id));
  await tenantStub.updateMemberActivity(session.user_id);

  await next();
}

export function getUserId(c) {
  return c.get('userId');
}

export function getTenantId(c) {
  return c.get('tenantId');
}

export function hasPermission(c, permission) {
  const permissions = c.get('permissions') || [];
  const role = c.get('role');

  // Admins have all permissions
  if (role === 'admin' || role === 'owner') return true;

  return permissions.includes(permission) || permissions.includes('*');
}

// Middleware to check specific permission
export function requirePermission(permission) {
  return async (c, next) => {
    if (!hasPermission(c, permission)) {
      return c.json({ error: 'Forbidden', required: permission }, 403);
    }
    await next();
  };
}

// Middleware to track API usage
export async function trackApiUsage(c, next) {
  const tenantId = getTenantId(c);

  if (tenantId) {
    const tenantStub = c.env.TENANT.get(c.env.TENANT.idFromName(tenantId));

    try {
      await tenantStub.checkAndTrackUsage('api_calls_per_month');
    } catch (error) {
      return c.json({ error: error.message }, 429);
    }
  }

  await next();
}
```

## File Structure

```
worker/
├── src/
│   ├── index.js
│   ├── durable-objects/
│   │   ├── TenantDO.js          # Tenant Durable Object
│   │   └── CustomerDO.js        # Customer Durable Object
│   ├── routes/
│   │   ├── tenants.js           # Tenant API routes
│   │   ├── customers.js         # Customer API routes
│   │   └── auth.js              # Auth routes
│   └── middleware/
│       ├── auth.js              # Auth + tenant context
│       └── rateLimit.js         # Rate limiting
├── wrangler.toml
└── package.json

src/
├── components/
│   └── Admin/
│       ├── Dashboard.jsx
│       ├── TeamMembers.jsx
│       ├── BillingUsage.jsx
│       ├── ApiKeys.jsx
│       ├── Settings.jsx
│       ├── Webhooks.jsx
│       └── AuditLog.jsx
└── services/
    └── tenantApi.js
```

## API Summary

### Organization
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/organization` | Get organization details |
| PATCH | `/tenant/organization` | Update organization |

### Subscription & Usage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/subscription` | Get subscription & limits |
| GET | `/tenant/usage` | Get usage metrics |
| GET | `/tenant/quota/:metric` | Check specific quota |

### Team Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/members` | List team members |
| POST | `/tenant/members/invite` | Invite new member |
| PATCH | `/tenant/members/:id` | Update member |
| DELETE | `/tenant/members/:id` | Remove member |
| GET | `/tenant/invitations` | List pending invites |

### API Keys
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/api-keys` | List API keys |
| POST | `/tenant/api-keys` | Generate new key |
| DELETE | `/tenant/api-keys/:id` | Revoke key |

### Settings & Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/settings` | Get all settings |
| PUT | `/tenant/settings/:key` | Update setting |
| GET | `/tenant/features` | Get feature flags |
| GET | `/tenant/features/:key` | Check if enabled |

### Webhooks & Integrations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/webhooks` | List webhooks |
| POST | `/tenant/webhooks` | Register webhook |
| DELETE | `/tenant/webhooks/:id` | Delete webhook |
| GET | `/tenant/integrations` | List integrations |
| POST | `/tenant/integrations` | Add integration |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tenant/dashboard` | Dashboard data |
| GET | `/tenant/audit-log` | Audit log |
| GET | `/tenant/export` | Export all data |
| GET | `/tenant/ws` | WebSocket |

## Plan Tiers

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|--------------|------------|
| Users | 1 | 5 | 20 | Unlimited |
| Customers | 100 | 500 | 5,000 | Unlimited |
| Documents | 50 | 200 | 1,000 | Unlimited |
| Storage | 100MB | 1GB | 10GB | 100GB |
| API Calls/mo | 1K | 10K | 100K | Unlimited |
| AI Queries/mo | 100 | 1K | 10K | Unlimited |
| Emails/mo | 100 | 1K | 10K | Unlimited |
| WhatsApp/mo | 0 | 100 | 1K | Unlimited |
| Webhooks | ❌ | ❌ | ✅ | ✅ |
| Integrations | ❌ | ❌ | ✅ | ✅ |
| SSO | ❌ | ❌ | ❌ | ✅ |
| Audit Log | ❌ | ❌ | ✅ | ✅ |

## Cost Estimation

### Durable Objects (Per Tenant)
| Metric | Estimate | Cost |
|--------|----------|------|
| Storage | ~1MB/tenant | $0.0002/tenant |
| Requests | ~1K/month | Free tier |
| Duration | ~100 GB-s | Free tier |

### For 100 Tenants
- **Storage**: 100MB = Free tier
- **Requests**: 100K/month = Free tier
- **Total**: ~$0/month for small scale

## Sources

- [Cloudflare Durable Objects Overview](https://developers.cloudflare.com/durable-objects/)
- [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Durable Objects Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/)
- [Durable Objects Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)
