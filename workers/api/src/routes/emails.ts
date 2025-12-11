/**
 * Email Routes
 * Admin and internal endpoints for email management
 */

import { Hono } from 'hono';
import { authMiddleware, requirePermission, getTenantId, getUserId } from '../middleware/auth.js';
import { sendEmail, sendBatchEmails } from '../services/email.js';

const app = new Hono();

// Apply auth middleware to all routes
app.use('*', authMiddleware);

/**
 * POST /emails/send
 * Send a custom email (admin only)
 *
 * Body:
 * {
 *   "to": "user@example.com" | ["user1@example.com", "user2@example.com"],
 *   "subject": "Email subject",
 *   "html": "<p>HTML content</p>",
 *   "text": "Plain text content (optional)",
 *   "from": "Custom Name <custom@domain.com> (optional)",
 *   "replyTo": "reply@domain.com (optional)",
 *   "tags": ["tag1", "tag2"] (optional)
 * }
 */
app.post('/send', requirePermission('emails:send'), async (c) => {
  try {
    const tenantId = getTenantId(c);
    const body = await c.req.json();

    // Validate required fields
    if (!body.to || !body.subject || !body.html) {
      return c.json({
        error: 'Bad Request',
        message: 'Missing required fields: to, subject, html'
      }, 400);
    }

    // Send email
    const result = await sendEmail(c.env, {
      to: body.to,
      subject: body.subject,
      html: body.html,
      text: body.text,
      from: body.from,
      replyTo: body.replyTo,
      tags: body.tags || ['custom', 'admin-sent']
    });

    // Log the email
    const { logEmailSent } = await import('../services/email.js');
    await logEmailSent(c.env, tenantId, {
      to: Array.isArray(body.to) ? body.to.join(', ') : body.to,
      subject: body.subject,
      template: 'custom',
      resendId: result.id,
      metadata: {
        sentBy: getUserId(c),
        tags: body.tags
      }
    });

    return c.json({
      success: true,
      message: 'Email sent successfully',
      emailId: result.id
    });
  } catch (error) {
    console.error('Email send error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to send email'
    }, 500);
  }
});

/**
 * POST /emails/batch
 * Send batch emails (admin only)
 *
 * Body:
 * {
 *   "emails": [
 *     {
 *       "to": "user@example.com",
 *       "subject": "Email subject",
 *       "html": "<p>HTML content</p>",
 *       "tags": ["tag1"]
 *     },
 *     ...
 *   ]
 * }
 */
app.post('/batch', requirePermission('emails:send'), async (c) => {
  try {
    const tenantId = getTenantId(c);
    const body = await c.req.json();

    if (!body.emails || !Array.isArray(body.emails) || body.emails.length === 0) {
      return c.json({
        error: 'Bad Request',
        message: 'emails array is required and must not be empty'
      }, 400);
    }

    // Validate each email
    for (const email of body.emails) {
      if (!email.to || !email.subject || !email.html) {
        return c.json({
          error: 'Bad Request',
          message: 'Each email must have: to, subject, html'
        }, 400);
      }
    }

    // Send batch
    const result = await sendBatchEmails(c.env, body.emails);

    // Log each email
    const { logEmailSent } = await import('../services/email.js');
    for (let i = 0; i < body.emails.length; i++) {
      const email = body.emails[i];
      const resendData = result.results[i];

      await logEmailSent(c.env, tenantId, {
        to: email.to,
        subject: email.subject,
        template: 'batch',
        resendId: resendData?.id,
        metadata: {
          sentBy: getUserId(c),
          batchIndex: i
        }
      });
    }

    return c.json({
      success: true,
      message: `${result.results.length} emails sent successfully`,
      results: result.results
    });
  } catch (error) {
    console.error('Batch email send error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to send batch emails'
    }, 500);
  }
});

/**
 * GET /emails/logs
 * Get email logs for tenant
 *
 * Query params:
 * - limit: number of records (default: 50, max: 200)
 * - offset: pagination offset (default: 0)
 * - status: filter by status (sent, failed, bounced)
 * - template: filter by template name
 * - search: search in to_address or subject
 */
app.get('/logs', async (c) => {
  try {
    const tenantId = getTenantId(c);
    const query = c.req.query();

    const limit = Math.min(parseInt(query.limit) || 50, 200);
    const offset = parseInt(query.offset) || 0;
    const status = query.status;
    const template = query.template;
    const search = query.search;

    // Build query
    let sql = `
      SELECT id, to_address, from_address, subject, template, status,
             resend_id, opened_at, clicked_at, bounced_at, created_at
      FROM email_logs
      WHERE tenant_id = ?
    `;
    const params = [tenantId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (template) {
      sql += ' AND template = ?';
      params.push(template);
    }

    if (search) {
      sql += ' AND (to_address LIKE ? OR subject LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Get logs
    const results = await c.env.DB.prepare(sql)
      .bind(...params)
      .all();

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM email_logs WHERE tenant_id = ?';
    const countParams = [tenantId];

    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    if (template) {
      countSql += ' AND template = ?';
      countParams.push(template);
    }

    if (search) {
      countSql += ' AND (to_address LIKE ? OR subject LIKE ?)';
      countParams.push(`%${search}%`, `%${search}%`);
    }

    const countResult = await c.env.DB.prepare(countSql)
      .bind(...countParams)
      .first();

    return c.json({
      logs: results.results || [],
      pagination: {
        total: countResult.total,
        limit,
        offset,
        hasMore: offset + limit < countResult.total
      }
    });
  } catch (error) {
    console.error('Email logs fetch error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to fetch email logs'
    }, 500);
  }
});

/**
 * GET /emails/logs/:emailId
 * Get single email log details
 */
app.get('/logs/:emailId', async (c) => {
  try {
    const tenantId = getTenantId(c);
    const emailId = c.req.param('emailId');

    const log = await c.env.DB.prepare(
      `SELECT * FROM email_logs
       WHERE id = ? AND tenant_id = ?`
    )
    .bind(emailId, tenantId)
    .first();

    if (!log) {
      return c.json({
        error: 'Not Found',
        message: 'Email log not found'
      }, 404);
    }

    // Parse metadata
    if (log.metadata) {
      try {
        log.metadata = JSON.parse(log.metadata);
      } catch (e) {
        log.metadata = {};
      }
    }

    return c.json({ log });
  } catch (error) {
    console.error('Email log fetch error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to fetch email log'
    }, 500);
  }
});

/**
 * GET /emails/stats
 * Get email statistics for tenant
 *
 * Query params:
 * - period: time period (7d, 30d, 90d, all) default: 30d
 */
app.get('/stats', async (c) => {
  try {
    const tenantId = getTenantId(c);
    const period = c.req.query('period') || '30d';

    // Calculate date filter
    let dateFilter = '';
    if (period !== 'all') {
      const days = parseInt(period);
      dateFilter = `AND created_at >= datetime('now', '-${days} days')`;
    }

    // Get total sent
    const totalSent = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM email_logs
       WHERE tenant_id = ? AND status = 'sent' ${dateFilter}`
    )
    .bind(tenantId)
    .first();

    // Get total failed
    const totalFailed = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM email_logs
       WHERE tenant_id = ? AND status = 'failed' ${dateFilter}`
    )
    .bind(tenantId)
    .first();

    // Get total bounced
    const totalBounced = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM email_logs
       WHERE tenant_id = ? AND bounced_at IS NOT NULL ${dateFilter}`
    )
    .bind(tenantId)
    .first();

    // Get total opened
    const totalOpened = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM email_logs
       WHERE tenant_id = ? AND opened_at IS NOT NULL ${dateFilter}`
    )
    .bind(tenantId)
    .first();

    // Get total clicked
    const totalClicked = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM email_logs
       WHERE tenant_id = ? AND clicked_at IS NOT NULL ${dateFilter}`
    )
    .bind(tenantId)
    .first();

    // Get by template
    const byTemplate = await c.env.DB.prepare(
      `SELECT template, COUNT(*) as count
       FROM email_logs
       WHERE tenant_id = ? ${dateFilter}
       GROUP BY template
       ORDER BY count DESC`
    )
    .bind(tenantId)
    .all();

    // Get recent activity (last 7 days by day)
    const recentActivity = await c.env.DB.prepare(
      `SELECT DATE(created_at) as date, COUNT(*) as count
       FROM email_logs
       WHERE tenant_id = ? AND created_at >= datetime('now', '-7 days')
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    )
    .bind(tenantId)
    .all();

    // Calculate rates
    const total = totalSent.count + totalFailed.count;
    const openRate = total > 0 ? (totalOpened.count / total * 100).toFixed(2) : 0;
    const clickRate = total > 0 ? (totalClicked.count / total * 100).toFixed(2) : 0;
    const bounceRate = total > 0 ? (totalBounced.count / total * 100).toFixed(2) : 0;

    return c.json({
      stats: {
        total: total,
        sent: totalSent.count,
        failed: totalFailed.count,
        bounced: totalBounced.count,
        opened: totalOpened.count,
        clicked: totalClicked.count,
        openRate: parseFloat(openRate),
        clickRate: parseFloat(clickRate),
        bounceRate: parseFloat(bounceRate)
      },
      byTemplate: byTemplate.results || [],
      recentActivity: recentActivity.results || [],
      period
    });
  } catch (error) {
    console.error('Email stats fetch error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to fetch email statistics'
    }, 500);
  }
});

/**
 * POST /emails/test
 * Send a test email to verify configuration (admin only)
 */
app.post('/test', requirePermission('emails:send'), async (c) => {
  try {
    const body = await c.req.json();
    const userEmail = body.to || c.get('user')?.email;

    if (!userEmail) {
      return c.json({
        error: 'Bad Request',
        message: 'Email address required'
      }, 400);
    }

    // Send test email
    const result = await sendEmail(c.env, {
      to: userEmail,
      subject: 'Test Email - PPP Academy',
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from PPP Academy.</p>
        <p>If you received this, your email configuration is working correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      tags: ['test']
    });

    return c.json({
      success: true,
      message: 'Test email sent successfully',
      emailId: result.id,
      sentTo: userEmail
    });
  } catch (error) {
    console.error('Test email error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to send test email'
    }, 500);
  }
});

/**
 * GET /emails/templates
 * List available email templates
 */
app.get('/templates', async (c) => {
  return c.json({
    templates: [
      {
        name: 'welcome',
        description: 'Welcome email for new users',
        variables: ['name', 'tenantName']
      },
      {
        name: 'password-reset',
        description: 'Password reset email with secure link',
        variables: ['name', 'resetLink', 'expiresIn']
      },
      {
        name: 'invitation',
        description: 'Team invitation email',
        variables: ['inviterName', 'tenantName', 'inviteLink', 'role']
      },
      {
        name: 'document-processed',
        description: 'Document processing completion notification',
        variables: ['name', 'documentName', 'status']
      },
      {
        name: 'notification-digest',
        description: 'Daily or weekly notification digest',
        variables: ['name', 'notifications', 'period']
      }
    ]
  });
});

/**
 * POST /emails/preview
 * Preview email template with data (admin only)
 */
app.post('/preview', requirePermission('emails:send'), async (c) => {
  try {
    const body = await c.req.json();
    const { template, data } = body;

    if (!template) {
      return c.json({
        error: 'Bad Request',
        message: 'template name is required'
      }, 400);
    }

    // Get template HTML
    const { getEmailTemplate } = await import('../services/email.js');
    const html = getEmailTemplate(template, data || {});

    return c.json({
      success: true,
      template,
      html
    });
  } catch (error) {
    console.error('Email preview error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: error.message || 'Failed to generate preview'
    }, 500);
  }
});

/**
 * DELETE /emails/logs/:emailId
 * Delete email log (admin only)
 */
app.delete('/logs/:emailId', requirePermission('emails:send'), async (c) => {
  try {
    const tenantId = getTenantId(c);
    const emailId = c.req.param('emailId');

    const result = await c.env.DB.prepare(
      'DELETE FROM email_logs WHERE id = ? AND tenant_id = ?'
    )
    .bind(emailId, tenantId)
    .run();

    if (result.meta.changes === 0) {
      return c.json({
        error: 'Not Found',
        message: 'Email log not found'
      }, 404);
    }

    return c.json({
      success: true,
      message: 'Email log deleted'
    });
  } catch (error) {
    console.error('Email log delete error:', error);
    return c.json({
      error: 'Internal Server Error',
      message: 'Failed to delete email log'
    }, 500);
  }
});

export default app;
