# Email Service Quick Reference Card

## Setup Commands

```bash
# 1. Create database
wrangler d1 create PPP_ACADEMY_DB

# 2. Apply schema
wrangler d1 execute PPP_ACADEMY_DB --file=schema.sql

# 3. Add API key
wrangler secret put RESEND_API_KEY

# 4. Deploy
wrangler deploy
```

## Import & Use

```javascript
// Import functions
import {
  sendEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendInvitationEmail,
  sendDocumentProcessedEmail,
  sendNotificationDigest
} from './services/email.js';

// Send welcome email
await sendWelcomeEmail(env, {
  to: 'user@example.com',
  name: 'John Doe',
  tenantName: 'Acme Corp'
});

// Send custom email
await sendEmail(env, {
  to: 'user@example.com',
  subject: 'Hello!',
  html: '<h1>Hello World</h1>',
  tags: ['custom']
});
```

## API Endpoints

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| POST | `/emails/send` | Send custom email | emails:send |
| POST | `/emails/batch` | Send batch emails | emails:send |
| POST | `/emails/test` | Send test email | emails:send |
| GET | `/emails/logs` | Get email logs | authenticated |
| GET | `/emails/stats` | Get statistics | authenticated |
| GET | `/emails/templates` | List templates | authenticated |
| POST | `/emails/preview` | Preview template | emails:send |

## Templates

| Template | Variables |
|----------|-----------|
| welcome | name, tenantName |
| password-reset | name, resetLink, expiresIn |
| invitation | inviterName, tenantName, inviteLink, role |
| document-processed | name, documentName, status |
| notification-digest | name, notifications, period |

## Test Email

```bash
curl -X POST https://your-worker.workers.dev/emails/test \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

## Get Logs

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://your-worker.workers.dev/emails/logs?limit=10"
```

## Get Stats

```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://your-worker.workers.dev/emails/stats?period=7d"
```

## Database Queries

```sql
-- Recent emails
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;

-- Failed emails
SELECT * FROM email_logs WHERE status = 'failed';

-- Email count by template
SELECT template, COUNT(*) FROM email_logs GROUP BY template;

-- Today's emails
SELECT COUNT(*) FROM email_logs
WHERE DATE(created_at) = DATE('now');
```

## Files

- `/src/services/email.js` - Email service
- `/src/routes/emails.js` - API routes
- `/schema.sql` - Database schema
- `/EMAIL_SERVICE_README.md` - Full docs
- `/QUICK_START_EMAIL.md` - Quick start
- `/MIGRATION_GUIDE.md` - Migration help

## Environment Variables

```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "PPP_ACADEMY_DB"
database_id = "your-database-id"
```

```bash
# Secrets (via wrangler secret put)
RESEND_API_KEY=re_xxxxx
```

## Common Issues

**RESEND_API_KEY not configured**
```bash
wrangler secret put RESEND_API_KEY
```

**Database error**
```bash
wrangler d1 execute PPP_ACADEMY_DB --file=schema.sql
```

**Permission denied**
User needs `emails:send` permission

## Support

- Resend: https://resend.com/docs
- D1: https://developers.cloudflare.com/d1/
- Workers: https://developers.cloudflare.com/workers/

---

**Created:** 2024-12-04 | **Version:** 1.0.0
