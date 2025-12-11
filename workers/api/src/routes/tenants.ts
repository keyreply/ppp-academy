/**
 * Tenant Management Routes
 * Handles organization settings, members, API keys, webhooks, and more
 */

import { Hono } from 'hono';
import { authMiddleware, requirePermission, getTenantId, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function to get TenantDO stub
 */
function getTenantStub(env, tenantId) {
  return env.TENANT.get(env.TENANT.idFromName(tenantId));
}

/**
 * GET /organization
 * Get organization details
 */
app.get('/organization', async (c) => {
  const tenantId = getTenantId(c);
  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/organization', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PATCH /organization
 * Update organization details
 */
app.patch('/organization', requirePermission('organization.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/organization', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /subscription
 * Get subscription details
 */
app.get('/subscription', async (c) => {
  const tenantId = getTenantId(c);
  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/subscription', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /usage
 * Get usage statistics
 */
app.get('/usage', async (c) => {
  const tenantId = getTenantId(c);
  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/usage', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /quota/:metric
 * Get quota status for specific metric
 */
app.get('/quota/:metric', async (c) => {
  const tenantId = getTenantId(c);
  const metric = c.req.param('metric');

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/quota/${metric}`, {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /members
 * List organization members
 */
app.get('/members', async (c) => {
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/members?' + new URLSearchParams(query), {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /members/invite
 * Invite new member to organization
 */
app.post('/members/invite', requirePermission('members.invite'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/members/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, invitedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PATCH /members/:memberId
 * Update member details (role, permissions)
 */
app.patch('/members/:memberId', requirePermission('members.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const memberId = c.req.param('memberId');
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/members/${memberId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, updatedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * DELETE /members/:memberId
 * Remove member from organization
 */
app.delete('/members/:memberId', requirePermission('members.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const memberId = c.req.param('memberId');
  const userId = getUserId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/members/${memberId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /invitations
 * List pending invitations
 */
app.get('/invitations', requirePermission('members.invite'), async (c) => {
  const tenantId = getTenantId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/invitations', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /api-keys
 * List API keys
 */
app.get('/api-keys', requirePermission('api_keys.view'), async (c) => {
  const tenantId = getTenantId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/api-keys', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /api-keys
 * Create new API key
 */
app.post('/api-keys', requirePermission('api_keys.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/api-keys', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, createdBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * DELETE /api-keys/:keyId
 * Revoke API key
 */
app.delete('/api-keys/:keyId', requirePermission('api_keys.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const keyId = c.req.param('keyId');
  const userId = getUserId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/api-keys/${keyId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ revokedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /settings
 * Get all organization settings
 */
app.get('/settings', async (c) => {
  const tenantId = getTenantId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/settings', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PUT /settings
 * Update organization settings
 */
app.put('/settings', requirePermission('settings.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, updatedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /settings/:key
 * Get specific setting
 */
app.get('/settings/:key', async (c) => {
  const tenantId = getTenantId(c);
  const key = c.req.param('key');

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/settings/${key}`, {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PUT /settings/:key
 * Update specific setting
 */
app.put('/settings/:key', requirePermission('settings.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const key = c.req.param('key');
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/settings/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, updatedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /features
 * Get enabled features
 */
app.get('/features', async (c) => {
  const tenantId = getTenantId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/features', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /features/:key
 * Check if specific feature is enabled
 */
app.get('/features/:key', async (c) => {
  const tenantId = getTenantId(c);
  const key = c.req.param('key');

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/features/${key}`, {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /webhooks
 * List webhooks
 */
app.get('/webhooks', requirePermission('webhooks.view'), async (c) => {
  const tenantId = getTenantId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/webhooks', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /webhooks
 * Create webhook
 */
app.post('/webhooks', requirePermission('webhooks.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/webhooks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, createdBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * DELETE /webhooks/:webhookId
 * Delete webhook
 */
app.delete('/webhooks/:webhookId', requirePermission('webhooks.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const webhookId = c.req.param('webhookId');
  const userId = getUserId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch(`http://internal/webhooks/${webhookId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /integrations
 * List integrations
 */
app.get('/integrations', async (c) => {
  const tenantId = getTenantId(c);

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/integrations', {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /integrations
 * Create/configure integration
 */
app.post('/integrations', requirePermission('integrations.manage'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/integrations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, createdBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /audit-log
 * Get audit log entries
 */
app.get('/audit-log', requirePermission('audit_log.view'), async (c) => {
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/audit-log?' + new URLSearchParams(query), {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /dashboard
 * Get dashboard statistics
 */
app.get('/dashboard', async (c) => {
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/dashboard?' + new URLSearchParams(query), {
    method: 'GET'
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /export
 * Export organization data
 */
app.get('/export', requirePermission('data.export'), async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const query = c.req.query();

  const tenantStub = getTenantStub(c.env, tenantId);

  const response = await tenantStub.fetch('http://internal/export?' + new URLSearchParams(query), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /ws
 * WebSocket endpoint for real-time updates
 */
app.get('/ws', async (c) => {
  const tenantId = getTenantId(c);
  const userId = getUserId(c);

  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected Upgrade: websocket' }, 426);
  }

  const tenantStub = getTenantStub(c.env, tenantId);

  // Forward WebSocket connection to TenantDO
  return tenantStub.fetch('http://internal/ws', {
    headers: {
      'Upgrade': 'websocket',
      'X-User-Id': userId
    }
  });
});

export default app;
