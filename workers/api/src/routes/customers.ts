/**
 * Customer Management Routes
 * Handles customer profiles, timeline, messages, calls, contacts, notes, and tasks
 */

import { Hono } from 'hono';
import { authMiddleware, requirePermission, getTenantId, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function to get CustomerDO stub
 */
function getCustomerStub(env, customerId) {
  return env.CUSTOMER.get(env.CUSTOMER.idFromName(customerId));
}

/**
 * GET /customers/:customerId
 * Get customer profile
 */
app.get('/customers/:customerId', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/profile', {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PATCH /customers/:customerId
 * Update customer profile
 */
app.patch('/customers/:customerId', requirePermission('customers.manage'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/profile', {
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
 * GET /customers/:customerId/timeline
 * Get customer activity timeline
 */
app.get('/customers/:customerId/timeline', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/timeline?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /customers/:customerId/messages
 * Get customer messages
 */
app.get('/customers/:customerId/messages', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/messages?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /customers/:customerId/messages
 * Send message to customer
 */
app.post('/customers/:customerId/messages', requirePermission('messages.send'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/messages', {
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
 * GET /customers/:customerId/calls
 * Get customer call history
 */
app.get('/customers/:customerId/calls', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/calls?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /customers/:customerId/calls
 * Log a call with customer
 */
app.post('/customers/:customerId/calls', requirePermission('calls.log'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/calls', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, loggedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /customers/:customerId/contacts
 * Get customer contacts
 */
app.get('/customers/:customerId/contacts', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/contacts', {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /customers/:customerId/contacts
 * Add customer contact
 */
app.post('/customers/:customerId/contacts', requirePermission('customers.manage'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/contacts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, createdBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /customers/:customerId/notes
 * Get customer notes
 */
app.get('/customers/:customerId/notes', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/notes?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /customers/:customerId/notes
 * Add customer note
 */
app.post('/customers/:customerId/notes', requirePermission('notes.create'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/notes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, createdBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /customers/:customerId/tasks
 * Get customer tasks
 */
app.get('/customers/:customerId/tasks', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/tasks?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /customers/:customerId/tasks
 * Create customer task
 */
app.post('/customers/:customerId/tasks', requirePermission('tasks.create'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ ...body, createdBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PATCH /customers/:customerId/tasks/:taskId
 * Update customer task
 */
app.patch('/customers/:customerId/tasks/:taskId', requirePermission('tasks.manage'), async (c) => {
  const customerId = c.req.param('customerId');
  const taskId = c.req.param('taskId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const body = await c.req.json();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch(`http://internal/tasks/${taskId}`, {
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
 * GET /customers/:customerId/stats
 * Get customer statistics
 */
app.get('/customers/:customerId/stats', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/stats?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /customers/:customerId/context
 * Get AI context for customer (for AI agents)
 */
app.get('/customers/:customerId/context', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/context?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /customers/:customerId/ws
 * WebSocket endpoint for real-time customer updates
 */
app.get('/customers/:customerId/ws', async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);

  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected Upgrade: websocket' }, 426);
  }

  const customerStub = getCustomerStub(c.env, customerId);

  // Forward WebSocket connection to CustomerDO
  return customerStub.fetch('http://internal/ws', {
    headers: {
      'Upgrade': 'websocket',
      'X-Tenant-Id': tenantId,
      'X-User-Id': userId
    }
  });
});

/**
 * GET /customers/:customerId/export
 * Export customer data
 */
app.get('/customers/:customerId/export', requirePermission('data.export'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);
  const query = c.req.query();

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/export?' + new URLSearchParams(query), {
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
 * DELETE /customers/:customerId
 * Delete customer and all associated data
 */
app.delete('/customers/:customerId', requirePermission('customers.delete'), async (c) => {
  const customerId = c.req.param('customerId');
  const tenantId = getTenantId(c);
  const userId = getUserId(c);

  const customerStub = getCustomerStub(c.env, customerId);

  const response = await customerStub.fetch('http://internal/profile', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify({ deletedBy: userId })
  });

  const data = await response.json();
  return c.json(data, response.status);
});

export default app;
