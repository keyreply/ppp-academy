import { Hono } from 'hono';
import { getUserId, getTenantId } from '../middleware/auth';
import { sendEmail, getEmailProviderInfo } from '../services/email';
import { EmailQueueService } from '../services/email-queue';

const emailRouter = new Hono();

// Middleware to ensure admin/authorized access could be added here
// For now, we assume authMiddleware is applied at root

// Get email configuration status
emailRouter.get('/config', (c) => {
    return c.json(getEmailProviderInfo(c.env));
});

// Send test email (Immediate)
emailRouter.post('/test', async (c) => {
    const { to } = await c.req.json();
    const userId = getUserId(c);

    try {
        const result = await sendEmail(c.env, {
            to: to || 'test@example.com',
            subject: 'Test Email from PPP Academy',
            html: '<h1>Test Email</h1><p>This is a test email sent from the PPP Academy API.</p>',
            from: 'PPP Academy <noreply@ppp-academy.com>',
            tags: ['test']
        });

        return c.json({ success: true, result });
    } catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Queue test email (Async)
emailRouter.post('/test-queue', async (c) => {
    const { to } = await c.req.json();
    const tenantId = getTenantId(c);

    const queueService = new EmailQueueService(c.env);

    try {
        const result = await queueService.queueEmail({
            to: to || 'test@example.com',
            subject: 'Queued Test Email',
            template: 'welcome',
            tenantId,
            metadata: { name: 'Tester', tenantName: 'PPP Academy' }
        });

        return c.json({ success: true, result });
    } catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

// Get email logs
emailRouter.get('/logs', async (c) => {
    const tenantId = getTenantId(c);

    try {
        const { results } = await c.env.DB.prepare(`
      SELECT * FROM email_logs
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).bind(tenantId).all();

        return c.json({ logs: results });
    } catch (error) {
        return c.json({ success: false, error: error.message }, 500);
    }
});

export default emailRouter;
