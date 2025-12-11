/**
 * Worker Environment Bindings
 * Matches wrangler.toml configuration
 */

import type { DurableObjectNamespace, D1Database, R2Bucket, Queue, Ai, DispatchNamespace, Fetcher } from '@cloudflare/workers-types';

// Queue message types
import type { DocumentQueueMessage, AnalyticsQueueMessage, EmailQueueMessage } from './queue.ts';

/**
 * Vectorize index binding type
 */
export interface VectorizeIndex {
  query(
    vector: number[],
    options?: {
      topK?: number;
      filter?: Record<string, string | number | boolean>;
      returnValues?: boolean;
      returnMetadata?: boolean;
    }
  ): Promise<VectorizeQueryResult>;
  insert(vectors: VectorizeVector[]): Promise<VectorizeInsertResult>;
  upsert(vectors: VectorizeVector[]): Promise<VectorizeInsertResult>;
  deleteByIds(ids: string[]): Promise<VectorizeDeleteResult>;
}

export interface VectorizeVector {
  id: string;
  values: number[];
  metadata?: Record<string, string | number | boolean>;
}

export interface VectorizeQueryResult {
  matches: Array<{
    id: string;
    score: number;
    values?: number[];
    metadata?: Record<string, string | number | boolean>;
  }>;
  count: number;
}

export interface VectorizeInsertResult {
  count: number;
  ids: string[];
}

export interface VectorizeDeleteResult {
  count: number;
}

/**
 * Main Worker Environment interface
 */
export interface WorkerEnv {
  // Durable Object bindings
  TENANT: DurableObjectNamespace;
  CUSTOMER: DurableObjectNamespace;
  CONVERSATION: DurableObjectNamespace;
  RATE_LIMITER: DurableObjectNamespace;
  AGENT: DurableObjectNamespace;
  NOTIFICATION: DurableObjectNamespace;
  WORKFLOW: DurableObjectNamespace;
  ANALYTICS: DurableObjectNamespace;
  CAMPAIGN: DurableObjectNamespace;

  // Storage bindings
  DB: D1Database;
  DOCS_BUCKET: R2Bucket;
  VECTORIZE: VectorizeIndex;

  // Queue bindings
  DOCUMENT_QUEUE: Queue<DocumentQueueMessage>;
  ANALYTICS_QUEUE: Queue<AnalyticsQueueMessage>;
  EMAIL_QUEUE: Queue<EmailQueueMessage>;

  // AI binding
  AI: Ai;

  // Workers for Platforms (optional - requires subscription)
  DISPATCHER?: DispatchNamespace;

  // Service Binding to Voice Worker
  VOICE_SERVICE: Fetcher;

  // Environment variables
  ENVIRONMENT: 'development' | 'production';
  EMAIL_PROVIDER: 'cloudflare' | 'resend';
  RESEND_API_KEY?: string;
  ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;
}
