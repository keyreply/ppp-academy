/**
 * Conversation Management Routes
 * Handles conversations, messages, and real-time communication
 */

import { Hono } from 'hono';
import { authMiddleware, requirePermission, getTenantId, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function to get ConversationDO stub
 */
function getConversationStub(env, conversationId) {
  return env.CONVERSATION.get(env.CONVERSATION.idFromName(conversationId));
}

/**
 * GET /conversations/:conversationId
 * Get conversation details
 */
app.get('/conversations/:conversationId', async (c) => {
  const conversationId = c.req.param('conversationId');
  const tenantId = getTenantId(c);

  const conversationStub = getConversationStub(c.env, conversationId);

  const response = await conversationStub.fetch('http://internal/details', {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /conversations/:conversationId/messages
 * Get conversation messages
 */
app.get('/conversations/:conversationId/messages', async (c) => {
  const conversationId = c.req.param('conversationId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const conversationStub = getConversationStub(c.env, conversationId);

  const response = await conversationStub.fetch('http://internal/messages?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /conversations/:conversationId/messages
 * Send message in conversation
 */
app.post('/conversations/:conversationId/messages', requirePermission('messages.send'), async (c) => {
  const conversationId = c.req.param('conversationId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const conversationStub = getConversationStub(c.env, conversationId);

  const response = await conversationStub.fetch('http://internal/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, sentBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PATCH /conversations/:conversationId
 * Update conversation (status, assignee, etc.)
 */
app.patch('/conversations/:conversationId', requirePermission('conversations.manage'), async (c) => {
  const conversationId = c.req.param('conversationId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const conversationStub = getConversationStub(c.env, conversationId);

  const response = await conversationStub.fetch('http://internal/details', {
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
 * POST /conversations/:conversationId/typing
 * Send typing indicator
 */
app.post('/conversations/:conversationId/typing', async (c) => {
  const conversationId = c.req.param('conversationId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);

  const conversationStub = getConversationStub(c.env, conversationId);

  const response = await conversationStub.fetch('http://internal/typing', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /conversations/:conversationId/ws
 * WebSocket endpoint for real-time conversation updates
 */
app.get('/conversations/:conversationId/ws', async (c) => {
  const conversationId = c.req.param('conversationId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);

  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected Upgrade: websocket' }, 426);
  }

  const conversationStub = getConversationStub(c.env, conversationId);

  // Forward WebSocket connection to ConversationDO
  return conversationStub.fetch('http://internal/ws', {
    headers: {
      'Upgrade': 'websocket',
      'X-Tenant-Id': tenantId,
      'X-User-Id': userId
    }
  });
});

export default app;
