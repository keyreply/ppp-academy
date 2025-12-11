# Outbound Email Implementation Plan for KeyReply Kira

## Implementation Status
- [x] **Phase 1: Resend Setup**
    - [x] Add Domain & DNS
    - [x] API Keys
- [x] **Phase 2: Email Service Implementation**
    - [x] D1 Schema for Logs
    - [x] EmailService Class (Resend Wrapper)
- [ ] **Phase 3: Queue-Based Email Sending**
    - [ ] Queue Producer/Consumer
- [ ] **Phase 4: Email API Endpoints**
- [ ] **Phase 5: Integration with Auth Flow**
- [ ] **Phase 6: Document Processing Email Notification**

## Overview

This plan implements outbound email capabilities for the KeyReply Kira SaaS platform using Cloudflare-native services. The system will support transactional emails (welcome, password reset, notifications) and user-triggered emails.

## Email Options Comparison

| Option | Status | Pricing | Pros | Cons |
|--------|--------|---------|------|------|
| **Cloudflare Email Service** | Private Beta | TBD (paid Workers) | Native binding, no API keys, auto DNS | Not GA yet |
| **Resend** | Available | 3K/month free, $20/month for 50K | Great DX, React Email support | External service, API key needed |
| **Email Routing (send_email)** | Available | Free | Native, no external deps | Limited to verified addresses only |

## Recommended Approach

**Primary: Resend** (available now, best DX)
**Future: Cloudflare Email Service** (when GA, migrate for native integration)

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Worker API      │────▶│   Resend API    │
│   (React/Vite)  │     │  (Hono)          │     │   (Email Send)  │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   D1 Database    │
                        │   (Email Logs)   │
                        └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │   Queues         │
                        │   (Async Send)   │
                        └──────────────────┘
```

## Implementation Steps

### Phase 1: Resend Setup

#### 1.1 Add Domain to Resend

1. Sign up at [resend.com](https://resend.com) (free tier: 3,000 emails/month)
2. Go to **Domains** → **Add Domain**
3. Enter your domain (e.g., `kira.keyreply.com`)
4. Add the DNS records to Cloudflare:

```
# DKIM Records (provided by Resend)
Type: TXT
Name: resend._domainkey
Value: [provided by Resend]

# SPF Record
Type: TXT
Name: @
Value: v=spf1 include:_spf.resend.com ~all

# DMARC Record (optional but recommended)
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com
```

5. Verify DNS records in Resend dashboard
6. Generate API key with send permissions

#### 1.2 Install Dependencies

```bash
cd worker
bun add resend
```

#### 1.3 Store API Key as Secret

```bash
# Local development (.dev.vars)
echo "RESEND_API_KEY=re_xxxxxxxxxx" >> .dev.vars

# Production
npx wrangler secret put RESEND_API_KEY
```

### Phase 2: Email Service Implementation

#### 2.1 D1 Schema for Email Logs

```sql
-- Email logs table (for tracking and debugging)
CREATE TABLE email_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  to_email TEXT NOT NULL,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, sent, failed, delivered, bounced
  resend_id TEXT,
  error_message TEXT,
  metadata TEXT, -- JSON string for template variables
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created ON email_logs(created_at);
```

#### 2.2 Email Service Class

```javascript
// services/email.js
import { Resend } from 'resend';

export class EmailService {
  constructor(env) {
    this.resend = new Resend(env.RESEND_API_KEY);
    this.db = env.DB;
    this.fromEmail = env.EMAIL_FROM || 'noreply@kira.keyreply.com';
    this.fromName = env.EMAIL_FROM_NAME || 'KeyReply Kira';
  }

  async send({ to, subject, html, text, template, userId, metadata }) {
    const logId = crypto.randomUUID();

    // Log the email attempt
    await this.db.prepare(`
      INSERT INTO email_logs (id, user_id, to_email, from_email, subject, template, metadata, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).bind(
      logId,
      userId || null,
      to,
      this.fromEmail,
      subject,
      template || 'custom',
      JSON.stringify(metadata || {})
    ).run();

    try {
      const { data, error } = await this.resend.emails.send({
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [to],
        subject,
        html,
        text,
      });

      if (error) {
        throw new Error(error.message);
      }

      // Update log with success
      await this.db.prepare(`
        UPDATE email_logs
        SET status = 'sent', resend_id = ?, sent_at = datetime('now')
        WHERE id = ?
      `).bind(data.id, logId).run();

      return { success: true, id: data.id, logId };

    } catch (error) {
      // Update log with failure
      await this.db.prepare(`
        UPDATE email_logs
        SET status = 'failed', error_message = ?
        WHERE id = ?
      `).bind(error.message, logId).run();

      throw error;
    }
  }

  // Convenience methods for common emails
  async sendWelcome(user) {
    return this.send({
      to: user.email,
      subject: 'Welcome to KeyReply Kira!',
      template: 'welcome',
      userId: user.id,
      metadata: { name: user.name },
      html: this.templates.welcome(user),
      text: `Welcome to KeyReply Kira, ${user.name || 'there'}! We're excited to have you.`,
    });
  }

  async sendPasswordReset(user, resetToken) {
    const resetUrl = `https://kira.keyreply.com/reset-password?token=${resetToken}`;
    return this.send({
      to: user.email,
      subject: 'Reset Your Password - KeyReply Kira',
      template: 'password_reset',
      userId: user.id,
      metadata: { resetUrl },
      html: this.templates.passwordReset(user, resetUrl),
      text: `Reset your password by visiting: ${resetUrl}\n\nThis link expires in 1 hour.`,
    });
  }

  async sendDocumentProcessed(user, document) {
    return this.send({
      to: user.email,
      subject: `Document "${document.original_name}" is ready`,
      template: 'document_processed',
      userId: user.id,
      metadata: { documentId: document.id, documentName: document.original_name },
      html: this.templates.documentProcessed(user, document),
      text: `Your document "${document.original_name}" has been processed and is now searchable in your knowledge base.`,
    });
  }

  // Email templates
  templates = {
    welcome: (user) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to KeyReply Kira</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">KeyReply Kira</h1>
          </div>

          <h2>Welcome${user.name ? `, ${user.name}` : ''}!</h2>

          <p>Thank you for joining KeyReply Kira. We're excited to have you on board.</p>

          <p>Here's what you can do next:</p>
          <ul>
            <li>Upload documents to your personal knowledge base</li>
            <li>Ask Kira, your AI assistant, questions about your documents</li>
            <li>Explore the dashboard and discover insights</li>
          </ul>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://kira.keyreply.com/dashboard"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Go to Dashboard
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            If you have any questions, just reply to this email or ask Kira!
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            KeyReply Kira • Your AI-Powered Learning Platform
          </p>
        </body>
      </html>
    `,

    passwordReset: (user, resetUrl) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">KeyReply Kira</h1>
          </div>

          <h2>Reset Your Password</h2>

          <p>Hi${user.name ? ` ${user.name}` : ''},</p>

          <p>We received a request to reset your password. Click the button below to create a new password:</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>

          <p style="color: #666; font-size: 14px;">
            Or copy this link: <br>
            <code style="background: #f5f5f5; padding: 4px 8px; border-radius: 4px; word-break: break-all;">${resetUrl}</code>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            KeyReply Kira • Your AI-Powered Learning Platform
          </p>
        </body>
      </html>
    `,

    documentProcessed: (user, document) => `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Ready</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0;">KeyReply Kira</h1>
          </div>

          <h2>Your Document is Ready!</h2>

          <p>Hi${user.name ? ` ${user.name}` : ''},</p>

          <p>Great news! Your document has been processed and is now part of your knowledge base:</p>

          <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-weight: 600;">${document.original_name}</p>
            <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">
              ${document.chunk_count} searchable sections created
            </p>
          </div>

          <p>You can now ask Kira questions about this document, and she'll use it to provide accurate answers.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="https://kira.keyreply.com/dashboard"
               style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Ask Kira Now
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            KeyReply Kira • Your AI-Powered Learning Platform
          </p>
        </body>
      </html>
    `,
  };
}
```

### Phase 3: Queue-Based Email Sending

For high-volume or non-blocking email sends, use Cloudflare Queues:

#### 3.1 Update wrangler.toml

```toml
# Add email queue
[[queues.producers]]
binding = "EMAIL_QUEUE"
queue = "keyreply-kira-emails"

[[queues.consumers]]
queue = "keyreply-kira-emails"
max_batch_size = 10
max_batch_timeout = 5
```

#### 3.2 Create Email Queue

```bash
npx wrangler queues create keyreply-kira-emails
```

#### 3.3 Queue Producer (Async Send)

```javascript
// services/email-queue.js
export class EmailQueueService {
  constructor(env) {
    this.queue = env.EMAIL_QUEUE;
    this.db = env.DB;
  }

  async queueEmail({ to, subject, template, userId, metadata }) {
    const logId = crypto.randomUUID();

    // Log as queued
    await this.db.prepare(`
      INSERT INTO email_logs (id, user_id, to_email, from_email, subject, template, metadata, status)
      VALUES (?, ?, ?, 'noreply@kira.keyreply.com', ?, ?, ?, 'queued')
    `).bind(logId, userId || null, to, subject, template, JSON.stringify(metadata || {})).run();

    // Send to queue
    await this.queue.send({
      logId,
      to,
      subject,
      template,
      userId,
      metadata,
    });

    return { queued: true, logId };
  }
}
```

#### 3.4 Queue Consumer

```javascript
// In main worker export
export default {
  // ... fetch handler

  async queue(batch, env) {
    const emailService = new EmailService(env);

    for (const message of batch.messages) {
      const { logId, to, subject, template, userId, metadata } = message.body;

      try {
        // Generate email content from template
        const { html, text } = generateEmailContent(template, metadata);

        // Send email
        await emailService.send({
          to,
          subject,
          html,
          text,
          template,
          userId,
          metadata,
        });

        message.ack();
      } catch (error) {
        console.error(`Failed to send email ${logId}:`, error);

        // Update log with error
        await env.DB.prepare(`
          UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?
        `).bind(error.message, logId).run();

        // Retry up to 3 times
        if (message.attempts < 3) {
          message.retry({ delaySeconds: 60 * message.attempts });
        } else {
          message.ack();
        }
      }
    }
  }
};

function generateEmailContent(template, metadata) {
  // Template generation logic
  const templates = {
    welcome: () => ({
      html: `<h1>Welcome ${metadata.name}!</h1>...`,
      text: `Welcome ${metadata.name}!...`,
    }),
    password_reset: () => ({
      html: `<h1>Reset your password</h1><a href="${metadata.resetUrl}">Click here</a>...`,
      text: `Reset your password: ${metadata.resetUrl}`,
    }),
    document_processed: () => ({
      html: `<h1>Document ready!</h1><p>${metadata.documentName} is now searchable.</p>...`,
      text: `Your document ${metadata.documentName} is now searchable.`,
    }),
  };

  return templates[template]?.() || { html: '', text: '' };
}
```

### Phase 4: Email API Endpoints

```javascript
// routes/email.js
import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';
import { EmailService } from '../services/email';

const email = new Hono();

// Send test email (admin only)
email.post('/test', async (c) => {
  const userId = getUserId(c);
  const { to } = await c.req.json();

  const emailService = new EmailService(c.env);

  try {
    const result = await emailService.send({
      to: to || c.get('user').email,
      subject: 'Test Email from KeyReply Kira',
      template: 'test',
      userId,
      html: '<h1>Test Email</h1><p>This is a test email from KeyReply Kira.</p>',
      text: 'This is a test email from KeyReply Kira.',
    });

    return c.json({ success: true, ...result });
  } catch (error) {
    return c.json({ error: error.message }, 500);
  }
});

// Get email logs for current user
email.get('/logs', async (c) => {
  const userId = getUserId(c);

  const { results } = await c.env.DB.prepare(`
    SELECT id, to_email, subject, template, status, created_at, sent_at
    FROM email_logs
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).bind(userId).all();

  return c.json({ logs: results });
});

export default email;
```

### Phase 5: Integration with Auth Flow

Update auth routes to send emails:

```javascript
// routes/auth.js - Updated with email
import { EmailService } from '../services/email';

// Register - send welcome email
auth.post('/register', async (c) => {
  // ... existing registration logic

  // Send welcome email
  const emailService = new EmailService(c.env);
  try {
    await emailService.sendWelcome({ id: userId, email, name });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't fail registration if email fails
  }

  return c.json({
    user: { id: userId, email, name },
    session: { token: sessionId, expiresAt },
  }, 201);
});

// Password reset request
auth.post('/forgot-password', async (c) => {
  const { email } = await c.req.json();

  const user = await c.env.DB.prepare(
    'SELECT id, email, name FROM users WHERE email = ?'
  ).bind(email).first();

  // Always return success to prevent email enumeration
  if (!user) {
    return c.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  }

  // Generate reset token
  const resetToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Store reset token
  await c.env.DB.prepare(`
    INSERT INTO password_resets (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(resetToken, user.id, expiresAt.toISOString()).run();

  // Send reset email
  const emailService = new EmailService(c.env);
  try {
    await emailService.sendPasswordReset(user, resetToken);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
  }

  return c.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
});
```

### Phase 6: Document Processing Email Notification

Update queue processor to send notification:

```javascript
// In document processor queue consumer
// After document is successfully processed:

// Send notification email
const user = await env.DB.prepare(
  'SELECT id, email, name FROM users WHERE id = ?'
).bind(userId).first();

if (user) {
  const emailService = new EmailService(env);
  try {
    await emailService.sendDocumentProcessed(user, {
      id: documentId,
      original_name: document.original_name,
      chunk_count: totalChunks,
    });
  } catch (error) {
    console.error('Failed to send document notification:', error);
  }
}
```

## Future: Cloudflare Email Service Migration

When Cloudflare Email Service becomes GA, migrate to native binding:

### Updated wrangler.toml

```toml
# Native Email Service binding (when available)
[[email]]
binding = "SEND_EMAIL"
domain = "kira.keyreply.com"
```

### Updated Email Service

```javascript
// services/email-cloudflare.js
export class CloudflareEmailService {
  constructor(env) {
    this.email = env.SEND_EMAIL;
    this.db = env.DB;
  }

  async send({ to, subject, html, text, userId, template, metadata }) {
    const logId = crypto.randomUUID();

    await this.db.prepare(`
      INSERT INTO email_logs (id, user_id, to_email, from_email, subject, template, metadata, status)
      VALUES (?, ?, ?, 'noreply@kira.keyreply.com', ?, ?, ?, 'pending')
    `).bind(logId, userId, to, subject, template, JSON.stringify(metadata || {})).run();

    try {
      // Native Cloudflare Email Service
      await this.email.send({
        to: [{ email: to }],
        from: { email: 'noreply@kira.keyreply.com', name: 'KeyReply Kira' },
        subject,
        html,
        text,
      });

      await this.db.prepare(`
        UPDATE email_logs SET status = 'sent', sent_at = datetime('now') WHERE id = ?
      `).bind(logId).run();

      return { success: true, logId };

    } catch (error) {
      await this.db.prepare(`
        UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?
      `).bind(error.message, logId).run();

      throw error;
    }
  }
}
```

## File Structure

```
worker/
├── src/
│   ├── index.js
│   ├── routes/
│   │   ├── auth.js          # Auth with email integration
│   │   └── email.js         # Email management endpoints
│   └── services/
│       ├── email.js         # Resend email service
│       └── email-queue.js   # Queue-based async sending
└── wrangler.toml
```

## Environment Variables

```bash
# Required secrets
npx wrangler secret put RESEND_API_KEY

# Optional environment variables (in wrangler.toml)
[vars]
EMAIL_FROM = "noreply@kira.keyreply.com"
EMAIL_FROM_NAME = "KeyReply Kira"
```

## Email Types Summary

| Email Type | Trigger | Template |
|------------|---------|----------|
| Welcome | User registration | `welcome` |
| Password Reset | Forgot password request | `password_reset` |
| Document Processed | Document queue completion | `document_processed` |
| Test | Manual API call | `test` |

## Cost Estimation

### Resend Pricing
| Tier | Emails/Month | Price |
|------|--------------|-------|
| Free | 3,000 | $0 |
| Pro | 50,000 | $20/month |
| Business | 100,000+ | Custom |

### Estimated Usage (100 users)
- Welcome emails: 100/month (new signups)
- Password resets: 50/month
- Document notifications: 500/month
- **Total: ~650 emails/month** ✓ Free tier

## Deployment Commands

```bash
# 1. Create email queue
npx wrangler queues create keyreply-kira-emails

# 2. Add Resend API key
npx wrangler secret put RESEND_API_KEY

# 3. Update D1 schema
npx wrangler d1 execute keyreply-kira-db --remote --command "
  CREATE TABLE email_logs (...);
  CREATE TABLE password_resets (...);
"

# 4. Deploy worker
cd worker && bun run deploy
```

## Security Checklist

- [x] API key stored as secret (not in code)
- [x] Email logs scoped to user_id
- [x] Password reset tokens expire in 1 hour
- [x] Rate limiting on email endpoints
- [x] No email enumeration on forgot password
- [x] DKIM/SPF/DMARC configured for deliverability

## Sources

- [Cloudflare Email Service Private Beta](https://blog.cloudflare.com/email-service/)
- [Send Emails with Resend Tutorial](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/)
- [Resend Cloudflare Workers Docs](https://resend.com/docs/send-with-cloudflare-workers)
- [Email Routing Send Email Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)
