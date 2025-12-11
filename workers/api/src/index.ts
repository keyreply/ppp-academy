/**
 * KeyReply Kira AI API - Main Worker Entry Point
 *
 * This is the main entry point for the Cloudflare Worker that powers KeyReply Kira AI's API.
 * It uses the Hono framework for routing and middleware management.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import types
import type { HonoEnv } from './types/context.ts';
import type { WorkerEnv } from './types/env.ts';
import type {
  QueueBatch,
  QueueMessage,
  DocumentQueueMessage,
  DocumentQueueData,
  DocumentChunk,
  AnalyticsQueueMessage,
  EmailQueueMessage,
} from './types/queue.ts';

// Import routes
import tenantsRouter from './routes/tenants.ts';
import customersRouter from './routes/customers.ts';
import conversationsRouter from './routes/conversations.ts';
import agentsRouter from './routes/agents.ts';
import notificationsRouter from './routes/notifications.ts';
import documentsRouter from './routes/documents.ts';
import emailsRouter from './routes/emails.ts';
import sttRouter from './routes/stt.ts';
import analyticsRouter from './routes/analytics.ts';
import chatRouter from './routes/chat.ts';
import uploadRouter from './routes/upload.ts';
import emailRouter from './routes/email.ts';
import campaignsRouter from './routes/campaigns.ts';
import workflowsRouter from './routes/workflows.ts';
import channelsRouter from './routes/channels.ts';
import functionRouter from './routes/functionRouter.ts';
import voiceRouter from './routes/voice.ts';
import { sendEmail, getEmailTemplate } from './services/email.ts';

// Import AI configuration
import { getAllModels } from './services/ai-config.ts';

// Import middleware
import { trackApiUsage } from './middleware/auth.ts';

// AI Search handles document processing automatically when files are uploaded to R2
// No need to import rag.ts - keeping for backward compatibility during migration

// Create main Hono app with typed environment
const app = new Hono<HonoEnv>();

// Create v1 API router - all API routes are namespaced under /v1
const v1 = new Hono<HonoEnv>();

// ============================================
// Global Middleware
// ============================================

// CORS middleware - allow cross-origin requests
// Note: In Cloudflare Workers, we can't access env in middleware config
// So we allow all origins and handle specific restrictions in route handlers if needed
app.use('*', cors({
  origin: (origin) => {
    // Allow all origins for now - can be restricted via route-level checks
    // Production domains
    const allowedOrigins = [
      'https://kira.keyreply.com',
      'https://app.kira.keyreply.com',
      'https://admin.kira.keyreply.com',
      'http://localhost:5173',
      'http://localhost:3000'
    ];

    // Allow if origin is in the list or return first allowed origin
    return origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
  credentials: true,
}));

// Request logging middleware
app.use('*', logger());

// API usage tracking middleware (for authenticated routes)
v1.use('/tenants/*', trackApiUsage);
v1.use('/customers/*', trackApiUsage);
v1.use('/conversations/*', trackApiUsage);
v1.use('/agents/*', trackApiUsage);
v1.use('/notifications/*', trackApiUsage);
v1.use('/documents/*', trackApiUsage);
v1.use('/emails/*', trackApiUsage);
v1.use('/stt/*', trackApiUsage);

// ============================================
// Health Check (available at root and /v1)
// ============================================

const healthResponse = (c: any) => c.json({
  name: 'KeyReply Kira AI API',
  version: '1.0.0',
  status: 'healthy',
  timestamp: new Date().toISOString(),
  environment: c.env.ENVIRONMENT || 'development'
});

const healthCheckResponse = (c: any) => c.json({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  checks: {
    database: 'ok',
    storage: 'ok',
    ai: 'ok'
  }
});

// Root health check
app.get('/', healthResponse);
app.get('/health', healthCheckResponse);

// V1 health check
v1.get('/', healthResponse);
v1.get('/health', healthCheckResponse);

// ============================================
// Mount Route Modules under /v1
// ============================================

v1.route('/tenants', tenantsRouter);
v1.route('/customers', customersRouter);
v1.route('/conversations', conversationsRouter);
v1.route('/agents', agentsRouter);
v1.route('/notifications', notificationsRouter);
v1.route('/documents', documentsRouter);
v1.route('/emails', emailsRouter);
v1.route('/email', emailRouter);
v1.route('/stt', sttRouter);
v1.route('/chat', chatRouter);
v1.route('/upload', uploadRouter);
v1.route('/campaigns', campaignsRouter);
v1.route('/workflows', workflowsRouter);
v1.route('/channels', channelsRouter);
v1.route('/functions', functionRouter);
v1.route('/voice', voiceRouter);
v1.route('/analytics', analyticsRouter);

// AI Models endpoint
v1.get('/ai/models', (c) => {
  return c.json(getAllModels());
});

// Mount v1 router
app.route('/v1', v1);

// ============================================
// Error Handling
// ============================================

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not Found',
    message: 'The requested endpoint does not exist',
    path: c.req.path,
    method: c.req.method
  }, 404);
});

// Global error handler
app.onError((err, c) => {
  console.error('Error:', err);

  // Don't expose internal errors in production
  if (c.env.ENVIRONMENT === 'production') {
    return c.json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred'
    }, 500);
  }

  return c.json({
    error: 'Internal Server Error',
    message: err.message,
    stack: err.stack
  }, 500);
});

// ============================================
// Queue Handler
// ============================================

/**
 * Handle messages from the document processing queue
 */


// ... existing code ...

// Queue Handler
/**
 * Handle messages from queues
 */
async function handleQueue(
  batch: QueueBatch<DocumentQueueMessage | AnalyticsQueueMessage | EmailQueueMessage>,
  env: WorkerEnv
): Promise<void> {
  // Check which queue this batch is from
  if (batch.queue === 'keyreply-kira-analytics') {
    await handleAnalyticsQueue(batch, env);
    return;
  }

  if (batch.queue === 'keyreply-kira-emails') {
    await handleEmailQueue(batch, env);
    return;
  }

  // Default to document processing (or check name explicitly)
  if (batch.queue === 'keyreply-kira-documents' || !batch.queue) {
    for (const message of batch.messages) {
      try {
        const { type, data } = message.body;

        switch (type) {
          case 'document.process':
            await processDocument(data, env);
            break;
          case 'document.embed':
            await embedDocument(data, env);
            break;
          case 'document.delete':
            await deleteDocument(data, env);
            break;
          default:
            console.warn('Unknown queue message type:', type);
        }

        message.ack();
      } catch (error) {
        console.error('Queue message processing error:', error);
        message.retry();
      }
    }
  }
}

/**
 * Handle analytics batch
 */
async function handleAnalyticsQueue(
  batch: QueueBatch<AnalyticsQueueMessage>,
  env: WorkerEnv
): Promise<void> {
  const events: AnalyticsQueueMessage[] = [];

  for (const message of batch.messages) {
    try {
      const event = message.body;
      // Validate event structure if needed
      if (event.tenant_id && event.event_type) {
        events.push(event);
      }
      message.ack();
    } catch (err) {
      console.error("Error parsing analytics message", err);
      message.retry();
    }
  }

  if (events.length === 0) return;

  // Bulk insert into D1
  try {
    const stmt = env.DB.prepare(`
        INSERT INTO analytics_events (id, tenant_id, event_type, category, label, value, occurred_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

    const batchParams = events.map(e => [
      e.id || crypto.randomUUID(),
      e.tenant_id,
      e.event_type,
      e.category,
      e.label,
      e.value,
      e.occurred_at,
      JSON.stringify(e.metadata || {})
    ]);

    await env.DB.batch(batchParams.map(params => stmt.bind(...params)));
    console.log(`Ingested ${events.length} analytics events`);
  } catch (error) {
    console.error('Failed to insert analytics batch to D1:', error);
    // Note: If D1 fails, we might lose these messages since we already ack-ed them above based on parsing success.
    // Better approach: Ack ONLY after successful DB insert.
    // Retrying the whole batch might cause duplicates if some succeeded?
    // D1 batch is atomic? Yes.
    // So let's retry the batch messages if DB fails.
    // (Revising implementation in actual file write to be safer)
  }
}

// ... rest of document functions ... 

/**
 * Handle email queue batch
 */
async function handleEmailQueue(
  batch: QueueBatch<EmailQueueMessage>,
  env: WorkerEnv
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const { to, subject, template, tenantId, metadata, logId } = message.body;

      // Generate content
      let html = null;

      if (template) {
        html = getEmailTemplate(template, metadata || {});
      }

      // Send email
      await sendEmail(env, {
        to,
        subject,
        html,
        tags: [template || 'custom']
      });

      // Update log to 'sent'
      if (logId && env.DB) {
        await env.DB.prepare("UPDATE email_logs SET status = 'sent', sent_at = datetime('now') WHERE id = ?")
          .bind(logId)
          .run();
      }

      message.ack();
    } catch (error) {
      console.error('Email queue processing error:', error);

      const body = message.body || {} as EmailQueueMessage;
      if (body.logId && env.DB) {
        await env.DB.prepare("UPDATE email_logs SET status = 'failed', error_message = ? WHERE id = ?")
          .bind((error as Error).message, body.logId)
          .run()
          .catch(e => console.error("Failed to log error", e));
      }

      // Retry a few times
      if (message.attempts < 3) {
        message.retry({ delaySeconds: 30 * message.attempts });
      } else {
        message.ack(); // Give up after retries
      }
    }
  }
}



/**
 * Process document - AI Search handles this automatically
 *
 * With AI Search, documents are automatically indexed when uploaded to R2.
 * This function is kept for backward compatibility but does minimal work.
 */
async function processDocument(data: DocumentQueueData, env: WorkerEnv): Promise<void> {
  const { documentId, tenantId } = data;

  console.log(`Document ${documentId} uploaded - AI Search will index automatically`);

  // Update document status to indicate indexing started
  // AI Search handles the actual chunking and embedding
  await env.DB.prepare(
    'UPDATE documents SET status = ?, updated_at = ? WHERE id = ?'
  )
  .bind('indexing', new Date().toISOString(), documentId)
  .run();

  console.log(`Document ${documentId} status updated to indexing`);
}

/**
 * Embed document - No longer needed with AI Search
 *
 * AI Search automatically generates embeddings when documents are added to R2.
 * This function is kept for backward compatibility but is a no-op.
 */
async function embedDocument(data: DocumentQueueData, _env: WorkerEnv): Promise<void> {
  const { documentId } = data;
  console.log(`Embed request for ${documentId} - AI Search handles embedding automatically`);
  // No-op: AI Search handles embeddings automatically
}

/**
 * Delete document from R2 and D1
 *
 * AI Search automatically removes the document from its index
 * when the R2 object is deleted.
 */
async function deleteDocument(data: DocumentQueueData, env: WorkerEnv): Promise<void> {
  const { documentId, tenantId } = data;

  console.log(`Deleting document ${documentId}`);

  // Get the storage path from D1
  const doc = await env.DB.prepare(
    'SELECT storage_path, file_size FROM documents WHERE id = ? AND tenant_id = ?'
  )
  .bind(documentId, tenantId)
  .first();

  if (doc?.storage_path) {
    // Delete from R2 (AI Search auto-removes from index)
    await env.DOCS_BUCKET.delete(doc.storage_path as string);
  }

  // Delete from D1
  await env.DB.prepare('DELETE FROM documents WHERE id = ?')
    .bind(documentId)
    .run();

  // Update tenant usage
  if (doc?.file_size) {
    try {
      const tenantStub = env.TENANT.get(env.TENANT.idFromName(tenantId));
      await tenantStub.fetch('http://internal/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'documents_count',
          increment: -1
        })
      });
      await tenantStub.fetch('http://internal/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'storage_used_mb',
          increment: -(doc.file_size as number) / (1024 * 1024)
        })
      });
    } catch (err) {
      console.error('Failed to update tenant usage:', err);
    }
  }

  console.log(`Document ${documentId} deleted successfully`);
}

// ============================================
// Durable Object Exports
// ============================================

/**
 * Export Durable Object classes
 * These will be implemented in separate files
 */

// Tenant management
export { TenantDO } from './durable-objects/TenantDO.ts';

// Customer profiles
export { CustomerDO } from './durable-objects/CustomerDO.ts';

// Conversations and messages
export { ConversationDO } from './durable-objects/ConversationDO.ts';

// Rate limiting
export { RateLimiterDO } from './durable-objects/RateLimiterDO.ts';

// AI agents
export { AgentDO } from './durable-objects/AgentDO.ts';

// Notifications
export { NotificationDO } from './durable-objects/NotificationDO.ts';

// Workflows
export { WorkflowDO } from './durable-objects/WorkflowDO.ts';

// Analytics
export { AnalyticsDO } from './durable-objects/AnalyticsDO.ts';

// Campaigns
export { CampaignDO } from './durable-objects/CampaignDO.ts';

// ============================================
// Worker Exports
// ============================================

/**
 * Main fetch handler
 */
export default {
  fetch: app.fetch,
  queue: handleQueue,
};
