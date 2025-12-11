import { DurableObject } from "cloudflare:workers";

/**
 * TenantDO - Tenant Durable Object
 *
 * Manages organization-level data for a multi-tenant SaaS platform including:
 * - Organization profile and settings
 * - Subscription plans and billing
 * - Usage tracking and quota enforcement
 * - Team member management
 * - API key management
 * - Feature flags
 * - Audit logging
 * - Webhooks and integrations
 * - Real-time dashboard updates via WebSocket
 */
export class TenantDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;

    // In-memory usage counters for fast access
    this.usageCounters = {
      api_calls: 0,
      ai_queries: 0,
      emails_sent: 0,
      whatsapp_sent: 0
    };

    // WebSocket connections for real-time updates
    this.websockets = new Set();

    // Plan tier definitions with limits
    this.planTiers = {
      free: {
        name: 'Free',
        price: 0,
        limits: {
          max_users: 2,
          max_customers: 100,
          max_documents: 50,
          max_storage_mb: 100,
          max_api_calls_per_month: 1000,
          max_ai_queries_per_month: 50,
          max_emails_per_month: 100,
          max_whatsapp_per_month: 50
        }
      },
      starter: {
        name: 'Starter',
        price: 29,
        limits: {
          max_users: 5,
          max_customers: 1000,
          max_documents: 500,
          max_storage_mb: 1000,
          max_api_calls_per_month: 10000,
          max_ai_queries_per_month: 500,
          max_emails_per_month: 1000,
          max_whatsapp_per_month: 500
        }
      },
      professional: {
        name: 'Professional',
        price: 99,
        limits: {
          max_users: 20,
          max_customers: 10000,
          max_documents: 5000,
          max_storage_mb: 10000,
          max_api_calls_per_month: 100000,
          max_ai_queries_per_month: 5000,
          max_emails_per_month: 10000,
          max_whatsapp_per_month: 5000
        }
      },
      enterprise: {
        name: 'Enterprise',
        price: 299,
        limits: {
          max_users: -1, // unlimited
          max_customers: -1,
          max_documents: -1,
          max_storage_mb: -1,
          max_api_calls_per_month: -1,
          max_ai_queries_per_month: -1,
          max_emails_per_month: -1,
          max_whatsapp_per_month: -1
        }
      }
    };

    // Initialize database schema
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
      await this.loadUsageCounters();
    });
  }

  /**
   * Initialize SQLite schema
   */
  async initializeSchema() {
    const sql = this.ctx.storage.sql;

    // Organization profile table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS organization (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        domain TEXT,
        logo_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Subscription table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS subscription (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        plan_tier TEXT NOT NULL DEFAULT 'free',
        status TEXT NOT NULL DEFAULT 'active',
        billing_cycle TEXT DEFAULT 'monthly',
        current_period_start INTEGER,
        current_period_end INTEGER,
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Usage tracking table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        api_calls INTEGER DEFAULT 0,
        ai_queries INTEGER DEFAULT 0,
        emails_sent INTEGER DEFAULT 0,
        whatsapp_sent INTEGER DEFAULT 0,
        storage_used_mb INTEGER DEFAULT 0,
        last_reset INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Team members table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS team_members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        name TEXT,
        role TEXT NOT NULL DEFAULT 'member',
        permissions TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        joined_at INTEGER NOT NULL,
        last_active INTEGER
      )
    `);

    // Invitations table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS invitations (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'member',
        permissions TEXT,
        invited_by TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // API keys table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL UNIQUE,
        key_prefix TEXT NOT NULL,
        permissions TEXT,
        created_by TEXT NOT NULL,
        last_used INTEGER,
        expires_at INTEGER,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL
      )
    `);

    // Settings table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT,
        updated_by TEXT,
        updated_at INTEGER NOT NULL
      )
    `);

    // Feature flags table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        rollout_percentage INTEGER DEFAULT 100,
        conditions TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Audit log table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Webhooks table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL,
        secret TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        last_triggered INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Integrations table
    sql.exec(`
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT NOT NULL,
        credentials TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_by TEXT NOT NULL,
        last_synced INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Registered customers table (for quota tracking)
    sql.exec(`
      CREATE TABLE IF NOT EXISTS registered_customers (
        customer_id TEXT PRIMARY KEY,
        registered_at INTEGER NOT NULL
      )
    `);

    // Create indexes
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhooks(status)`);

    // Initialize default records if needed
    const orgExists = sql.exec(`SELECT COUNT(*) as count FROM organization`).toArray()[0]?.count > 0;
    if (!orgExists) {
      const now = Date.now();
      sql.exec(`
        INSERT INTO subscription (id, plan_tier, status, created_at, updated_at)
        VALUES (1, 'free', 'active', ?, ?)
      `, now, now);

      sql.exec(`
        INSERT INTO usage (id, last_reset, updated_at)
        VALUES (1, ?, ?)
      `, now, now);
    }
  }

  /**
   * Load usage counters into memory
   */
  async loadUsageCounters() {
    const sql = this.ctx.storage.sql;
    const usage = sql.exec(`SELECT * FROM usage WHERE id = 1`).toArray()[0];

    if (usage) {
      this.usageCounters.api_calls = usage.api_calls || 0;
      this.usageCounters.ai_queries = usage.ai_queries || 0;
      this.usageCounters.emails_sent = usage.emails_sent || 0;
      this.usageCounters.whatsapp_sent = usage.whatsapp_sent || 0;
    }
  }

  /**
   * Main fetch handler
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // WebSocket upgrade for real-time dashboard
      if (request.headers.get('Upgrade') === 'websocket') {
        return await this.handleWebSocket(request);
      }

      // Organization endpoints
      if (path === '/organization' && method === 'POST') {
        return await this.createOrganization(request);
      }
      if (path === '/organization' && method === 'GET') {
        return await this.getOrganization();
      }
      if (path === '/organization' && method === 'PUT') {
        return await this.updateOrganization(request);
      }

      // Subscription endpoints
      if (path === '/subscription' && method === 'GET') {
        return await this.getSubscription();
      }
      if (path === '/subscription' && method === 'PUT') {
        return await this.updateSubscription(request);
      }
      if (path === '/subscription/limits' && method === 'GET') {
        return await this.getSubscriptionLimits();
      }

      // Usage endpoints
      if (path === '/usage' && method === 'GET') {
        return await this.getUsage();
      }
      if (path === '/usage/increment' && method === 'POST') {
        return await this.incrementUsage(request);
      }
      if (path === '/usage/check' && method === 'POST') {
        return await this.checkUsageLimit(request);
      }
      if (path === '/usage/reset' && method === 'POST') {
        return await this.resetUsage();
      }

      // Team members endpoints
      if (path === '/team/members' && method === 'GET') {
        return await this.getTeamMembers();
      }
      if (path === '/team/members' && method === 'POST') {
        return await this.addTeamMember(request);
      }
      if (path.startsWith('/team/members/') && method === 'PUT') {
        return await this.updateTeamMember(request);
      }
      if (path.startsWith('/team/members/') && method === 'DELETE') {
        return await this.removeTeamMember(request);
      }

      // Invitations endpoints
      if (path === '/invitations' && method === 'GET') {
        return await this.getInvitations();
      }
      if (path === '/invitations' && method === 'POST') {
        return await this.createInvitation(request);
      }
      if (path.startsWith('/invitations/') && path.endsWith('/accept') && method === 'POST') {
        return await this.acceptInvitation(request);
      }
      if (path.startsWith('/invitations/') && method === 'DELETE') {
        return await this.cancelInvitation(request);
      }

      // API keys endpoints
      if (path === '/api-keys' && method === 'GET') {
        return await this.getApiKeys();
      }
      if (path === '/api-keys' && method === 'POST') {
        return await this.createApiKey(request);
      }
      if (path === '/api-keys/validate' && method === 'POST') {
        return await this.validateApiKey(request);
      }
      if (path.startsWith('/api-keys/') && method === 'DELETE') {
        return await this.revokeApiKey(request);
      }

      // Settings endpoints
      if (path === '/settings' && method === 'GET') {
        return await this.getSettings(request);
      }
      if (path === '/settings' && method === 'PUT') {
        return await this.updateSettings(request);
      }
      if (path.startsWith('/settings/') && method === 'DELETE') {
        return await this.deleteSetting(request);
      }

      // Feature flags endpoints
      if (path === '/feature-flags' && method === 'GET') {
        return await this.getFeatureFlags();
      }
      if (path === '/feature-flags' && method === 'POST') {
        return await this.createFeatureFlag(request);
      }
      if (path.startsWith('/feature-flags/') && method === 'PUT') {
        return await this.updateFeatureFlag(request);
      }
      if (path === '/feature-flags/check' && method === 'POST') {
        return await this.checkFeatureFlag(request);
      }

      // Audit log endpoints
      if (path === '/audit-log' && method === 'GET') {
        return await this.getAuditLog(request);
      }
      if (path === '/audit-log' && method === 'POST') {
        return await this.logAudit(request);
      }

      // Webhooks endpoints
      if (path === '/webhooks' && method === 'GET') {
        return await this.getWebhooks();
      }
      if (path === '/webhooks' && method === 'POST') {
        return await this.createWebhook(request);
      }
      if (path.startsWith('/webhooks/') && method === 'PUT') {
        return await this.updateWebhook(request);
      }
      if (path.startsWith('/webhooks/') && method === 'DELETE') {
        return await this.deleteWebhook(request);
      }
      if (path === '/webhooks/trigger' && method === 'POST') {
        return await this.triggerWebhook(request);
      }

      // Integrations endpoints
      if (path === '/integrations' && method === 'GET') {
        return await this.getIntegrations();
      }
      if (path === '/integrations' && method === 'POST') {
        return await this.createIntegration(request);
      }
      if (path.startsWith('/integrations/') && method === 'PUT') {
        return await this.updateIntegration(request);
      }
      if (path.startsWith('/integrations/') && method === 'DELETE') {
        return await this.deleteIntegration(request);
      }

      // Customer registration endpoints
      if (path === '/customers/register' && method === 'POST') {
        return await this.registerCustomer(request);
      }
      if (path === '/customers/unregister' && method === 'POST') {
        return await this.unregisterCustomer(request);
      }
      if (path === '/customers/count' && method === 'GET') {
        return await this.getCustomerCount();
      }

      // Dashboard endpoints
      if (path === '/dashboard' && method === 'GET') {
        return await this.getDashboardData();
      }
      if (path === '/dashboard/stats' && method === 'GET') {
        return await this.getQuickStats();
      }

      // Export data endpoint
      if (path === '/export' && method === 'GET') {
        return await this.exportData();
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('TenantDO error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * WebSocket handler for real-time dashboard updates
   */
  async handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.websockets.add(server);

    // Send initial dashboard data
    const dashboardData = await this.getDashboardDataInternal();
    server.send(JSON.stringify({ type: 'initial', data: dashboardData }));

    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * WebSocket message handler (hibernation API)
   */
  async webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);

      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  }

  /**
   * WebSocket close handler
   */
  async webSocketClose(ws, code, reason, wasClean) {
    this.websockets.delete(ws);
  }

  /**
   * WebSocket error handler
   */
  async webSocketError(ws, error) {
    console.error('WebSocket error:', error);
    this.websockets.delete(ws);
  }

  /**
   * Broadcast update to all connected WebSocket clients
   */
  broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });

    for (const ws of this.websockets) {
      try {
        ws.send(message);
      } catch (error) {
        console.error('Broadcast error:', error);
        this.websockets.delete(ws);
      }
    }
  }

  // ========== Organization Methods ==========

  async createOrganization(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Check if organization already exists
    const existing = sql.exec(`SELECT COUNT(*) as count FROM organization`).toArray()[0]?.count;
    if (existing > 0) {
      return new Response(JSON.stringify({ error: 'Organization already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const tenantId = data.tenant_id || this.ctx.id.toString();
    const slug = data.slug || this.generateSlug(data.name);

    sql.exec(`
      INSERT INTO organization (id, tenant_id, name, slug, domain, logo_url, created_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `, tenantId, data.name, slug, data.domain || null, data.logo_url || null, now, now);

    const organization = sql.exec(`SELECT * FROM organization WHERE id = 1`).toArray()[0];

    await this.logAuditInternal(data.user_id, 'organization.created', 'organization', tenantId,
      { name: data.name, slug });

    return new Response(JSON.stringify({ success: true, organization }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getOrganization() {
    const sql = this.ctx.storage.sql;
    const organization = sql.exec(`SELECT * FROM organization WHERE id = 1`).toArray()[0];

    if (!organization) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(organization), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateOrganization(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.slug !== undefined) {
      updates.push('slug = ?');
      values.push(data.slug);
    }
    if (data.domain !== undefined) {
      updates.push('domain = ?');
      values.push(data.domain);
    }
    if (data.logo_url !== undefined) {
      updates.push('logo_url = ?');
      values.push(data.logo_url);
    }

    updates.push('updated_at = ?');
    values.push(now);

    sql.exec(`UPDATE organization SET ${updates.join(', ')} WHERE id = 1`, ...values);

    const organization = sql.exec(`SELECT * FROM organization WHERE id = 1`).toArray()[0];

    await this.logAuditInternal(data.user_id, 'organization.updated', 'organization',
      organization.tenant_id, data);

    this.broadcastUpdate('organization.updated', organization);

    return new Response(JSON.stringify({ success: true, organization }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Subscription Methods ==========

  async getSubscription() {
    const sql = this.ctx.storage.sql;
    const subscription = sql.exec(`SELECT * FROM subscription WHERE id = 1`).toArray()[0];

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const planDetails = this.planTiers[subscription.plan_tier];

    return new Response(JSON.stringify({ ...subscription, plan_details: planDetails }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateSubscription(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const updates = [];
    const values = [];

    if (data.plan_tier !== undefined) {
      if (!this.planTiers[data.plan_tier]) {
        return new Response(JSON.stringify({ error: 'Invalid plan tier' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      updates.push('plan_tier = ?');
      values.push(data.plan_tier);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.billing_cycle !== undefined) {
      updates.push('billing_cycle = ?');
      values.push(data.billing_cycle);
    }
    if (data.current_period_start !== undefined) {
      updates.push('current_period_start = ?');
      values.push(data.current_period_start);
    }
    if (data.current_period_end !== undefined) {
      updates.push('current_period_end = ?');
      values.push(data.current_period_end);
    }
    if (data.stripe_customer_id !== undefined) {
      updates.push('stripe_customer_id = ?');
      values.push(data.stripe_customer_id);
    }
    if (data.stripe_subscription_id !== undefined) {
      updates.push('stripe_subscription_id = ?');
      values.push(data.stripe_subscription_id);
    }

    updates.push('updated_at = ?');
    values.push(now);

    sql.exec(`UPDATE subscription SET ${updates.join(', ')} WHERE id = 1`, ...values);

    const subscription = sql.exec(`SELECT * FROM subscription WHERE id = 1`).toArray()[0];

    await this.logAuditInternal(data.user_id, 'subscription.updated', 'subscription',
      subscription.id.toString(), data);

    this.broadcastUpdate('subscription.updated', subscription);

    return new Response(JSON.stringify({ success: true, subscription }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getSubscriptionLimits() {
    const sql = this.ctx.storage.sql;
    const subscription = sql.exec(`SELECT * FROM subscription WHERE id = 1`).toArray()[0];

    if (!subscription) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const limits = this.planTiers[subscription.plan_tier]?.limits || {};

    return new Response(JSON.stringify({ plan_tier: subscription.plan_tier, limits }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Usage Methods ==========

  async getUsage() {
    const sql = this.ctx.storage.sql;
    const usage = sql.exec(`SELECT * FROM usage WHERE id = 1`).toArray()[0];
    const subscription = sql.exec(`SELECT plan_tier FROM subscription WHERE id = 1`).toArray()[0];

    const limits = this.planTiers[subscription.plan_tier]?.limits || {};

    return new Response(JSON.stringify({
      usage,
      limits,
      in_memory_counters: this.usageCounters
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async incrementUsage(request) {
    const data = await request.json();
    const { metric, amount = 1 } = data;

    if (!['api_calls', 'ai_queries', 'emails_sent', 'whatsapp_sent'].includes(metric)) {
      return new Response(JSON.stringify({ error: 'Invalid metric' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Increment in-memory counter
    this.usageCounters[metric] += amount;

    // Persist to database every 10 increments
    if (this.usageCounters[metric] % 10 === 0) {
      const sql = this.ctx.storage.sql;
      const now = Date.now();
      sql.exec(`
        UPDATE usage
        SET ${toSnakeCase(metric)} = ?, updated_at = ?
        WHERE id = 1
      `, this.usageCounters[metric], now);
    }

    return new Response(JSON.stringify({
      success: true,
      current_value: this.usageCounters[metric]
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async checkUsageLimit(request) {
    const data = await request.json();
    const { metric } = data;

    const sql = this.ctx.storage.sql;
    const subscription = sql.exec(`SELECT plan_tier FROM subscription WHERE id = 1`).toArray()[0];
    const limits = this.planTiers[subscription.plan_tier]?.limits || {};

    const limitKey = `max_${metric}_per_month`;
    const limit = limits[limitKey];

    // -1 means unlimited
    if (limit === -1) {
      return new Response(JSON.stringify({
        allowed: true,
        current: this.usageCounters[metric],
        limit: -1
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const current = this.usageCounters[metric] || 0;
    const allowed = current < limit;

    return new Response(JSON.stringify({
      allowed,
      current,
      limit,
      remaining: Math.max(0, limit - current)
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async resetUsage() {
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Reset in-memory counters
    this.usageCounters.api_calls = 0;
    this.usageCounters.ai_queries = 0;
    this.usageCounters.emails_sent = 0;
    this.usageCounters.whatsapp_sent = 0;

    // Reset database
    sql.exec(`
      UPDATE usage
      SET api_calls = 0, ai_queries = 0, emails_sent = 0, whatsapp_sent = 0,
          last_reset = ?, updated_at = ?
      WHERE id = 1
    `, now, now);

    await this.logAuditInternal(null, 'usage.reset', 'usage', '1', {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Team Members Methods ==========

  async getTeamMembers() {
    const sql = this.ctx.storage.sql;
    const members = sql.exec(`
      SELECT id, user_id, email, name, role, permissions, status, joined_at, last_active
      FROM team_members
      ORDER BY joined_at DESC
    `).toArray();

    return new Response(JSON.stringify({ members }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async addTeamMember(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Check user limit
    const subscription = sql.exec(`SELECT plan_tier FROM subscription WHERE id = 1`).toArray()[0];
    const limits = this.planTiers[subscription.plan_tier]?.limits || {};
    const maxUsers = limits.max_users;

    if (maxUsers !== -1) {
      const currentCount = sql.exec(`SELECT COUNT(*) as count FROM team_members WHERE status = 'active'`).toArray()[0]?.count || 0;
      if (currentCount >= maxUsers) {
        return new Response(JSON.stringify({
          error: 'User limit reached for current plan',
          current: currentCount,
          limit: maxUsers
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    const id = generateRandomString(16);
    const permissions = data.permissions ? JSON.stringify(data.permissions) : null;

    sql.exec(`
      INSERT INTO team_members (id, user_id, email, name, role, permissions, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `, id, data.user_id, data.email, data.name || null, data.role || 'member', permissions, now);

    const member = sql.exec(`SELECT * FROM team_members WHERE id = ?`, id).toArray()[0];

    await this.logAuditInternal(data.added_by, 'team.member_added', 'team_member', id,
      { email: data.email, role: data.role });

    this.broadcastUpdate('team.member_added', member);

    return new Response(JSON.stringify({ success: true, member }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateTeamMember(request) {
    const url = new URL(request.url);
    const memberId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.role !== undefined) {
      updates.push('role = ?');
      values.push(data.role);
    }
    if (data.permissions !== undefined) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(data.permissions));
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.last_active !== undefined) {
      updates.push('last_active = ?');
      values.push(data.last_active);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No updates provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    values.push(memberId);
    sql.exec(`UPDATE team_members SET ${updates.join(', ')} WHERE id = ?`, ...values);

    const member = sql.exec(`SELECT * FROM team_members WHERE id = ?`, memberId).toArray()[0];

    if (!member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    await this.logAuditInternal(data.updated_by, 'team.member_updated', 'team_member', memberId, data);

    this.broadcastUpdate('team.member_updated', member);

    return new Response(JSON.stringify({ success: true, member }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async removeTeamMember(request) {
    const url = new URL(request.url);
    const memberId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    const member = sql.exec(`SELECT * FROM team_members WHERE id = ?`, memberId).toArray()[0];

    if (!member) {
      return new Response(JSON.stringify({ error: 'Member not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    sql.exec(`DELETE FROM team_members WHERE id = ?`, memberId);

    await this.logAuditInternal(data.removed_by, 'team.member_removed', 'team_member', memberId,
      { email: member.email });

    this.broadcastUpdate('team.member_removed', { id: memberId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Invitations Methods ==========

  async getInvitations() {
    const sql = this.ctx.storage.sql;
    const invitations = sql.exec(`
      SELECT id, email, role, permissions, invited_by, status, expires_at, created_at
      FROM invitations
      WHERE status = 'pending'
      ORDER BY created_at DESC
    `).toArray();

    return new Response(JSON.stringify({ invitations }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async createInvitation(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const id = generateRandomString(16);
    const token = generateRandomString(32);
    const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days
    const permissions = data.permissions ? JSON.stringify(data.permissions) : null;

    sql.exec(`
      INSERT INTO invitations (id, email, role, permissions, invited_by, token, status, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `, id, data.email, data.role || 'member', permissions, data.invited_by, token, expiresAt, now);

    const invitation = sql.exec(`SELECT * FROM invitations WHERE id = ?`, id).toArray()[0];

    await this.logAuditInternal(data.invited_by, 'invitation.created', 'invitation', id,
      { email: data.email, role: data.role });

    this.broadcastUpdate('invitation.created', { ...invitation, token: undefined });

    return new Response(JSON.stringify({ success: true, invitation }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async acceptInvitation(request) {
    const url = new URL(request.url);
    const invitationId = url.pathname.split('/')[2];
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const invitation = sql.exec(`
      SELECT * FROM invitations WHERE id = ? AND token = ?
    `, invitationId, data.token).toArray()[0];

    if (!invitation) {
      return new Response(JSON.stringify({ error: 'Invalid invitation' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (invitation.status !== 'pending') {
      return new Response(JSON.stringify({ error: 'Invitation already processed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (invitation.expires_at < now) {
      return new Response(JSON.stringify({ error: 'Invitation expired' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Add team member
    const memberId = generateRandomString(16);
    sql.exec(`
      INSERT INTO team_members (id, user_id, email, name, role, permissions, status, joined_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
    `, memberId, data.user_id, invitation.email, data.name || null, invitation.role,
       invitation.permissions, now);

    // Update invitation status
    sql.exec(`UPDATE invitations SET status = 'accepted' WHERE id = ?`, invitationId);

    const member = sql.exec(`SELECT * FROM team_members WHERE id = ?`, memberId).toArray()[0];

    await this.logAuditInternal(data.user_id, 'invitation.accepted', 'invitation', invitationId,
      { email: invitation.email });

    this.broadcastUpdate('invitation.accepted', { invitation_id: invitationId, member });

    return new Response(JSON.stringify({ success: true, member }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async cancelInvitation(request) {
    const url = new URL(request.url);
    const invitationId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    sql.exec(`UPDATE invitations SET status = 'cancelled' WHERE id = ?`, invitationId);

    await this.logAuditInternal(data.cancelled_by, 'invitation.cancelled', 'invitation', invitationId, {});

    this.broadcastUpdate('invitation.cancelled', { id: invitationId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== API Keys Methods ==========

  async getApiKeys() {
    const sql = this.ctx.storage.sql;
    const keys = sql.exec(`
      SELECT id, name, key_prefix, permissions, created_by, last_used, expires_at, status, created_at
      FROM api_keys
      WHERE status = 'active'
      ORDER BY created_at DESC
    `).toArray();

    return new Response(JSON.stringify({ keys }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async createApiKey(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const id = generateRandomString(16);
    const apiKey = `ppp_${generateRandomString(32)}`;
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 11); // "ppp_" + first 7 chars
    const permissions = data.permissions ? JSON.stringify(data.permissions) : null;
    const expiresAt = data.expires_at || null;

    sql.exec(`
      INSERT INTO api_keys (id, name, key_hash, key_prefix, permissions, created_by, expires_at, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `, id, data.name, keyHash, keyPrefix, permissions, data.created_by, expiresAt, now);

    const keyRecord = sql.exec(`SELECT * FROM api_keys WHERE id = ?`, id).toArray()[0];

    await this.logAuditInternal(data.created_by, 'api_key.created', 'api_key', id,
      { name: data.name });

    this.broadcastUpdate('api_key.created', { ...keyRecord, key_hash: undefined });

    // Return the actual key only on creation
    return new Response(JSON.stringify({
      success: true,
      api_key: apiKey,
      key_record: keyRecord
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async validateApiKey(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const keyHash = await hashApiKey(data.api_key);
    const keyRecord = sql.exec(`
      SELECT * FROM api_keys WHERE key_hash = ? AND status = 'active'
    `, keyHash).toArray()[0];

    if (!keyRecord) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid API key' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (keyRecord.expires_at && keyRecord.expires_at < now) {
      return new Response(JSON.stringify({ valid: false, error: 'API key expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update last used timestamp
    sql.exec(`UPDATE api_keys SET last_used = ? WHERE id = ?`, now, keyRecord.id);

    return new Response(JSON.stringify({
      valid: true,
      key_id: keyRecord.id,
      permissions: keyRecord.permissions ? JSON.parse(keyRecord.permissions) : null
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async revokeApiKey(request) {
    const url = new URL(request.url);
    const keyId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    sql.exec(`UPDATE api_keys SET status = 'revoked' WHERE id = ?`, keyId);

    await this.logAuditInternal(data.revoked_by, 'api_key.revoked', 'api_key', keyId, {});

    this.broadcastUpdate('api_key.revoked', { id: keyId });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Settings Methods ==========

  async getSettings(request) {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const sql = this.ctx.storage.sql;

    let settings;
    if (category) {
      settings = sql.exec(`SELECT * FROM settings WHERE category = ?`, category).toArray();
    } else {
      settings = sql.exec(`SELECT * FROM settings`).toArray();
    }

    // Convert to key-value object
    const settingsObj = {};
    for (const setting of settings) {
      try {
        settingsObj[setting.key] = JSON.parse(setting.value);
      } catch {
        settingsObj[setting.key] = setting.value;
      }
    }

    return new Response(JSON.stringify({ settings: settingsObj, raw: settings }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateSettings(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    for (const [key, value] of Object.entries(data.settings || {})) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

      sql.exec(`
        INSERT INTO settings (key, value, category, updated_by, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          category = excluded.category,
          updated_by = excluded.updated_by,
          updated_at = excluded.updated_at
      `, key, valueStr, data.category || null, data.updated_by || null, now);
    }

    await this.logAuditInternal(data.updated_by, 'settings.updated', 'settings', 'multiple',
      { keys: Object.keys(data.settings || {}) });

    this.broadcastUpdate('settings.updated', { keys: Object.keys(data.settings || {}) });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async deleteSetting(request) {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.split('/').pop());
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    sql.exec(`DELETE FROM settings WHERE key = ?`, key);

    await this.logAuditInternal(data.deleted_by, 'setting.deleted', 'setting', key, {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Feature Flags Methods ==========

  async getFeatureFlags() {
    const sql = this.ctx.storage.sql;
    const flags = sql.exec(`
      SELECT id, name, description, enabled, rollout_percentage, conditions, created_at, updated_at
      FROM feature_flags
      ORDER BY name
    `).toArray();

    return new Response(JSON.stringify({ flags }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async createFeatureFlag(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const id = generateRandomString(16);
    const conditions = data.conditions ? JSON.stringify(data.conditions) : null;

    sql.exec(`
      INSERT INTO feature_flags (id, name, description, enabled, rollout_percentage, conditions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, id, data.name, data.description || null, data.enabled ? 1 : 0,
       data.rollout_percentage || 100, conditions, now, now);

    const flag = sql.exec(`SELECT * FROM feature_flags WHERE id = ?`, id).toArray()[0];

    await this.logAuditInternal(data.created_by, 'feature_flag.created', 'feature_flag', id,
      { name: data.name });

    return new Response(JSON.stringify({ success: true, flag }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateFeatureFlag(request) {
    const url = new URL(request.url);
    const flagId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      values.push(data.description);
    }
    if (data.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    if (data.rollout_percentage !== undefined) {
      updates.push('rollout_percentage = ?');
      values.push(data.rollout_percentage);
    }
    if (data.conditions !== undefined) {
      updates.push('conditions = ?');
      values.push(JSON.stringify(data.conditions));
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(flagId);
    sql.exec(`UPDATE feature_flags SET ${updates.join(', ')} WHERE id = ?`, ...values);

    const flag = sql.exec(`SELECT * FROM feature_flags WHERE id = ?`, flagId).toArray()[0];

    await this.logAuditInternal(data.updated_by, 'feature_flag.updated', 'feature_flag', flagId, data);

    this.broadcastUpdate('feature_flag.updated', flag);

    return new Response(JSON.stringify({ success: true, flag }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async checkFeatureFlag(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    const flag = sql.exec(`
      SELECT * FROM feature_flags WHERE name = ?
    `, data.flag_name).toArray()[0];

    if (!flag || !flag.enabled) {
      return new Response(JSON.stringify({ enabled: false }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check rollout percentage
    if (flag.rollout_percentage < 100) {
      const userHash = simpleHash(data.user_id || 'anonymous');
      const bucket = userHash % 100;
      if (bucket >= flag.rollout_percentage) {
        return new Response(JSON.stringify({ enabled: false, reason: 'rollout' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Check conditions if any
    if (flag.conditions) {
      try {
        const conditions = JSON.parse(flag.conditions);
        // Simple condition checking (can be extended)
        if (conditions.plan_tiers) {
          const subscription = sql.exec(`SELECT plan_tier FROM subscription WHERE id = 1`).toArray()[0];
          if (!conditions.plan_tiers.includes(subscription.plan_tier)) {
            return new Response(JSON.stringify({ enabled: false, reason: 'plan_tier' }), {
              headers: { 'Content-Type': 'application/json' }
            });
          }
        }
      } catch (error) {
        console.error('Error checking feature flag conditions:', error);
      }
    }

    return new Response(JSON.stringify({ enabled: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Audit Log Methods ==========

  async getAuditLog(request) {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const userId = url.searchParams.get('user_id');
    const action = url.searchParams.get('action');

    const sql = this.ctx.storage.sql;

    let query = `SELECT * FROM audit_log WHERE 1=1`;
    const params = [];

    if (userId) {
      query += ` AND user_id = ?`;
      params.push(userId);
    }
    if (action) {
      query += ` AND action = ?`;
      params.push(action);
    }

    query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const logs = sql.exec(query, ...params).toArray();

    return new Response(JSON.stringify({ logs }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async logAudit(request) {
    const data = await request.json();
    await this.logAuditInternal(
      data.user_id,
      data.action,
      data.resource_type,
      data.resource_id,
      data.details,
      data.ip_address,
      data.user_agent
    );

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async logAuditInternal(userId, action, resourceType, resourceId, details, ipAddress = null, userAgent = null) {
    const sql = this.ctx.storage.sql;
    const id = generateRandomString(16);
    const now = Date.now();
    const detailsStr = details ? JSON.stringify(details) : null;

    sql.exec(`
      INSERT INTO audit_log (id, user_id, action, resource_type, resource_id, details, ip_address, user_agent, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, id, userId, action, resourceType, resourceId, detailsStr, ipAddress, userAgent, now);
  }

  // ========== Webhooks Methods ==========

  async getWebhooks() {
    const sql = this.ctx.storage.sql;
    const webhooks = sql.exec(`
      SELECT id, url, events, status, created_by, last_triggered, created_at, updated_at
      FROM webhooks
      WHERE status = 'active'
      ORDER BY created_at DESC
    `).toArray();

    return new Response(JSON.stringify({ webhooks }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async createWebhook(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const id = generateRandomString(16);
    const secret = generateRandomString(32);
    const events = JSON.stringify(data.events || []);

    sql.exec(`
      INSERT INTO webhooks (id, url, events, secret, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'active', ?, ?, ?)
    `, id, data.url, events, secret, data.created_by, now, now);

    const webhook = sql.exec(`SELECT * FROM webhooks WHERE id = ?`, id).toArray()[0];

    await this.logAuditInternal(data.created_by, 'webhook.created', 'webhook', id,
      { url: data.url, events: data.events });

    return new Response(JSON.stringify({ success: true, webhook }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateWebhook(request) {
    const url = new URL(request.url);
    const webhookId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const updates = [];
    const values = [];

    if (data.url !== undefined) {
      updates.push('url = ?');
      values.push(data.url);
    }
    if (data.events !== undefined) {
      updates.push('events = ?');
      values.push(JSON.stringify(data.events));
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(webhookId);
    sql.exec(`UPDATE webhooks SET ${updates.join(', ')} WHERE id = ?`, ...values);

    const webhook = sql.exec(`SELECT * FROM webhooks WHERE id = ?`, webhookId).toArray()[0];

    await this.logAuditInternal(data.updated_by, 'webhook.updated', 'webhook', webhookId, data);

    return new Response(JSON.stringify({ success: true, webhook }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async deleteWebhook(request) {
    const url = new URL(request.url);
    const webhookId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    sql.exec(`DELETE FROM webhooks WHERE id = ?`, webhookId);

    await this.logAuditInternal(data.deleted_by, 'webhook.deleted', 'webhook', webhookId, {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async triggerWebhook(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Get all active webhooks that subscribe to this event
    const webhooks = sql.exec(`
      SELECT * FROM webhooks WHERE status = 'active'
    `).toArray();

    const promises = [];

    for (const webhook of webhooks) {
      try {
        const events = JSON.parse(webhook.events);
        if (events.includes(data.event)) {
          const payload = {
            event: data.event,
            data: data.payload,
            timestamp: now,
            tenant_id: this.ctx.id.toString()
          };

          const signature = await signWebhookPayload(payload, webhook.secret);

          // Trigger webhook asynchronously
          const promise = fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Signature': signature,
              'X-Webhook-Event': data.event
            },
            body: JSON.stringify(payload)
          }).then(() => {
            // Update last triggered timestamp
            sql.exec(`UPDATE webhooks SET last_triggered = ? WHERE id = ?`, now, webhook.id);
          }).catch(error => {
            console.error(`Webhook ${webhook.id} failed:`, error);
          });

          promises.push(promise);
        }
      } catch (error) {
        console.error(`Error processing webhook ${webhook.id}:`, error);
      }
    }

    // Don't wait for webhooks to complete
    this.ctx.waitUntil(Promise.all(promises));

    return new Response(JSON.stringify({ success: true, triggered: promises.length }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Integrations Methods ==========

  async getIntegrations() {
    const sql = this.ctx.storage.sql;
    const integrations = sql.exec(`
      SELECT id, provider, name, status, created_by, last_synced, created_at, updated_at
      FROM integrations
      ORDER BY created_at DESC
    `).toArray();

    return new Response(JSON.stringify({ integrations }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async createIntegration(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const id = generateRandomString(16);
    const config = JSON.stringify(data.config || {});
    const credentials = data.credentials ? JSON.stringify(data.credentials) : null;

    sql.exec(`
      INSERT INTO integrations (id, provider, name, config, credentials, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)
    `, id, data.provider, data.name, config, credentials, data.created_by, now, now);

    const integration = sql.exec(`
      SELECT id, provider, name, config, status, created_by, last_synced, created_at, updated_at
      FROM integrations WHERE id = ?
    `, id).toArray()[0];

    await this.logAuditInternal(data.created_by, 'integration.created', 'integration', id,
      { provider: data.provider, name: data.name });

    return new Response(JSON.stringify({ success: true, integration }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async updateIntegration(request) {
    const url = new URL(request.url);
    const integrationId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    const updates = [];
    const values = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.config !== undefined) {
      updates.push('config = ?');
      values.push(JSON.stringify(data.config));
    }
    if (data.credentials !== undefined) {
      updates.push('credentials = ?');
      values.push(JSON.stringify(data.credentials));
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      values.push(data.status);
    }
    if (data.last_synced !== undefined) {
      updates.push('last_synced = ?');
      values.push(data.last_synced);
    }

    updates.push('updated_at = ?');
    values.push(now);

    values.push(integrationId);
    sql.exec(`UPDATE integrations SET ${updates.join(', ')} WHERE id = ?`, ...values);

    const integration = sql.exec(`
      SELECT id, provider, name, config, status, created_by, last_synced, created_at, updated_at
      FROM integrations WHERE id = ?
    `, integrationId).toArray()[0];

    await this.logAuditInternal(data.updated_by, 'integration.updated', 'integration', integrationId, data);

    return new Response(JSON.stringify({ success: true, integration }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async deleteIntegration(request) {
    const url = new URL(request.url);
    const integrationId = url.pathname.split('/').pop();
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    sql.exec(`DELETE FROM integrations WHERE id = ?`, integrationId);

    await this.logAuditInternal(data.deleted_by, 'integration.deleted', 'integration', integrationId, {});

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Customer Registration Methods ==========

  async registerCustomer(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;
    const now = Date.now();

    // Check customer limit
    const subscription = sql.exec(`SELECT plan_tier FROM subscription WHERE id = 1`).toArray()[0];
    const limits = this.planTiers[subscription.plan_tier]?.limits || {};
    const maxCustomers = limits.max_customers;

    if (maxCustomers !== -1) {
      const currentCount = sql.exec(`SELECT COUNT(*) as count FROM registered_customers`).toArray()[0]?.count || 0;
      if (currentCount >= maxCustomers) {
        return new Response(JSON.stringify({
          error: 'Customer limit reached for current plan',
          current: currentCount,
          limit: maxCustomers
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    sql.exec(`
      INSERT INTO registered_customers (customer_id, registered_at)
      VALUES (?, ?)
      ON CONFLICT(customer_id) DO NOTHING
    `, data.customer_id, now);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async unregisterCustomer(request) {
    const data = await request.json();
    const sql = this.ctx.storage.sql;

    sql.exec(`DELETE FROM registered_customers WHERE customer_id = ?`, data.customer_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getCustomerCount() {
    const sql = this.ctx.storage.sql;
    const result = sql.exec(`SELECT COUNT(*) as count FROM registered_customers`).toArray()[0];

    return new Response(JSON.stringify({ count: result.count }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Dashboard Methods ==========

  async getDashboardData() {
    const data = await this.getDashboardDataInternal();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getDashboardDataInternal() {
    const sql = this.ctx.storage.sql;

    // Get organization
    const organization = sql.exec(`SELECT * FROM organization WHERE id = 1`).toArray()[0];

    // Get subscription
    const subscription = sql.exec(`SELECT * FROM subscription WHERE id = 1`).toArray()[0];
    const planDetails = this.planTiers[subscription?.plan_tier];

    // Get usage
    const usage = sql.exec(`SELECT * FROM usage WHERE id = 1`).toArray()[0];

    // Get counts
    const teamMembersCount = sql.exec(`SELECT COUNT(*) as count FROM team_members WHERE status = 'active'`).toArray()[0]?.count || 0;
    const pendingInvitationsCount = sql.exec(`SELECT COUNT(*) as count FROM invitations WHERE status = 'pending'`).toArray()[0]?.count || 0;
    const activeApiKeysCount = sql.exec(`SELECT COUNT(*) as count FROM api_keys WHERE status = 'active'`).toArray()[0]?.count || 0;
    const activeWebhooksCount = sql.exec(`SELECT COUNT(*) as count FROM webhooks WHERE status = 'active'`).toArray()[0]?.count || 0;
    const activeIntegrationsCount = sql.exec(`SELECT COUNT(*) as count FROM integrations WHERE status = 'active'`).toArray()[0]?.count || 0;
    const customersCount = sql.exec(`SELECT COUNT(*) as count FROM registered_customers`).toArray()[0]?.count || 0;

    // Get recent audit logs
    const recentAuditLogs = sql.exec(`
      SELECT * FROM audit_log
      ORDER BY created_at DESC
      LIMIT 10
    `).toArray();

    return {
      organization,
      subscription: {
        ...subscription,
        plan_details: planDetails
      },
      usage: {
        ...usage,
        in_memory: this.usageCounters
      },
      counts: {
        team_members: teamMembersCount,
        pending_invitations: pendingInvitationsCount,
        active_api_keys: activeApiKeysCount,
        active_webhooks: activeWebhooksCount,
        active_integrations: activeIntegrationsCount,
        customers: customersCount
      },
      recent_audit_logs: recentAuditLogs,
      timestamp: Date.now()
    };
  }

  async getQuickStats() {
    const sql = this.ctx.storage.sql;

    const subscription = sql.exec(`SELECT plan_tier FROM subscription WHERE id = 1`).toArray()[0];
    const limits = this.planTiers[subscription.plan_tier]?.limits || {};

    const stats = {
      plan_tier: subscription.plan_tier,
      usage: {
        api_calls: {
          current: this.usageCounters.api_calls,
          limit: limits.max_api_calls_per_month,
          percentage: limits.max_api_calls_per_month > 0
            ? Math.round((this.usageCounters.api_calls / limits.max_api_calls_per_month) * 100)
            : 0
        },
        ai_queries: {
          current: this.usageCounters.ai_queries,
          limit: limits.max_ai_queries_per_month,
          percentage: limits.max_ai_queries_per_month > 0
            ? Math.round((this.usageCounters.ai_queries / limits.max_ai_queries_per_month) * 100)
            : 0
        },
        emails: {
          current: this.usageCounters.emails_sent,
          limit: limits.max_emails_per_month,
          percentage: limits.max_emails_per_month > 0
            ? Math.round((this.usageCounters.emails_sent / limits.max_emails_per_month) * 100)
            : 0
        },
        whatsapp: {
          current: this.usageCounters.whatsapp_sent,
          limit: limits.max_whatsapp_per_month,
          percentage: limits.max_whatsapp_per_month > 0
            ? Math.round((this.usageCounters.whatsapp_sent / limits.max_whatsapp_per_month) * 100)
            : 0
        }
      },
      team_members: sql.exec(`SELECT COUNT(*) as count FROM team_members WHERE status = 'active'`).toArray()[0]?.count || 0,
      customers: sql.exec(`SELECT COUNT(*) as count FROM registered_customers`).toArray()[0]?.count || 0,
      timestamp: Date.now()
    };

    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // ========== Export Methods ==========

  async exportData() {
    const sql = this.ctx.storage.sql;

    const data = {
      organization: sql.exec(`SELECT * FROM organization`).toArray(),
      subscription: sql.exec(`SELECT * FROM subscription`).toArray(),
      usage: sql.exec(`SELECT * FROM usage`).toArray(),
      team_members: sql.exec(`SELECT * FROM team_members`).toArray(),
      invitations: sql.exec(`SELECT * FROM invitations`).toArray(),
      api_keys: sql.exec(`SELECT id, name, key_prefix, permissions, created_by, last_used, expires_at, status, created_at FROM api_keys`).toArray(),
      settings: sql.exec(`SELECT * FROM settings`).toArray(),
      feature_flags: sql.exec(`SELECT * FROM feature_flags`).toArray(),
      audit_log: sql.exec(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 1000`).toArray(),
      webhooks: sql.exec(`SELECT id, url, events, status, created_by, last_triggered, created_at, updated_at FROM webhooks`).toArray(),
      integrations: sql.exec(`SELECT id, provider, name, config, status, created_by, last_synced, created_at, updated_at FROM integrations`).toArray(),
      registered_customers: sql.exec(`SELECT * FROM registered_customers`).toArray(),
      export_timestamp: Date.now(),
      tenant_id: this.ctx.id.toString()
    };

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="tenant-export-${this.ctx.id}-${Date.now()}.json"`
      }
    });
  }

  // ========== Helper Methods ==========

  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

// ========== Helper Functions ==========

/**
 * Generate a random string
 */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Hash an API key using SHA-256
 */
async function hashApiKey(apiKey) {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Sign a webhook payload using HMAC-SHA256
 */
async function signWebhookPayload(payload, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const data = encoder.encode(JSON.stringify(payload));
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureArray = Array.from(new Uint8Array(signature));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple hash function for consistent user bucketing
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Convert camelCase to snake_case
 */
function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

