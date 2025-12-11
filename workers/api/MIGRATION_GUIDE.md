# Email Service Migration Guide

This guide helps you integrate the new email service into your existing PPP Academy setup.

## Pre-Migration Checklist

- [ ] Review EMAIL_SERVICE_README.md
- [ ] Backup existing database (if any)
- [ ] Get Resend API key ready
- [ ] Note your current D1 database ID
- [ ] Review existing email functionality (if any)

## Migration Steps

### Step 1: Database Migration

If you already have a D1 database:

```bash
# Apply new email tables to existing database
wrangler d1 execute YOUR_DATABASE_NAME --file=schema.sql
```

The schema uses `CREATE TABLE IF NOT EXISTS`, so it won't affect existing tables.

### Step 2: Add Environment Variables

```bash
# Add Resend API key
wrangler secret put RESEND_API_KEY
```

Enter your Resend API key when prompted.

### Step 3: Update Dependencies

```bash
# Install nanoid (already in package.json)
npm install
```

### Step 4: Deploy Changes

```bash
# Deploy to Cloudflare Workers
wrangler deploy
```

### Step 5: Verify Installation

Test that everything works:

```bash
curl -X POST https://your-worker.workers.dev/emails/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"to":"your-email@example.com"}'
```

## Integration Points

### Replace Existing Email Code

If you have existing email sending code, replace it with the new service:

**Before:**
```javascript
// Old custom email code
await fetch('https://some-email-service.com/send', {
  method: 'POST',
  body: JSON.stringify({ to, subject, body })
});
```

**After:**
```javascript
import { sendEmail } from './services/email.js';

await sendEmail(env, {
  to,
  subject,
  html: body
});
```

### Add Email Logging

All emails sent through the new service are automatically logged to the `email_logs` table.

### Update Notification System

Integrate email notifications into your existing notification system:

```javascript
// In NotificationDO or notification handler
import { sendNotificationDigest } from './services/email.js';

// When user wants email notifications
if (userPreferences.emailNotifications) {
  await sendNotificationDigest(env, {
    to: user.email,
    name: user.name,
    notifications: pendingNotifications,
    tenantId: user.tenantId,
    period: 'daily'
  });
}
```

### Update Authentication Flow

Add welcome and password reset emails:

```javascript
// After user registration
import { sendWelcomeEmail } from './services/email.js';

await sendWelcomeEmail(env, {
  to: user.email,
  name: user.name,
  tenantName: tenant.name
});

// Password reset
import { sendPasswordResetEmail } from './services/email.js';

await sendPasswordResetEmail(env, {
  to: user.email,
  name: user.name,
  resetLink: `https://app.kira.keyreply.com/reset?token=${token}`,
  expiresIn: '1 hour'
});
```

### Document Processing Integration

Add email notifications when documents are processed:

```javascript
// In queue handler
import { sendDocumentProcessedEmail } from './services/email.js';

async function processDocument(data, env) {
  try {
    // Process document...

    await sendDocumentProcessedEmail(env, {
      to: user.email,
      name: user.name,
      documentName: document.name,
      status: 'success',
      tenantId: tenant.id
    });
  } catch (error) {
    await sendDocumentProcessedEmail(env, {
      to: user.email,
      name: user.name,
      documentName: document.name,
      status: 'failed',
      tenantId: tenant.id
    });
    throw error;
  }
}
```

## Rollback Plan

If you need to rollback:

### 1. Remove Email Routes

In `/src/index.js`:

```javascript
// Comment out these lines:
// import emailsRouter from './routes/emails.js';
// app.route('/emails', emailsRouter);
// app.use('/emails/*', trackApiUsage);
```

### 2. Redeploy

```bash
wrangler deploy
```

### 3. Keep Database Tables

The email_logs table won't affect other functionality. You can keep it or drop it:

```bash
wrangler d1 execute YOUR_DATABASE_NAME \
  --command "DROP TABLE IF EXISTS email_logs"
```

## Backwards Compatibility

The new email service:
- ✅ Doesn't modify existing tables
- ✅ Doesn't break existing routes
- ✅ Uses separate namespace (/emails/*)
- ✅ Requires explicit permission (emails:send)
- ✅ Logs are tenant-scoped

## Testing Checklist

After migration:

- [ ] Send test email via API
- [ ] Check email_logs table has entry
- [ ] Verify email statistics work
- [ ] Test each email template
- [ ] Verify permissions work correctly
- [ ] Check email logs are tenant-scoped
- [ ] Test batch email sending
- [ ] Verify error handling

## Common Issues

### Issue: "RESEND_API_KEY not configured"

**Solution:**
```bash
wrangler secret put RESEND_API_KEY
```

### Issue: "Database not available"

**Solution:**
```bash
# Check wrangler.toml has D1 binding
# Apply schema
wrangler d1 execute YOUR_DATABASE_NAME --file=schema.sql
```

### Issue: "Permission denied"

**Solution:**
Users need `emails:send` permission. Update user permissions:
```sql
UPDATE users
SET permissions = json_array('emails:send', 'emails:view')
WHERE role = 'admin';
```

### Issue: "Cannot find module 'nanoid'"

**Solution:**
```bash
npm install
```

## Performance Considerations

The email service:
- Uses async/non-blocking database logging
- Supports batch sending for efficiency
- Implements indexed database queries
- Minimal impact on request latency

## Security Notes

- Email logs are tenant-scoped
- All admin endpoints require authentication
- Resend API key is stored as Worker secret
- Email addresses are validated
- Rate limiting recommended for production

## Monitoring

Set up monitoring for:

1. **Email send failures**
   ```sql
   SELECT COUNT(*) FROM email_logs WHERE status = 'failed';
   ```

2. **Daily volume**
   ```sql
   SELECT DATE(created_at), COUNT(*)
   FROM email_logs
   WHERE created_at >= datetime('now', '-7 days')
   GROUP BY DATE(created_at);
   ```

3. **Template usage**
   ```sql
   SELECT template, COUNT(*)
   FROM email_logs
   GROUP BY template;
   ```

## Next Steps

1. Configure custom domain in Resend
2. Customize email templates for your brand
3. Set up email event webhooks
4. Implement user email preferences
5. Add rate limiting
6. Set up monitoring alerts
7. Review and adjust permissions

## Support

If you encounter issues:

1. Check the troubleshooting section in EMAIL_SERVICE_README.md
2. Review Resend dashboard for API errors
3. Check Worker logs: `wrangler tail`
4. Verify D1 database state
5. Test with `/emails/test` endpoint

## Conclusion

The email service is designed to integrate seamlessly with your existing PPP Academy setup. All changes are additive and won't affect existing functionality.

**Estimated migration time:** 15-30 minutes

**Risk level:** Low (non-breaking changes)

**Rollback time:** 5 minutes

---

Need help? Review the documentation:
- EMAIL_SERVICE_README.md - Complete documentation
- QUICK_START_EMAIL.md - Quick reference guide
