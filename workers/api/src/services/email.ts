/**
 * Email Service - Cloudflare Email (default) + Resend (production)
 *
 * Default: Uses Cloudflare Email Workers for sending
 * Production: Set EMAIL_PROVIDER=resend and configure RESEND_API_KEY
 */

import { nanoid } from 'nanoid';

// Email provider configuration
const EMAIL_PROVIDERS = {
  CLOUDFLARE: 'cloudflare',
  RESEND: 'resend'
};

/**
 * Get the configured email provider
 */
function getEmailProvider(env) {
  return env.EMAIL_PROVIDER || EMAIL_PROVIDERS.CLOUDFLARE;
}

/**
 * Send a single email - routes to appropriate provider
 * @param {Object} env - Environment bindings
 * @param {Object} emailData - Email configuration
 * @returns {Object} Send response with email ID
 */
export async function sendEmail(env, { to, subject, html, text, from, replyTo, tags = [] }) {
  const provider = getEmailProvider(env);

  if (provider === EMAIL_PROVIDERS.RESEND) {
    return sendEmailViaResend(env, { to, subject, html, text, from, replyTo, tags });
  }

  // Default: Cloudflare Email
  return sendEmailViaCloudflare(env, { to, subject, html, text, from, replyTo, tags });
}

/**
 * Send email via Cloudflare Email Workers
 * Uses the EMAIL binding configured in wrangler.toml
 */
async function sendEmailViaCloudflare(env, { to, subject, html, text, from, replyTo, tags = [] }) {
  // Default from address
  const fromAddress = from || 'KeyReply <noreply@keyreply.com>';
  const toAddress = Array.isArray(to) ? to[0] : to; // Cloudflare sends one at a time

  // Build email message
  const message = {
    from: fromAddress,
    to: toAddress,
    subject,
    content: html ? [
      { type: 'text/plain', value: text || stripHtml(html) },
      { type: 'text/html', value: html }
    ] : [
      { type: 'text/plain', value: text }
    ]
  };

  // Add reply-to if provided
  if (replyTo) {
    message.replyTo = replyTo;
  }

  try {
    // Check if EMAIL binding exists (Cloudflare Email Workers)
    if (env.EMAIL) {
      // Using Cloudflare Email Workers binding
      await env.EMAIL.send(message);

      const emailId = `cf_${nanoid()}`;
      return {
        success: true,
        id: emailId,
        provider: 'cloudflare',
        message: 'Email sent via Cloudflare Email'
      };
    }

    // Fallback: Use MailChannels API (free for Cloudflare Workers)
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: toAddress }],
            ...(replyTo && { reply_to: { email: replyTo } })
          }
        ],
        from: { email: extractEmail(fromAddress), name: extractName(fromAddress) },
        subject,
        content: html ? [
          { type: 'text/plain', value: text || stripHtml(html) },
          { type: 'text/html', value: html }
        ] : [
          { type: 'text/plain', value: text }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MailChannels error: ${response.status} - ${errorText}`);
    }

    const emailId = `mc_${nanoid()}`;
    return {
      success: true,
      id: emailId,
      provider: 'mailchannels',
      message: 'Email sent via MailChannels'
    };
  } catch (error) {
    console.error('Cloudflare email send error:', error);
    throw error;
  }
}

/**
 * Send email via Resend API (for production use)
 */
async function sendEmailViaResend(env, { to, subject, html, text, from, replyTo, tags = [] }) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured. Set EMAIL_PROVIDER=cloudflare or add RESEND_API_KEY secret.');
  }

  // Default from address
  const fromAddress = from || 'KeyReply <noreply@keyreply.com>';

  // Prepare email payload
  const payload = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text: text || stripHtml(html),
    tags: tags.length > 0 ? tags : undefined,
    reply_to: replyTo || undefined
  };

  try {
    // Send via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Resend API error: ${data.message || response.statusText}`);
    }

    return {
      success: true,
      id: data.id,
      provider: 'resend',
      message: 'Email sent via Resend'
    };
  } catch (error) {
    console.error('Resend email send error:', error);
    throw error;
  }
}

/**
 * Send batch emails - routes to appropriate provider
 * @param {Object} env - Environment bindings
 * @param {Array} emails - Array of email objects
 * @returns {Object} Batch send results
 */
export async function sendBatchEmails(env, emails) {
  const provider = getEmailProvider(env);

  if (provider === EMAIL_PROVIDERS.RESEND) {
    return sendBatchEmailsViaResend(env, emails);
  }

  // Default: Cloudflare - send individually (no native batch support)
  return sendBatchEmailsViaCloudflare(env, emails);
}

/**
 * Send batch emails via Cloudflare (sends individually)
 */
async function sendBatchEmailsViaCloudflare(env, emails) {
  const results = [];
  const errors = [];

  for (const email of emails) {
    try {
      const result = await sendEmailViaCloudflare(env, email);
      results.push({ ...result, to: email.to });
    } catch (error) {
      errors.push({ to: email.to, error: error.message });
    }
  }

  return {
    success: errors.length === 0,
    provider: 'cloudflare',
    sent: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined,
    message: `${results.length} emails sent, ${errors.length} failed`
  };
}

/**
 * Send batch emails via Resend API
 */
async function sendBatchEmailsViaResend(env, emails) {
  if (!env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }

  // Prepare batch payload
  const payload = emails.map(email => ({
    from: email.from || 'KeyReply <noreply@keyreply.com>',
    to: Array.isArray(email.to) ? email.to : [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text || stripHtml(email.html),
    tags: email.tags || [],
    reply_to: email.replyTo || undefined
  }));

  try {
    const response = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Resend batch API error: ${data.message || response.statusText}`);
    }

    return {
      success: true,
      provider: 'resend',
      results: data.data,
      message: `${data.data.length} emails sent successfully`
    };
  } catch (error) {
    console.error('Batch email send error:', error);
    throw error;
  }
}

/**
 * Send welcome email to new user
 */
export async function sendWelcomeEmail(env, { to, name, tenantName }) {
  const subject = `Welcome to ${tenantName || 'KeyReply'}!`;
  const html = getEmailTemplate('welcome', { name, tenantName });

  const result = await sendEmail(env, {
    to,
    subject,
    html,
    tags: ['welcome', 'onboarding']
  });

  // Log email
  await logEmailSent(env, null, {
    to,
    subject,
    template: 'welcome',
    provider: result.provider,
    externalId: result.id,
    metadata: { name, tenantName }
  });

  return result;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(env, { to, name, resetLink, expiresIn = '1 hour' }) {
  const subject = 'Reset Your Password - KeyReply';
  const html = getEmailTemplate('password-reset', { name, resetLink, expiresIn });

  const result = await sendEmail(env, {
    to,
    subject,
    html,
    tags: ['password-reset', 'security']
  });

  // Log email
  await logEmailSent(env, null, {
    to,
    subject,
    template: 'password-reset',
    provider: result.provider,
    externalId: result.id,
    metadata: { name, expiresIn }
  });

  return result;
}

/**
 * Send team invitation email
 */
export async function sendInvitationEmail(env, { to, inviterName, tenantName, inviteLink, role }) {
  const subject = `${inviterName} invited you to join ${tenantName}`;
  const html = getEmailTemplate('invitation', { inviterName, tenantName, inviteLink, role });

  const result = await sendEmail(env, {
    to,
    subject,
    html,
    tags: ['invitation', 'team']
  });

  // Log email
  await logEmailSent(env, null, {
    to,
    subject,
    template: 'invitation',
    provider: result.provider,
    externalId: result.id,
    metadata: { inviterName, tenantName, role }
  });

  return result;
}

/**
 * Send document processed notification
 */
export async function sendDocumentProcessedEmail(env, { to, name, documentName, status, tenantId }) {
  const subject = status === 'success'
    ? `Document Ready: ${documentName}`
    : `Document Processing Failed: ${documentName}`;
  const html = getEmailTemplate('document-processed', { name, documentName, status });

  const result = await sendEmail(env, {
    to,
    subject,
    html,
    tags: ['document', 'notification']
  });

  // Log email
  await logEmailSent(env, tenantId, {
    to,
    subject,
    template: 'document-processed',
    provider: result.provider,
    externalId: result.id,
    metadata: { name, documentName, status }
  });

  return result;
}

/**
 * Send notification digest email
 */
export async function sendNotificationDigest(env, { to, name, notifications, tenantId, period = 'daily' }) {
  const subject = `Your ${period} notification digest - KeyReply`;
  const html = getEmailTemplate('notification-digest', { name, notifications, period });

  const result = await sendEmail(env, {
    to,
    subject,
    html,
    tags: ['digest', 'notification', period]
  });

  // Log email
  await logEmailSent(env, tenantId, {
    to,
    subject,
    template: 'notification-digest',
    provider: result.provider,
    externalId: result.id,
    metadata: { name, notificationCount: notifications.length, period }
  });

  return result;
}

/**
 * Get email template HTML
 * @param {string} templateName - Template identifier
 * @param {Object} data - Template data
 * @returns {string} HTML template string
 */
export function getEmailTemplate(templateName, data) {
  const templates = {
    'welcome': generateWelcomeTemplate(data),
    'password-reset': generatePasswordResetTemplate(data),
    'invitation': generateInvitationTemplate(data),
    'document-processed': generateDocumentProcessedTemplate(data),
    'notification-digest': generateNotificationDigestTemplate(data)
  };

  return templates[templateName] || generateGenericTemplate(data);
}

/**
 * Log email to D1 database
 */
export async function logEmailSent(env, tenantId, emailData) {
  if (!env.DB) {
    console.warn('Database not available for email logging');
    return;
  }

  const id = nanoid();

  try {
    await env.DB.prepare(
      `INSERT INTO email_logs (
        id, tenant_id, to_address, from_address, subject,
        template, status, resend_id, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .bind(
      id,
      tenantId,
      emailData.to,
      emailData.from || 'KeyReply <noreply@keyreply.com>',
      emailData.subject,
      emailData.template || 'custom',
      'sent',
      emailData.externalId || null,
      JSON.stringify({
        ...emailData.metadata,
        provider: emailData.provider
      })
    )
    .run();
  } catch (error) {
    console.error('Failed to log email:', error);
  }
}

/**
 * Get current email provider info
 */
export function getEmailProviderInfo(env) {
  const provider = getEmailProvider(env);
  return {
    provider,
    configured: provider === EMAIL_PROVIDERS.RESEND
      ? !!env.RESEND_API_KEY
      : true, // Cloudflare is always available
    description: provider === EMAIL_PROVIDERS.RESEND
      ? 'Resend API (production)'
      : 'Cloudflare Email / MailChannels (development)'
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract email from "Name <email>" format
 */
function extractEmail(address) {
  const match = address.match(/<(.+)>/);
  return match ? match[1] : address;
}

/**
 * Extract name from "Name <email>" format
 */
function extractName(address) {
  const match = address.match(/^(.+?)\s*</);
  return match ? match[1].trim() : '';
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================
// Email Template Functions
// ============================================

/**
 * Generate welcome email template
 */
function generateWelcomeTemplate({ name, tenantName }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${tenantName || 'KeyReply'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Welcome to ${tenantName || 'KeyReply'}!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi ${name || 'there'},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                We're thrilled to have you join ${tenantName || 'KeyReply'}! Your account has been created successfully, and you're all set to get started.
              </p>
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #333333;">
                Here's what you can do next:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                <tr>
                  <td style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; margin-bottom: 10px;">
                    <strong style="color: #667eea; font-size: 16px;">Explore the Academy</strong>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Access your learning materials and resources</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; margin-top: 10px;">
                    <strong style="color: #667eea; font-size: 16px;">Connect with AI Agents</strong>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Start conversations and get instant support</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; margin-top: 10px;">
                    <strong style="color: #667eea; font-size: 16px;">Upload Documents</strong>
                    <p style="margin: 5px 0 0; font-size: 14px; color: #666;">Share files and let AI help you process them</p>
                  </td>
                </tr>
              </table>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.keyreply.com/dashboard" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Get Started
                </a>
              </div>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                If you have any questions, feel free to reach out to our support team. We're here to help!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                KeyReply. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This email was sent to you as part of your account registration.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate password reset email template
 */
function generatePasswordResetTemplate({ name, resetLink, expiresIn }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #667eea; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Reset Your Password
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi ${name || 'there'},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Reset Password
                </a>
              </div>

              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #856404;">
                  <strong>This link expires in ${expiresIn}</strong><br>
                  For security reasons, this password reset link will only work once and will expire after ${expiresIn}.
                </p>
              </div>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #667eea; word-break: break-all;">
                ${resetLink}
              </p>

              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #721c24;">
                  <strong>Security Notice</strong><br>
                  If you didn't request this password reset, please ignore this email or contact support if you have concerns. Your password will remain unchanged.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                KeyReply. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This is an automated security email. Please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate invitation email template
 */
function generateInvitationTemplate({ inviterName, tenantName, inviteLink, role }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                You're Invited!
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi there,
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                <strong>${inviterName}</strong> has invited you to join <strong>${tenantName}</strong> on KeyReply!
              </p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0;">
                      <strong style="color: #667eea; font-size: 14px;">Organization:</strong>
                      <p style="margin: 5px 0 0; font-size: 16px; color: #333;">${tenantName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <strong style="color: #667eea; font-size: 14px;">Your Role:</strong>
                      <p style="margin: 5px 0 0; font-size: 16px; color: #333;">${role || 'Member'}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <strong style="color: #667eea; font-size: 14px;">Invited by:</strong>
                      <p style="margin: 5px 0 0; font-size: 16px; color: #333;">${inviterName}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                By accepting this invitation, you'll get access to:
              </p>
              <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #666666; line-height: 1.8;">
                <li>Team collaboration tools</li>
                <li>Shared AI agents and conversations</li>
                <li>Document library and resources</li>
                <li>Real-time notifications and updates</li>
              </ul>

              <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="margin: 10px 0 0; font-size: 12px; color: #667eea; word-break: break-all;">
                ${inviteLink}
              </p>

              <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #721c24;">
                  If you weren't expecting this invitation or don't want to join, you can safely ignore this email.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                KeyReply. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This invitation was sent by ${inviterName}.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate document processed email template
 */
function generateDocumentProcessedTemplate({ name, documentName, status }) {
  const isSuccess = status === 'success';
  const headerColor = isSuccess ? '#10b981' : '#ef4444';
  const statusIcon = isSuccess ? 'Ready' : 'Failed';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document ${statusIcon}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${headerColor}; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Document ${statusIcon}
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi ${name || 'there'},
              </p>
              <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
                ${isSuccess
                  ? `Your document has been processed successfully and is now ready to use!`
                  : `We encountered an issue processing your document. Please try uploading it again or contact support if the problem persists.`
                }
              </p>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <strong style="color: #667eea; font-size: 14px;">Document Name:</strong>
                <p style="margin: 5px 0 0; font-size: 16px; color: #333;">${documentName}</p>
              </div>

              ${isSuccess ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.keyreply.com/documents" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View Document
                </a>
              </div>

              <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
                You can now:
              </p>
              <ul style="margin: 10px 0; padding-left: 20px; font-size: 14px; color: #666666; line-height: 1.8;">
                <li>Ask questions about the document content</li>
                <li>Search within the document</li>
                <li>Share it with your team</li>
                <li>Use it in AI conversations</li>
              </ul>
              ` : `
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.keyreply.com/documents/upload" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Try Again
                </a>
              </div>
              `}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                KeyReply. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                This is an automated notification email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate notification digest email template
 */
function generateNotificationDigestTemplate({ name, notifications, period }) {
  const notificationsList = notifications.map(notif => `
    <tr>
      <td style="padding: 15px; border-bottom: 1px solid #e0e0e0;">
        <strong style="color: #333; font-size: 15px;">${notif.title || 'Notification'}</strong>
        <p style="margin: 5px 0 0; font-size: 14px; color: #666; line-height: 1.5;">
          ${notif.message || notif.body}
        </p>
        <p style="margin: 8px 0 0; font-size: 12px; color: #999;">
          ${notif.created_at ? new Date(notif.created_at).toLocaleString() : ''}
        </p>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification Digest</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                Your ${period.charAt(0).toUpperCase() + period.slice(1)} Digest
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                ${notifications.length} new notification${notifications.length !== 1 ? 's' : ''}
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #333333;">
                Hi ${name || 'there'},
              </p>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                ${notificationsList}
              </table>

              <div style="text-align: center; margin: 30px 0;">
                <a href="https://app.keyreply.com/notifications" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  View All Notifications
                </a>
              </div>

              <div style="background-color: #f8f9fa; border-radius: 8px; padding: 15px; margin: 30px 0;">
                <p style="margin: 0; font-size: 13px; color: #666;">
                  <strong>Tip:</strong> You can customize your notification preferences in your account settings.
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                KeyReply. All rights reserved.
              </p>
              <p style="margin: 0; font-size: 12px; color: #999999;">
                You're receiving this because you have notification digests enabled.<br>
                <a href="https://app.keyreply.com/settings/notifications" style="color: #667eea; text-decoration: none;">
                  Manage preferences
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Generate generic email template
 */
function generateGenericTemplate({ subject, body, actionUrl, actionText }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject || 'KeyReply'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #667eea; padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                KeyReply
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <div style="font-size: 16px; line-height: 1.6; color: #333333;">
                ${body || ''}
              </div>

              ${actionUrl && actionText ? `
              <div style="text-align: center; margin: 30px 0;">
                <a href="${actionUrl}" style="display: inline-block; padding: 14px 32px; background-color: #667eea; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  ${actionText}
                </a>
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0 0 10px; font-size: 14px; color: #999999;">
                KeyReply. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}
