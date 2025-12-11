/**
 * Notification Routes
 * Handles user notifications, preferences, and delivery
 */

import { Hono } from 'hono';
import { authMiddleware, requirePermission, getTenantId, getUserId } from '../middleware/auth.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * Helper function to get NotificationDO stub
 */
function getNotificationStub(env, userId) {
  return env.NOTIFICATION.get(env.NOTIFICATION.idFromName(userId));
}

/**
 * GET /notifications
 * Get user notifications
 */
app.get('/notifications', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);
  const query = c.req.query();

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch('http://internal/list?' + new URLSearchParams(query), {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /notifications/unread
 * Get unread notification count
 */
app.get('/notifications/unread', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch('http://internal/unread', {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /notifications/:notificationId/read
 * Mark notification as read
 */
app.post('/notifications/:notificationId/read', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);
  const notificationId = c.req.param('notificationId');

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch(`http://internal/${notificationId}/read`, {
    method: 'POST',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * POST /notifications/read-all
 * Mark all notifications as read
 */
app.post('/notifications/read-all', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch('http://internal/read-all', {
    method: 'POST',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * DELETE /notifications/:notificationId
 * Delete notification
 */
app.delete('/notifications/:notificationId', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);
  const notificationId = c.req.param('notificationId');

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch(`http://internal/${notificationId}`, {
    method: 'DELETE',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /notifications/preferences
 * Get notification preferences
 */
app.get('/notifications/preferences', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch('http://internal/preferences', {
    method: 'GET',
    headers: {
      'X-Tenant-Id': tenantId
    }
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * PUT /notifications/preferences
 * Update notification preferences
 */
app.put('/notifications/preferences', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);
  const body = await c.req.json();

  const notificationStub = getNotificationStub(c.env, userId);

  const response = await notificationStub.fetch('http://internal/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenant-Id': tenantId
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();
  return c.json(data, response.status);
});

/**
 * GET /notifications/ws
 * WebSocket endpoint for real-time notifications
 */
app.get('/notifications/ws', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c);

  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return c.json({ error: 'Expected Upgrade: websocket' }, 426);
  }

  const notificationStub = getNotificationStub(c.env, userId);

  // Forward WebSocket connection to NotificationDO
  return notificationStub.fetch('http://internal/ws', {
    headers: {
      'Upgrade': 'websocket',
      'X-Tenant-Id': tenantId
    }
  });
});

export default app;
