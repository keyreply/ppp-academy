/**
 * AI Search Service
 *
 * Cloudflare AI Search integration with:
 * - Automatic document chunking and embedding
 * - Folder-based multitenancy for tenant isolation
 * - Similarity cache for repeated queries
 * - AI Gateway for monitoring and rate limiting
 *
 * Documents are organized in R2 as: {tenantId}/documents/{filename}
 * AI Search automatically indexes R2 bucket content.
 */

import { nanoid } from 'nanoid';
import type { WorkerEnv } from '../types/env.ts';

// AI Search instance name (must match wrangler AI Search creation)
const AI_SEARCH_INSTANCE = 'keyreply-kira-search';

// ============================================
// Types
// ============================================

export interface AISearchResult {
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

export interface AISearchResponse {
  object: string;
  search_query: string;
  response?: string; // Only present in aiSearch(), not search()
  data: AISearchResult[];
  has_more: boolean;
  next_page: string | null;
}

export interface SearchOptions {
  limit?: number;
  minScore?: number;
  documentIds?: string[];
  rewriteQuery?: boolean;
  reranking?: boolean;
}

export interface RAGOptions extends SearchOptions {
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface UploadResult {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: 'indexing';
  r2Key: string;
  createdAt: string;
}

// ============================================
// Folder Path Utilities
// ============================================

/**
 * Get the R2 folder path for a tenant's documents
 */
export function getTenantFolder(tenantId: string): string {
  return `${tenantId}/documents/`;
}

/**
 * Get the full R2 key for a document
 */
export function getDocumentKey(tenantId: string, filename: string): string {
  return `${tenantId}/documents/${filename}`;
}

/**
 * Create a folder filter for recursive tenant search
 * Uses gt/lte compound filter for "starts with" behavior
 */
export function createTenantFilter(tenantId: string) {
  const folderPath = getTenantFolder(tenantId);
  return {
    type: 'and' as const,
    filters: [
      { type: 'gt' as const, key: 'folder', value: `${folderPath}/` },
      { type: 'lte' as const, key: 'folder', value: `${folderPath}z` }
    ]
  };
}

/**
 * Create a filter for specific document by filename
 */
export function createDocumentFilter(tenantId: string, filename: string) {
  return {
    type: 'eq' as const,
    key: 'filename',
    value: `${tenantId}/documents/${filename}`
  };
}

// ============================================
// Upload & Indexing
// ============================================

/**
 * Upload document to R2 for AI Search indexing
 * AI Search automatically indexes new R2 objects
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID for folder isolation
 * @param file - File object from multipart form
 * @param metadata - Additional metadata
 */
export async function uploadDocument(
  env: WorkerEnv,
  tenantId: string,
  file: File,
  metadata: Record<string, string> = {}
): Promise<UploadResult> {
  const documentId = nanoid();
  const timestamp = new Date().toISOString();

  // Validate file
  if (!file || !file.name) {
    throw new Error('Invalid file');
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024 / 1024}MB`);
  }

  // Validate file type
  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/csv',
    'application/json'
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(`File type ${file.type} is not supported`);
  }

  // Generate unique filename with documentId prefix
  const filename = `${documentId}_${file.name}`;
  const r2Key = getDocumentKey(tenantId, filename);

  // Store file in R2 with context metadata for AI Search
  const fileBuffer = await file.arrayBuffer();

  await env.DOCS_BUCKET.put(r2Key, fileBuffer, {
    customMetadata: {
      // AI Search uses 'context' field for additional LLM context
      context: metadata.description || `Document: ${file.name}`,
      tenantId,
      documentId,
      originalName: file.name,
      mimeType: file.type,
      uploadedAt: timestamp,
      ...metadata
    }
  });

  // Store document metadata in D1 (for listing/management)
  await env.DB.prepare(
    `INSERT INTO documents (
      id, tenant_id, user_id, filename, mime_type, file_size,
      storage_path, status, metadata, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  .bind(
    documentId,
    tenantId,
    metadata.userId || null,
    file.name,
    file.type,
    file.size,
    r2Key,
    'indexing', // AI Search handles processing
    JSON.stringify(metadata),
    timestamp,
    timestamp
  )
  .run();

  // Update tenant usage via TenantDO
  try {
    const tenantStub = env.TENANT.get(env.TENANT.idFromName(tenantId));
    await tenantStub.fetch('http://internal/usage/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'documents_count',
        increment: 1
      })
    });

    const fileSizeMB = file.size / (1024 * 1024);
    await tenantStub.fetch('http://internal/usage/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'storage_used_mb',
        increment: fileSizeMB
      })
    });
  } catch (err) {
    console.error('Failed to update tenant usage:', err);
  }

  return {
    id: documentId,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    status: 'indexing',
    r2Key,
    createdAt: timestamp
  };
}

// ============================================
// Search Functions
// ============================================

/**
 * Search documents using AI Search with tenant isolation
 * Returns relevant chunks without AI generation
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID for folder filtering
 * @param query - Search query
 * @param options - Search options
 */
export async function searchDocuments(
  env: WorkerEnv,
  tenantId: string,
  query: string,
  options: SearchOptions = {}
): Promise<AISearchResult[]> {
  const {
    limit = 10,
    minScore = 0.5,
    rewriteQuery = false,
    reranking = true
  } = options;

  // Get AI Search instance via AI binding
  const autorag = env.AI.autorag(AI_SEARCH_INSTANCE);

  // Build tenant-scoped filter
  const filter = createTenantFilter(tenantId);

  const response = await autorag.search({
    query,
    filters: filter,
    max_num_results: limit,
    ranking_options: {
      score_threshold: minScore
    },
    rewrite_query: rewriteQuery,
    reranking: reranking ? { enabled: true } : undefined
  }) as AISearchResponse;

  return response.data || [];
}

/**
 * Generate RAG response with AI Search
 * Searches documents and generates AI response with context
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID for folder filtering
 * @param query - User question
 * @param options - RAG generation options
 */
export async function generateRAGResponse(
  env: WorkerEnv,
  tenantId: string,
  query: string,
  options: RAGOptions = {}
): Promise<{
  answer: string;
  sources: Array<{
    filename: string;
    score: number;
    preview: string;
  }>;
  searchQuery: string;
  cached: boolean;
}> {
  const {
    limit = 5,
    minScore = 0.5,
    systemPrompt,
    model,
    rewriteQuery = true,
    reranking = true,
    stream = false
  } = options;

  // Get AI Search instance via AI binding
  const autorag = env.AI.autorag(AI_SEARCH_INSTANCE);

  // Build tenant-scoped filter
  const filter = createTenantFilter(tenantId);

  // Default system prompt for RAG
  const defaultSystemPrompt = `You are a helpful AI assistant. Answer the user's question based on the provided context from documents.
If the context doesn't contain enough information to answer the question, say so clearly.
Always cite your sources by mentioning the document name when referencing information.`;

  // Use Smart Default model selection - AI Search picks optimal model
  // Only override if explicitly specified
  const response = await autorag.aiSearch({
    query,
    filters: filter,
    max_num_results: limit,
    ranking_options: {
      score_threshold: minScore
    },
    rewrite_query: rewriteQuery,
    reranking: reranking ? { enabled: true } : undefined,
    system_prompt: systemPrompt || defaultSystemPrompt,
    // model: undefined uses Smart Default (AI Search picks optimal model)
    ...(model ? { model } : {}),
    stream
  }) as AISearchResponse;

  // Extract sources from search results
  const sources = (response.data || []).map(result => ({
    filename: result.filename.split('/').pop() || result.filename,
    score: result.score,
    preview: result.content?.[0]?.text?.substring(0, 200) || ''
  }));

  // Check similarity cache status from response headers (if available)
  // The cf-aig-cache-status header indicates HIT or MISS
  const cached = false; // Note: Headers not directly accessible in binding response

  return {
    answer: response.response || "I couldn't find relevant information to answer your question.",
    sources,
    searchQuery: response.search_query,
    cached
  };
}

// ============================================
// Document Management
// ============================================

/**
 * Delete document from R2 and D1
 * AI Search automatically removes from index when R2 object is deleted
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID
 * @param documentId - Document ID
 */
export async function deleteDocument(
  env: WorkerEnv,
  tenantId: string,
  documentId: string
): Promise<void> {
  // Get document metadata
  const doc = await env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND tenant_id = ?'
  )
  .bind(documentId, tenantId)
  .first();

  if (!doc) {
    throw new Error('Document not found');
  }

  // Delete file from R2 (AI Search auto-removes from index)
  try {
    await env.DOCS_BUCKET.delete(doc.storage_path as string);
  } catch (err) {
    console.error('Failed to delete from R2:', err);
  }

  // Delete document metadata from D1
  await env.DB.prepare(
    'DELETE FROM documents WHERE id = ?'
  )
  .bind(documentId)
  .run();

  // Update tenant usage via TenantDO
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

    const fileSizeMB = (doc.file_size as number) / (1024 * 1024);
    await tenantStub.fetch('http://internal/usage/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'storage_used_mb',
        increment: -fileSizeMB
      })
    });
  } catch (err) {
    console.error('Failed to update tenant usage:', err);
  }
}

/**
 * List documents for a tenant
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID
 * @param options - Query options
 */
export async function listDocuments(
  env: WorkerEnv,
  tenantId: string,
  options: {
    limit?: number;
    offset?: number;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
): Promise<{
  documents: Record<string, unknown>[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}> {
  const {
    limit = 20,
    offset = 0,
    status = null,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = options;

  // Validate sort parameters
  const allowedSortFields = ['created_at', 'updated_at', 'filename', 'file_size'];
  const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  // Build query
  let query = 'SELECT * FROM documents WHERE tenant_id = ?';
  const params: (string | number)[] = [tenantId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ` ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const results = await env.DB.prepare(query)
    .bind(...params)
    .all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM documents WHERE tenant_id = ?';
  const countParams: (string | number)[] = [tenantId];

  if (status) {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }

  const countResult = await env.DB.prepare(countQuery)
    .bind(...countParams)
    .first();

  const total = (countResult?.total as number) || 0;

  // Parse metadata for each document
  const documents = (results.results || []).map(doc => ({
    ...doc,
    metadata: doc.metadata ? JSON.parse(doc.metadata as string) : {}
  }));

  return {
    documents,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + documents.length < total
    }
  };
}

/**
 * Get document by ID
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID
 * @param documentId - Document ID
 */
export async function getDocument(
  env: WorkerEnv,
  tenantId: string,
  documentId: string
): Promise<Record<string, unknown>> {
  const doc = await env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND tenant_id = ?'
  )
  .bind(documentId, tenantId)
  .first();

  if (!doc) {
    throw new Error('Document not found');
  }

  return {
    ...doc,
    metadata: doc.metadata ? JSON.parse(doc.metadata as string) : {}
  };
}

/**
 * Download document file from R2
 *
 * @param env - Worker environment bindings
 * @param tenantId - Tenant ID
 * @param documentId - Document ID
 */
export async function downloadDocument(
  env: WorkerEnv,
  tenantId: string,
  documentId: string
): Promise<{
  body: ReadableStream;
  filename: string;
  mimeType: string;
  size: number;
}> {
  const doc = await getDocument(env, tenantId, documentId);

  const r2Object = await env.DOCS_BUCKET.get(doc.storage_path as string);

  if (!r2Object) {
    throw new Error('Document file not found in storage');
  }

  return {
    body: r2Object.body,
    filename: doc.filename as string,
    mimeType: doc.mime_type as string,
    size: doc.file_size as number
  };
}

// ============================================
// User-Scoped Search (for chat.ts compatibility)
// ============================================

/**
 * Search documents scoped to a specific user
 * Uses user folder path for isolation
 *
 * @param env - Worker environment bindings
 * @param userId - User ID for folder filtering
 * @param query - Search query
 * @param options - Search options
 */
export async function searchUserDocuments(
  env: WorkerEnv,
  userId: string,
  query: string,
  options: SearchOptions = {}
): Promise<AISearchResult[]> {
  const {
    limit = 5,
    minScore = 0.5,
    rewriteQuery = false,
    reranking = true
  } = options;

  // Get AI Search instance via AI binding
  const autorag = env.AI.autorag(AI_SEARCH_INSTANCE);

  // Build user-scoped filter (users have their own folder)
  const userFolder = `user_${userId}/documents/`;
  const filter = {
    type: 'and' as const,
    filters: [
      { type: 'gt' as const, key: 'folder', value: `${userFolder}/` },
      { type: 'lte' as const, key: 'folder', value: `${userFolder}z` }
    ]
  };

  const response = await autorag.search({
    query,
    filters: filter,
    max_num_results: limit,
    ranking_options: {
      score_threshold: minScore
    },
    rewrite_query: rewriteQuery,
    reranking: reranking ? { enabled: true } : undefined
  }) as AISearchResponse;

  return response.data || [];
}
