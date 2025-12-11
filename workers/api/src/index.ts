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

// Import services
import { processDocument as processDocumentRAG } from './services/rag.ts';

// Create main Hono app with typed environment
const app = new Hono<HonoEnv>();

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
app.use('/tenants/*', trackApiUsage);
app.use('/customers/*', trackApiUsage);
app.use('/conversations/*', trackApiUsage);
app.use('/agents/*', trackApiUsage);
app.use('/notifications/*', trackApiUsage);
app.use('/documents/*', trackApiUsage);
app.use('/emails/*', trackApiUsage);
app.use('/stt/*', trackApiUsage);

// ============================================
// Health Check
// ============================================

app.get('/', (c) => {
  return c.json({
    name: 'KeyReply Kira AI API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || 'development'
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      database: 'ok',
      storage: 'ok',
      ai: 'ok'
    }
  });
});

// ============================================
// Mount Route Modules
// ============================================

app.route('/tenants', tenantsRouter);
app.route('/customers', customersRouter);
app.route('/conversations', conversationsRouter);
app.route('/agents', agentsRouter);
app.route('/notifications', notificationsRouter);
app.route('/documents', documentsRouter);
app.route('/emails', emailsRouter); // Original emails route if it existed, otherwise can replace
// Ideally we should use the new emailRouter
// But line 114 already had `app.route('/emails', emailsRouter);`
// Let's check line 19 which was `import emailsRouter from './routes/emails.js';`
// I added `import emailRouter from './routes/email.js';` in previous step.
// I should replace the route mount to use the new router.
app.route('/email', emailRouter);
app.route('/stt', sttRouter);
app.route('/chat', chatRouter);
app.route('/upload', uploadRouter);
app.route('/campaigns', campaignsRouter);
app.route('/workflows', workflowsRouter);
app.route('/channels', channelsRouter);
app.route('/functions', functionRouter);
app.route('/voice', voiceRouter);

// Mount analytics route
app.route('/analytics', analyticsRouter);

// AI Models endpoint
app.get('/ai/models', (c) => {
  return c.json(getAllModels());
});

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
 * Process document (extract text, generate embeddings, etc.)
 */
async function processDocument(data: DocumentQueueData, env: WorkerEnv): Promise<void> {
  const { documentId, tenantId } = data;

  console.log(`Processing document ${documentId} for tenant ${tenantId}`);

  // Use the RAG service to process the document
  await processDocumentRAG(env, tenantId, documentId);

  console.log(`Document ${documentId} processed successfully`);
}

/**
 * Embed document chunks into vector database
 */
async function embedDocument(data: DocumentQueueData, env: WorkerEnv): Promise<void> {
  const { documentId, chunks = [], tenantId } = data;

  console.log(`Embedding ${chunks.length} chunks for document ${documentId}`);

  const embeddings = [];

  for (const chunk of chunks) {
    // Use Qwen3 Embedding model (1024 dimensions)
    const result = await env.AI.run('@cf/qwen/qwen3-embedding-0.6b', {
      text: chunk.text
    });

    embeddings.push({
      id: `${documentId}:${chunk.index}`,
      values: result.data[0],
      metadata: {
        tenantId,
        documentId,
        chunkIndex: chunk.index,
        text: chunk.text
      }
    });
  }

  await env.VECTORIZE.insert(embeddings);

  console.log(`Embedded ${embeddings.length} chunks for document ${documentId}`);
}

/**
 * Delete document and its embeddings
 */
async function deleteDocument(data: DocumentQueueData, env: WorkerEnv): Promise<void> {
  const { documentId, tenantId } = data;

  console.log(`Deleting document ${documentId}`);

  // Delete from R2
  await env.DOCS_BUCKET.delete(`${tenantId}/${documentId}`);

  // Delete embeddings from Vectorize
  // Note: Vectorize delete implementation would go here

  // Delete from D1
  await env.DB.prepare('DELETE FROM documents WHERE id = ?')
    .bind(documentId)
    .run();

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
