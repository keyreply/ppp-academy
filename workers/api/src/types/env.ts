/**
 * Worker Environment Bindings
 * Matches wrangler.toml configuration
 */

import type { DurableObjectNamespace, D1Database, R2Bucket, Queue, DispatchNamespace, Fetcher } from '@cloudflare/workers-types';

// Queue message types
import type { DocumentQueueMessage, AnalyticsQueueMessage, EmailQueueMessage } from './queue.ts';

// ============================================
// AI Search Types
// ============================================

/**
 * AI Search filter operators
 */
export interface AISearchComparisonFilter {
  type: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
  key: string;
  value: string | number;
}

export interface AISearchCompoundFilter {
  type: 'and' | 'or';
  filters: AISearchComparisonFilter[];
}

export type AISearchFilter = AISearchComparisonFilter | AISearchCompoundFilter;

/**
 * AI Search search() method options
 */
export interface AISearchSearchOptions {
  query: string;
  filters?: AISearchFilter;
  max_num_results?: number;
  ranking_options?: {
    score_threshold?: number;
  };
  rewrite_query?: boolean;
  reranking?: {
    enabled: boolean;
    model?: string;
  };
}

/**
 * AI Search aiSearch() method options (extends search with generation)
 */
export interface AISearchAISearchOptions extends AISearchSearchOptions {
  model?: string;
  system_prompt?: string;
  stream?: boolean;
}

/**
 * AI Search result item
 */
export interface AISearchResultItem {
  file_id: string;
  filename: string;
  score: number;
  attributes: {
    modified_date: number;
    folder: string;
    context?: string;
  };
  content: Array<{
    id: string;
    type: string;
    text: string;
  }>;
}

/**
 * AI Search response
 */
export interface AISearchResponse {
  object: string;
  search_query: string;
  response?: string; // Only in aiSearch(), not search()
  data: AISearchResultItem[];
  has_more: boolean;
  next_page: string | null;
}

/**
 * AI Search (AutoRAG) instance binding
 */
export interface AISearchInstance {
  search(options: AISearchSearchOptions): Promise<AISearchResponse>;
  aiSearch(options: AISearchAISearchOptions): Promise<AISearchResponse>;
}

/**
 * Extended AI binding with AutoRAG support
 */
export interface AiWithAutoRAG {
  run<T = unknown>(model: string, inputs: Record<string, unknown>, options?: {
    gateway?: {
      id: string;
      skipCache?: boolean;
    };
  }): Promise<T>;
  toMarkdown(options: { file: ArrayBuffer; filename: string }): Promise<{ markdown?: string; text?: string }>;
  autorag(instanceName: string): AISearchInstance;
}

// ============================================
// Legacy Vectorize Types (for migration reference)
// ============================================

/**
 * @deprecated Use AI Search instead
 */
export interface VectorizeIndex {
  query(
    vector: number[],
    options?: {
      topK?: number;
      filter?: Record<string, string | number | boolean>;
      returnValues?: boolean;
      returnMetadata?: boolean;
      namespace?: string;
    }
  ): Promise<VectorizeQueryResult>;
  insert(vectors: VectorizeVector[]): Promise<VectorizeInsertResult>;
  upsert(vectors: VectorizeVector[]): Promise<VectorizeInsertResult>;
  deleteByIds(ids: string[], options?: { namespace?: string }): Promise<VectorizeDeleteResult>;
}

export interface VectorizeVector {
  id: string;
  values: number[];
  namespace?: string;
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

  // Queue bindings
  DOCUMENT_QUEUE: Queue<DocumentQueueMessage>;
  ANALYTICS_QUEUE: Queue<AnalyticsQueueMessage>;
  EMAIL_QUEUE: Queue<EmailQueueMessage>;

  // AI binding with AutoRAG (AI Search) support
  // Access AI Search via: env.AI.autorag('instance-name')
  // AI Gateway configured in wrangler.toml for monitoring/caching
  AI: AiWithAutoRAG;

  // Workers for Platforms (optional - requires subscription)
  DISPATCHER?: DispatchNamespace;

  // Service Binding to Voice Worker
  VOICE_SERVICE: Fetcher;

  // Environment variables
  ENVIRONMENT: 'development' | 'production' | 'staging';
  EMAIL_PROVIDER: 'cloudflare' | 'resend';
  RESEND_API_KEY?: string;
  ACCOUNT_ID: string;
  CLOUDFLARE_API_TOKEN: string;

  // AI Search instance name (for reference)
  AI_SEARCH_INSTANCE?: string;
}
