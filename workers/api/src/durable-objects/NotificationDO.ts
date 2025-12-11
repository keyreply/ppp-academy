import { DurableObject } from "cloudflare:workers";

/**
 * NotificationDO - Per-user notification management Durable Object
 *
 * Features:
 * - User notification preferences
 * - Notification queue and delivery
 * - Real-time WebSocket push
 * - Delivery tracking and logging
 * - Email integration
 */
export class NotificationDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;

    // In-memory state
    this.isOnline = false;
    this.lastSeen = Date.now();
    this.pendingNotifications = [];
    this.websockets = new Set();

    // Initialize database
    this.initDatabase();
  }

  /**
   * Initialize SQLite database schema
   */
  async initDatabase() {
    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS preferences (
        user_id TEXT PRIMARY KEY,
        email_enabled INTEGER DEFAULT 1,
        push_enabled INTEGER DEFAULT 1,
        sms_enabled INTEGER DEFAULT 0,
        quiet_hours_start TEXT,
        quiet_hours_end TEXT,
        digest_frequency TEXT DEFAULT 'realtime',
        channels TEXT DEFAULT '[]',
        updated_at INTEGER DEFAULT (unixepoch())
      )
    `);

    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        data TEXT DEFAULT '{}',
        priority TEXT DEFAULT 'normal',
        channel TEXT DEFAULT 'general',
        status TEXT DEFAULT 'pending',
        delivered_at INTEGER,
        read_at INTEGER,
        expires_at INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (user_id) REFERENCES preferences(user_id)
      )
    `);

    await this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS delivery_log (
        id TEXT PRIMARY KEY,
        notification_id TEXT NOT NULL,
        method TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        delivered_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (notification_id) REFERENCES notifications(id)
      )
    `);

    // Create indexes
    await this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_status
      ON notifications(user_id, status)
    `);

    await this.ctx.storage.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_notifications_created
      ON notifications(created_at DESC)
    `);
  }

  /**
   * Handle incoming fetch requests
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade for real-time notifications
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    try {
      if (path === '/send' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.send(body);
        return Response.json(result);
      }

      if (path === '/preferences' && request.method === 'GET') {
        const userId = url.searchParams.get('userId');
        const prefs = await this.getPreferences(userId);
        return Response.json(prefs);
      }

      if (path === '/preferences' && request.method === 'PUT') {
        const body = await request.json();
        const result = await this.updatePreferences(body);
        return Response.json(result);
      }

      if (path === '/unread' && request.method === 'GET') {
        const userId = url.searchParams.get('userId');
        const notifications = await this.getUnread(userId);
        return Response.json(notifications);
      }

      if (path === '/notifications' && request.method === 'GET') {
        const userId = url.searchParams.get('userId');
        const limit = parseInt(url.searchParams.get('limit')) || 50;
        const offset = parseInt(url.searchParams.get('offset')) || 0;
        const notifications = await this.getNotifications(userId, limit, offset);
        return Response.json(notifications);
      }

      if (path === '/mark-read' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.markAsRead(body);
        return Response.json(result);
      }

      if (path === '/delete' && request.method === 'DELETE') {
        const notificationId = url.searchParams.get('id');
        const result = await this.deleteNotification(notificationId);
        return Response.json(result);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('NotificationDO error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  /**
   * Handle WebSocket connections for real-time notifications
   */
  handleWebSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.ctx.acceptWebSocket(server);
    this.websockets.add(server);
    this.isOnline = true;
    this.lastSeen = Date.now();

    server.addEventListener('close', () => {
      this.websockets.delete(server);
      if (this.websockets.size === 0) {
        this.isOnline = false;
      }
    });

    server.addEventListener('error', () => {
      this.websockets.delete(server);
      if (this.websockets.size === 0) {
        this.isOnline = false;
      }
    });

    // Send any pending notifications
    if (this.pendingNotifications.length > 0) {
      server.send(JSON.stringify({
        type: 'pending',
        notifications: this.pendingNotifications
      }));
      this.pendingNotifications = [];
    }

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  /**
   * Send a notification
   * @param {Object} notification
   * @returns {Object} { id, delivered, methods: [] }
   */
  async send(notification) {
    const {
      userId,
      type,
      title,
      body,
      data = {},
      priority = 'normal',
      channel = 'general',
      expiresIn = null
    } = notification;

    // Generate notification ID
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = expiresIn ? now + expiresIn : null;

    // Insert notification
    await this.ctx.storage.sql.exec(
      `INSERT INTO notifications
       (id, user_id, type, title, body, data, priority, channel, status, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      id, userId, type, title, body, JSON.stringify(data), priority, channel, expiresAt, now
    );

    // Get user preferences
    const prefs = await this.getPreferences(userId);

    // Check if in quiet hours
    const inQuietHours = this.isInQuietHours(prefs);

    const deliveryMethods = [];

    // Deliver real-time if user is online and push enabled
    if (this.isOnline && prefs.push_enabled && !inQuietHours) {
      const delivered = await this.deliverRealtime({
        id, userId, type, title, body, data, priority, channel
      });
      if (delivered) {
        deliveryMethods.push({ method: 'realtime', status: 'success' });
      }
    } else {
      // Queue for later delivery
      this.pendingNotifications.push({
        id, userId, type, title, body, data, priority, channel
      });
    }

    // Send email if enabled and appropriate
    if (prefs.email_enabled && this.shouldSendEmail(priority, prefs, inQuietHours)) {
      const emailResult = await this.sendEmail({
        userId, type, title, body, data
      });
      deliveryMethods.push(emailResult);
    }

    // Update notification status
    if (deliveryMethods.some(m => m.status === 'success')) {
      await this.ctx.storage.sql.exec(
        `UPDATE notifications SET status = 'delivered', delivered_at = ? WHERE id = ?`,
        now, id
      );
    }

    return {
      id,
      delivered: deliveryMethods.length > 0,
      methods: deliveryMethods,
      queued: !this.isOnline
    };
  }

  /**
   * Deliver notification in real-time via WebSocket
   */
  async deliverRealtime(notification) {
    if (this.websockets.size === 0) {
      return false;
    }

    const message = JSON.stringify({
      type: 'notification',
      notification
    });

    let delivered = false;
    for (const ws of this.websockets) {
      try {
        ws.send(message);
        delivered = true;
      } catch (error) {
        console.error('WebSocket send error:', error);
        this.websockets.delete(ws);
      }
    }

    // Log delivery
    if (delivered) {
      await this.ctx.storage.sql.exec(
        `INSERT INTO delivery_log (id, notification_id, method, status)
         VALUES (?, ?, 'realtime', 'success')`,
        crypto.randomUUID(), notification.id
      );
    }

    return delivered;
  }

  /**
   * Send email notification
   */
  async sendEmail({ userId, type, title, body, data }) {
    try {
      // Integration with email service (e.g., SendGrid, Resend)
      // This is a placeholder - implement actual email sending

      // Example with Resend API
      if (this.env.RESEND_API_KEY) {
        // Actual implementation would go here
        console.log(`Would send email to user ${userId}: ${title}`);
      }

      return { method: 'email', status: 'success' };
    } catch (error) {
      console.error('Email send error:', error);
      return { method: 'email', status: 'failed', error: error.message };
    }
  }

  /**
   * Get user preferences
   */
  async getPreferences(userId) {
    const result = await this.ctx.storage.sql.exec(
      `SELECT * FROM preferences WHERE user_id = ?`,
      userId
    );

    if (result.rows.length === 0) {
      // Create default preferences
      await this.ctx.storage.sql.exec(
        `INSERT INTO preferences (user_id) VALUES (?)`,
        userId
      );
      return {
        user_id: userId,
        email_enabled: 1,
        push_enabled: 1,
        sms_enabled: 0,
        quiet_hours_start: null,
        quiet_hours_end: null,
        digest_frequency: 'realtime',
        channels: []
      };
    }

    const row = result.rows[0];
    return {
      ...row,
      channels: JSON.parse(row.channels || '[]')
    };
  }

  /**
   * Update user preferences
   */
  async updatePreferences({ userId, ...prefs }) {
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(prefs)) {
      if (key === 'channels') {
        updates.push(`${key} = ?`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    updates.push('updated_at = ?');
    values.push(Math.floor(Date.now() / 1000));
    values.push(userId);

    await this.ctx.storage.sql.exec(
      `UPDATE preferences SET ${updates.join(', ')} WHERE user_id = ?`,
      ...values
    );

    return { success: true, userId };
  }

  /**
   * Get unread notifications
   */
  async getUnread(userId) {
    const result = await this.ctx.storage.sql.exec(
      `SELECT * FROM notifications
       WHERE user_id = ? AND read_at IS NULL
       ORDER BY created_at DESC`,
      userId
    );

    return result.rows.map(row => ({
      ...row,
      data: JSON.parse(row.data || '{}')
    }));
  }

  /**
   * Get notifications with pagination
   */
  async getNotifications(userId, limit = 50, offset = 0) {
    const result = await this.ctx.storage.sql.exec(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      userId, limit, offset
    );

    const countResult = await this.ctx.storage.sql.exec(
      `SELECT COUNT(*) as total FROM notifications WHERE user_id = ?`,
      userId
    );

    return {
      notifications: result.rows.map(row => ({
        ...row,
        data: JSON.parse(row.data || '{}')
      })),
      total: countResult.rows[0].total,
      limit,
      offset
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead({ notificationId, userId }) {
    const now = Math.floor(Date.now() / 1000);

    await this.ctx.storage.sql.exec(
      `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?`,
      now, notificationId, userId
    );

    return { success: true, notificationId };
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId) {
    await this.ctx.storage.sql.exec(
      `DELETE FROM notifications WHERE id = ?`,
      notificationId
    );

    return { success: true, notificationId };
  }

  /**
   * Check if current time is in quiet hours
   */
  isInQuietHours(prefs) {
    if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number);
    const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);
    const startTime = startHour * 60 + startMinute;
    const endTime = endHour * 60 + endMinute;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime < endTime;
    } else {
      // Quiet hours span midnight
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  /**
   * Determine if email should be sent based on priority and preferences
   */
  shouldSendEmail(priority, prefs, inQuietHours) {
    // Always send high priority
    if (priority === 'high' || priority === 'urgent') {
      return true;
    }

    // Don't send during quiet hours unless high priority
    if (inQuietHours) {
      return false;
    }

    // Check digest frequency
    if (prefs.digest_frequency === 'never') {
      return false;
    }

    if (prefs.digest_frequency === 'realtime') {
      return true;
    }

    // For digest modes, we'd need a separate alarm-based system
    return false;
  }
}
