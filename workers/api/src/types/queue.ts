/**
 * Queue Message Types
 */

/**
 * Document processing queue message
 */
export interface DocumentQueueMessage {
  type: 'document.process' | 'document.embed' | 'document.delete';
  data: DocumentQueueData;
}

export interface DocumentQueueData {
  documentId: string;
  tenantId: string;
  userId?: string;
  filename?: string;
  mimeType?: string;
  r2Key?: string;
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  index: number;
  text: string;
}

/**
 * Analytics queue message
 */
export interface AnalyticsQueueMessage {
  id?: string;
  tenant_id: string;
  event_type: string;
  category?: string;
  label?: string;
  value?: number;
  occurred_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Email queue message
 */
export interface EmailQueueMessage {
  to: string;
  subject: string;
  template?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  logId?: string;
  html?: string;
}

/**
 * Queue message wrapper with retry info
 */
export interface QueueMessage<T> {
  body: T;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
  attempts: number;
}

/**
 * Queue batch
 */
export interface QueueBatch<T> {
  queue: string;
  messages: QueueMessage<T>[];
}
