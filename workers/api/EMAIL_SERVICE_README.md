# Email Service - PPP Academy

Complete email service implementation using Resend for PPP Academy.

## Features

- **Resend API Integration** - Professional email delivery via Resend
- **Email Templates** - Pre-built, responsive HTML templates
- **Batch Sending** - Send multiple emails efficiently
- **Email Logging** - Track all sent emails in D1 database
- **Analytics & Stats** - Email performance metrics and reporting
- **Admin Controls** - Send custom emails via API

## Files Created

### 1. `/src/services/email.js`
Email service with Resend integration and template functions.

**Functions:**
- `sendEmail(env, emailData)` - Send single email
- `sendBatchEmails(env, emails)` - Send batch emails
- `sendWelcomeEmail(env, data)` - Welcome new users
- `sendPasswordResetEmail(env, data)` - Password reset emails
- `sendInvitationEmail(env, data)` - Team invitations
- `sendDocumentProcessedEmail(env, data)` - Document notifications
- `sendNotificationDigest(env, data)` - Daily/weekly digests
- `getEmailTemplate(templateName, data)` - Get HTML templates
- `logEmailSent(env, tenantId, emailData)` - Log to database

### 2. `/src/routes/emails.js`
REST API endpoints for email management.

**Endpoints:**
- `POST /emails/send` - Send custom email (admin)
- `POST /emails/batch` - Send batch emails (admin)
- `GET /emails/logs` - Get email logs (paginated)
- `GET /emails/logs/:emailId` - Get single email log
- `GET /emails/stats` - Email statistics
- `POST /emails/test` - Send test email (admin)
- `GET /emails/templates` - List available templates
- `POST /emails/preview` - Preview template with data (admin)
- `DELETE /emails/logs/:emailId` - Delete email log (admin)

### 3. `/schema.sql`
Database schema for email logging.

**Tables:**
- `email_logs` - All sent email records
- Supporting tables for users, tenants, sessions, etc.

**Views:**
- `v_email_activity` - Recent email activity by template
- `v_tenant_email_stats` - Tenant email statistics

### 4. `/src/index.js` (Updated)
Added email routes to main application.

## Setup Instructions

### 1. Install Dependencies

The service uses `nanoid` for ID generation. Install it:

```bash
npm install nanoid
```

### 2. Create D1 Database

```bash
# Create the database
wrangler d1 create PPP_ACADEMY_DB

# Note the database_id from the output
```

### 3. Update wrangler.toml

Add to your `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "PPP_ACADEMY_DB"
database_id = "your-database-id-here"
```

### 4. Apply Database Schema

```bash
wrangler d1 execute PPP_ACADEMY_DB --file=schema.sql
```

### 5. Get Resend API Key

1. Sign up at [Resend.com](https://resend.com)
2. Create an API key
3. Verify your domain (or use Resend's test domain)

### 6. Add Resend API Key as Secret

```bash
wrangler secret put RESEND_API_KEY
# Enter your Resend API key when prompted
```

### 7. Deploy

```bash
wrangler deploy
```

## Usage Examples

### Send Welcome Email

```javascript
import { sendWelcomeEmail } from './services/email.js';

await sendWelcomeEmail(env, {
  to: 'user@example.com',
  name: 'John Doe',
  tenantName: 'Acme Corp'
});
```

### Send Password Reset

```javascript
import { sendPasswordResetEmail } from './services/email.js';

await sendPasswordResetEmail(env, {
  to: 'user@example.com',
  name: 'John Doe',
  resetLink: 'https://app.kira.keyreply.com/reset?token=xyz',
  expiresIn: '1 hour'
});
```

### Send Team Invitation

```javascript
import { sendInvitationEmail } from './services/email.js';

await sendInvitationEmail(env, {
  to: 'newuser@example.com',
  inviterName: 'Jane Smith',
  tenantName: 'Acme Corp',
  inviteLink: 'https://app.kira.keyreply.com/invite?token=abc',
  role: 'Member'
});
```

### Send Document Notification

```javascript
import { sendDocumentProcessedEmail } from './services/email.js';

await sendDocumentProcessedEmail(env, {
  to: 'user@example.com',
  name: 'John Doe',
  documentName: 'Annual Report 2024.pdf',
  status: 'success',
  tenantId: 'tenant-123'
});
```

### Send Notification Digest

```javascript
import { sendNotificationDigest } from './services/email.js';

await sendNotificationDigest(env, {
  to: 'user@example.com',
  name: 'John Doe',
  notifications: [
    { title: 'New Comment', message: 'Someone commented on your post', created_at: '2024-12-04T10:00:00Z' },
    { title: 'Document Ready', message: 'Your document is ready', created_at: '2024-12-04T11:00:00Z' }
  ],
  tenantId: 'tenant-123',
  period: 'daily'
});
```

### Send Custom Email

```javascript
import { sendEmail } from './services/email.js';

await sendEmail(env, {
  to: 'user@example.com',
  subject: 'Custom Subject',
  html: '<h1>Hello!</h1><p>This is a custom email.</p>',
  text: 'Hello! This is a custom email.',
  from: 'Custom Name <custom@kira.keyreply.com>',
  replyTo: 'support@kira.keyreply.com',
  tags: ['custom', 'marketing']
});
```

### Send Batch Emails

```javascript
import { sendBatchEmails } from './services/email.js';

await sendBatchEmails(env, [
  {
    to: 'user1@example.com',
    subject: 'Newsletter',
    html: '<h1>Newsletter</h1>',
    tags: ['newsletter']
  },
  {
    to: 'user2@example.com',
    subject: 'Newsletter',
    html: '<h1>Newsletter</h1>',
    tags: ['newsletter']
  }
]);
```

## API Endpoints

### Send Email (Admin)

```bash
POST /emails/send
Authorization: Bearer <session-token>

{
  "to": "user@example.com",
  "subject": "Test Email",
  "html": "<h1>Hello World</h1>",
  "text": "Hello World",
  "tags": ["test"]
}
```

### Get Email Logs

```bash
GET /emails/logs?limit=50&offset=0&status=sent&search=user@example.com
Authorization: Bearer <session-token>
```

### Get Email Statistics

```bash
GET /emails/stats?period=30d
Authorization: Bearer <session-token>
```

Response:
```json
{
  "stats": {
    "total": 1250,
    "sent": 1200,
    "failed": 50,
    "bounced": 10,
    "opened": 800,
    "clicked": 300,
    "openRate": 64.0,
    "clickRate": 24.0,
    "bounceRate": 0.8
  },
  "byTemplate": [
    { "template": "welcome", "count": 500 },
    { "template": "notification-digest", "count": 400 }
  ],
  "recentActivity": [
    { "date": "2024-12-04", "count": 120 },
    { "date": "2024-12-03", "count": 95 }
  ]
}
```

### Send Test Email

```bash
POST /emails/test
Authorization: Bearer <session-token>

{
  "to": "your-email@example.com"
}
```

### List Templates

```bash
GET /emails/templates
Authorization: Bearer <session-token>
```

### Preview Template

```bash
POST /emails/preview
Authorization: Bearer <session-token>

{
  "template": "welcome",
  "data": {
    "name": "John Doe",
    "tenantName": "Acme Corp"
  }
}
```

## Email Templates

### Available Templates

1. **welcome** - Welcome new users
   - Variables: `name`, `tenantName`

2. **password-reset** - Password reset with secure link
   - Variables: `name`, `resetLink`, `expiresIn`

3. **invitation** - Team invitation
   - Variables: `inviterName`, `tenantName`, `inviteLink`, `role`

4. **document-processed** - Document completion notification
   - Variables: `name`, `documentName`, `status`

5. **notification-digest** - Daily/weekly notification summary
   - Variables: `name`, `notifications`, `period`

### Template Features

- Fully responsive HTML
- Professional gradient headers
- Clean, modern design
- Mobile-optimized
- Accessible color schemes
- Inline CSS for email client compatibility
- Plain text fallback

## Database Schema

### email_logs Table

```sql
CREATE TABLE email_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  to_address TEXT NOT NULL,
  from_address TEXT,
  subject TEXT,
  template TEXT,
  status TEXT DEFAULT 'sent',
  resend_id TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  bounced_at TEXT,
  error TEXT,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
```

### Indexes

- `idx_email_logs_tenant` - Fast tenant lookups
- `idx_email_logs_created` - Chronological sorting
- `idx_email_logs_status` - Filter by status
- `idx_email_logs_template` - Filter by template
- `idx_email_logs_resend_id` - Resend webhook matching
- `idx_email_logs_to_address` - Recipient lookups

## Integration Examples

### In Queue Handler (Document Processing)

```javascript
import { sendDocumentProcessedEmail } from './services/email.js';

async function processDocument(data, env) {
  const { documentId, tenantId, userId } = data;

  try {
    // Process document...

    // Get user email
    const user = await env.DB.prepare(
      'SELECT email, name FROM users WHERE id = ?'
    ).bind(userId).first();

    // Send success email
    await sendDocumentProcessedEmail(env, {
      to: user.email,
      name: user.name,
      documentName: 'document.pdf',
      status: 'success',
      tenantId
    });
  } catch (error) {
    // Send failure email
    await sendDocumentProcessedEmail(env, {
      to: user.email,
      name: user.name,
      documentName: 'document.pdf',
      status: 'failed',
      tenantId
    });
  }
}
```

### User Registration Flow

```javascript
import { sendWelcomeEmail } from './services/email.js';

app.post('/auth/register', async (c) => {
  // Create user...

  // Send welcome email
  await sendWelcomeEmail(c.env, {
    to: email,
    name: name,
    tenantName: tenant.name
  });

  return c.json({ success: true });
});
```

### Password Reset Flow

```javascript
import { sendPasswordResetEmail } from './services/email.js';
import { nanoid } from 'nanoid';

app.post('/auth/forgot-password', async (c) => {
  const { email } = await c.req.json();

  // Generate reset token
  const resetToken = nanoid(32);
  const expiresAt = new Date(Date.now() + 3600000); // 1 hour

  // Save token to database...

  // Send reset email
  const resetLink = `https://app.kira.keyreply.com/reset-password?token=${resetToken}`;
  await sendPasswordResetEmail(c.env, {
    to: email,
    name: user.name,
    resetLink,
    expiresIn: '1 hour'
  });

  return c.json({ success: true });
});
```

## Permissions

Email endpoints require the `emails:send` permission:

```javascript
// In your auth system
const user = {
  role: 'admin',
  permissions: ['emails:send', 'emails:view']
};
```

Admin and owner roles automatically have all permissions.

## Rate Limiting

Consider adding rate limits to email endpoints:

```javascript
import { rateLimiter } from '../middleware/auth.js';

app.post('/send',
  requirePermission('emails:send'),
  rateLimiter(10, 60000), // 10 emails per minute
  async (c) => {
    // Send email...
  }
);
```

## Monitoring

### Check Email Logs

```bash
# Via API
curl -H "Authorization: Bearer <token>" \
  https://your-worker.workers.dev/emails/logs

# Via D1 CLI
wrangler d1 execute PPP_ACADEMY_DB \
  --command "SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10"
```

### View Statistics

```bash
curl -H "Authorization: Bearer <token>" \
  https://your-worker.workers.dev/emails/stats?period=7d
```

## Troubleshooting

### RESEND_API_KEY not configured

```bash
# Add the secret
wrangler secret put RESEND_API_KEY
```

### Database not available

```bash
# Verify D1 binding in wrangler.toml
# Apply schema
wrangler d1 execute PPP_ACADEMY_DB --file=schema.sql
```

### Emails not sending

1. Check Resend API key is valid
2. Verify domain is configured in Resend
3. Check email logs for errors:
   ```sql
   SELECT * FROM email_logs WHERE error IS NOT NULL;
   ```

### Test email configuration

```bash
curl -X POST https://your-worker.workers.dev/emails/test \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

## Security Considerations

1. **API Key Protection** - Never expose RESEND_API_KEY in code
2. **Permission Checks** - All admin endpoints require `emails:send` permission
3. **Rate Limiting** - Implement rate limits on email endpoints
4. **Input Validation** - Validate all email addresses and content
5. **Tenant Isolation** - Email logs are tenant-scoped
6. **Audit Trail** - All emails are logged with metadata

## Performance

- **Batch Sending** - Use `sendBatchEmails()` for multiple recipients
- **Async Logging** - Email logging is non-blocking
- **Indexed Queries** - Database queries use optimized indexes
- **Template Caching** - Templates are generated on-demand

## Future Enhancements

- [ ] Webhook handling for email events (opens, clicks, bounces)
- [ ] Email queue for retry logic
- [ ] Template editor UI
- [ ] A/B testing for email campaigns
- [ ] Email scheduling
- [ ] Unsubscribe management
- [ ] Email preferences per user
- [ ] Rich analytics dashboard
- [ ] Email attachments support
- [ ] Dynamic template system

## Support

For issues or questions:
- Check Resend documentation: https://resend.com/docs
- Review Cloudflare Workers docs: https://developers.cloudflare.com/workers/
- Check D1 documentation: https://developers.cloudflare.com/d1/

## License

Part of PPP Academy - All rights reserved.
