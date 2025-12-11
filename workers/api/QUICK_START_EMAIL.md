# Email Service Quick Start Guide

## 1. Setup (5 minutes)

```bash
# Install dependencies
npm install nanoid

# Create D1 database
wrangler d1 create PPP_ACADEMY_DB

# Apply schema
wrangler d1 execute PPP_ACADEMY_DB --file=schema.sql

# Add Resend API key
wrangler secret put RESEND_API_KEY

# Deploy
wrangler deploy
```

## 2. Add to wrangler.toml

```toml
[[d1_databases]]
binding = "DB"
database_name = "PPP_ACADEMY_DB"
database_id = "your-database-id-from-create-command"
```

## 3. Test It

```bash
curl -X POST https://your-worker.workers.dev/emails/test \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

## 4. Use in Code

### Welcome Email
```javascript
import { sendWelcomeEmail } from './services/email.js';

await sendWelcomeEmail(env, {
  to: 'user@example.com',
  name: 'John Doe',
  tenantName: 'Acme Corp'
});
```

### Password Reset
```javascript
import { sendPasswordResetEmail } from './services/email.js';

await sendPasswordResetEmail(env, {
  to: 'user@example.com',
  name: 'John Doe',
  resetLink: 'https://app.kira.keyreply.com/reset?token=xyz',
  expiresIn: '1 hour'
});
```

### Custom Email
```javascript
import { sendEmail } from './services/email.js';

await sendEmail(env, {
  to: 'user@example.com',
  subject: 'Hello!',
  html: '<h1>Hello World</h1>',
  tags: ['custom']
});
```

## 5. API Endpoints

All endpoints require authentication (`Authorization: Bearer <token>`)

### Send Email (Admin)
```bash
POST /emails/send
{
  "to": "user@example.com",
  "subject": "Test",
  "html": "<h1>Hello</h1>",
  "tags": ["test"]
}
```

### Get Logs
```bash
GET /emails/logs?limit=50
```

### Get Stats
```bash
GET /emails/stats?period=30d
```

### Test Email
```bash
POST /emails/test
{
  "to": "your-email@example.com"
}
```

## 6. Available Templates

| Template | Use Case | Variables |
|----------|----------|-----------|
| `welcome` | New user signup | `name`, `tenantName` |
| `password-reset` | Password reset | `name`, `resetLink`, `expiresIn` |
| `invitation` | Team invite | `inviterName`, `tenantName`, `inviteLink`, `role` |
| `document-processed` | Document ready | `name`, `documentName`, `status` |
| `notification-digest` | Daily digest | `name`, `notifications`, `period` |

## 7. Permissions

Users need `emails:send` permission for admin endpoints.

Admin/Owner roles have all permissions by default.

## 8. Monitoring

```bash
# View recent emails
wrangler d1 execute PPP_ACADEMY_DB \
  --command "SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10"

# Check stats via API
curl -H "Authorization: Bearer <token>" \
  https://your-worker.workers.dev/emails/stats
```

## Troubleshooting

**Emails not sending?**
- Verify RESEND_API_KEY is set: `wrangler secret list`
- Check Resend dashboard for errors
- Test with `/emails/test` endpoint

**Database errors?**
- Verify D1 binding in wrangler.toml
- Check schema is applied: `wrangler d1 execute PPP_ACADEMY_DB --command "SELECT * FROM email_logs LIMIT 1"`

**Permission denied?**
- Ensure user has `emails:send` permission
- Check user role is admin or owner

## Files Overview

- `/src/services/email.js` - Email service & templates
- `/src/routes/emails.js` - API endpoints
- `/schema.sql` - Database schema
- `/src/index.js` - Routes mounted here

## Next Steps

1. Configure your domain in Resend
2. Customize email templates
3. Add webhooks for email events
4. Set up monitoring alerts
5. Implement rate limiting

## Resources

- [Resend Docs](https://resend.com/docs)
- [D1 Docs](https://developers.cloudflare.com/d1/)
- [Workers Docs](https://developers.cloudflare.com/workers/)

---

**Ready to send emails!** Check EMAIL_SERVICE_README.md for detailed documentation.
