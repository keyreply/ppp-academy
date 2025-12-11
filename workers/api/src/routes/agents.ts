/**
 * AI Agent Routes
 * Handles AI agent configuration, execution, and management
 */

import { Hono } from 'hono';
import { authMiddleware, requirePermission, getTenantId, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function to get AgentDO stub
 */
function getAgentStub(env, agentId) {
  return env.AGENT.get(env.AGENT.idFromName(agentId));
}

/**
 * GET /agents/:agentId
 * Get agent details
 */
app.get('/agents/:agentId', async (c) => {
  const agentId = c.req.param('agentId');
  const tenantId = getTenantId(c);

  const agentStub = getAgentStub(c.env, agentId);

  const response = await agentStub.fetch('http://internal/details', {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PATCH /agents/:agentId
 * Update agent configuration
 */
app.patch('/agents/:agentId', requirePermission('agents.manage'), async (c) => {
  const agentId = c.req.param('agentId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const agentStub = getAgentStub(c.env, agentId);

  const response = await agentStub.fetch('http://internal/details', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, updatedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /agents/:agentId/execute
 * Execute agent with input
 */
app.post('/agents/:agentId/execute', requirePermission('agents.execute'), async (c) => {
  const agentId = c.req.param('agentId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const agentStub = getAgentStub(c.env, agentId);

  const response = await agentStub.fetch('http://internal/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, executedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /agents/:agentId/history
 * Get agent execution history
 */
app.get('/agents/:agentId/history', async (c) => {
  const agentId = c.req.param('agentId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const agentStub = getAgentStub(c.env, agentId);

  const response = await agentStub.fetch('http://internal/history?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /agents/:agentId/stats
 * Get agent statistics
 */
app.get('/agents/:agentId/stats', async (c) => {
  const agentId = c.req.param('agentId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const agentStub = getAgentStub(c.env, agentId);

  const response = await agentStub.fetch('http://internal/stats?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

export default app;
