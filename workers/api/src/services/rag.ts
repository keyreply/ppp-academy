/**
 * RAG (Retrieval Augmented Generation) Service
 * Handles document upload, processing, embedding generation, semantic search, and AI-powered responses
 */

import { nanoid } from 'nanoid';

/**
 * Upload document to R2 and queue for processing
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {File} file - File object from multipart form
 * @param {Object} metadata - Additional metadata for the document
 * @returns {Promise<Object>} Document metadata
 */
export async function uploadDocument(env, tenantId, file, metadata = {}) {
  const documentId = nanoid();
  const timestamp = new Date().toISOString();

  // Validate file
  if (!file || !file.name) {
    throw new Error('Invalid file');
  }

  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024; // 50MB
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

  // Store file in R2
  const r2Key = `${tenantId}/documents/${documentId}/${file.name}`;
  const fileBuffer = await file.arrayBuffer();

  await env.DOCS_BUCKET.put(r2Key, fileBuffer, {
    customMetadata: {
      tenantId,
      documentId,
      originalName: file.name,
      mimeType: file.type,
      uploadedAt: timestamp,
      ...metadata
    }
  });

  // Calculate file size in MB
  const fileSizeMB = file.size / (1024 * 1024);

  // Store document metadata in D1
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
    'pending',
    JSON.stringify(metadata),
    timestamp,
    timestamp
  )
  .run();

  // Queue document for processing
  await env.DOCUMENT_QUEUE.send({
    type: 'document.process',
    data: {
      documentId,
      tenantId,
      userId: metadata.userId,
      filename: file.name,
      mimeType: file.type,
      r2Key
    }
  });

  return {
    id: documentId,
    filename: file.name,
    mimeType: file.type,
    size: file.size,
    status: 'pending',
    createdAt: timestamp,
    metadata
  };
}

/**
 * Process uploaded document: extract text, chunk, and generate embeddings
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Processing result
 */
export async function processDocument(env, tenantId, documentId) {
  try {
    // Get document metadata from D1
    const doc = await env.DB.prepare(
      'SELECT * FROM documents WHERE id = ? AND tenant_id = ?'
    )
    .bind(documentId, tenantId)
    .first();

    if (!doc) {
      throw new Error('Document not found');
    }

    // Update status to processing
    await env.DB.prepare(
      'UPDATE documents SET status = ?, updated_at = ? WHERE id = ?'
    )
    .bind('processing', new Date().toISOString(), documentId)
    .run();

    // Get document from R2
    const r2Object = await env.DOCS_BUCKET.get(doc.storage_path);

    if (!r2Object) {
      throw new Error('Document not found in storage');
    }

    // Extract text based on mime type
    let text = '';

    if (doc.mime_type === 'application/pdf') {
      // Use Workers AI to convert PDF to markdown
      const arrayBuffer = await r2Object.arrayBuffer();
      const result = await env.AI.toMarkdown({
        file: arrayBuffer,
        filename: doc.filename
      });
      text = result.markdown || result.text || '';
    } else if (doc.mime_type.startsWith('text/')) {
      // Plain text files
      text = await r2Object.text();
    } else if (doc.mime_type === 'application/json') {
      // JSON files
      const jsonText = await r2Object.text();
      const jsonData = JSON.parse(jsonText);
      text = JSON.stringify(jsonData, null, 2);
    } else {
      // Try to extract as text
      text = await r2Object.text();
    }

    if (!text || text.trim().length === 0) {
      throw new Error('Could not extract text from document');
    }

    // Split text into chunks with overlap
    const chunkSize = 800; // characters
    const overlap = 200; // characters
    const chunks = chunkText(text, chunkSize, overlap);

    console.log(`Processing ${chunks.length} chunks for document ${documentId}`);

    // Generate embeddings for each chunk
    const embeddings = [];
    const chunkMetadata = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // Generate embedding using Workers AI
      const embedding = await generateEmbedding(env, chunk.text);

      // Prepare vector for Vectorize
      embeddings.push({
        id: `${documentId}:${i}`,
        values: embedding,
        namespace: `tenant_${tenantId}`,
        metadata: {
          documentId,
          tenantId,
          chunkIndex: i,
          startOffset: chunk.start,
          endOffset: chunk.end,
          filename: doc.filename
        }
      });

      // Prepare chunk metadata for D1
      chunkMetadata.push({
        id: `${documentId}:${i}`,
        documentId,
        chunkIndex: i,
        text: chunk.text,
        startOffset: chunk.start,
        endOffset: chunk.end
      });
    }

    // Insert vectors into Vectorize
    await env.VECTORIZE.upsert(embeddings);

    // Store chunk metadata in D1
    for (const chunk of chunkMetadata) {
      await env.DB.prepare(
        `INSERT INTO document_chunks (
          id, document_id, chunk_index, text, start_offset, end_offset, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        chunk.id,
        chunk.documentId,
        chunk.chunkIndex,
        chunk.text,
        chunk.startOffset,
        chunk.endOffset,
        new Date().toISOString()
      )
      .run();
    }

    // Update document status to processed
    const processedAt = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE documents
       SET status = ?, processed_at = ?, updated_at = ?, chunk_count = ?
       WHERE id = ?`
    )
    .bind('processed', processedAt, processedAt, chunks.length, documentId)
    .run();

    // Update tenant storage and document count via TenantDO
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

      // Track storage usage
      const fileSizeMB = doc.file_size / (1024 * 1024);
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
      documentId,
      status: 'processed',
      chunks: chunks.length,
      processedAt
    };
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    // Update status to error
    await env.DB.prepare(
      'UPDATE documents SET status = ?, error_message = ?, updated_at = ? WHERE id = ?'
    )
    .bind('error', error.message, new Date().toISOString(), documentId)
    .run();

    throw error;
  }
}

/**
 * Search documents using semantic search
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {string} query - Search query
 * @param {Object} options - Search options (limit, filter, etc.)
 * @returns {Promise<Array>} Search results with relevance scores
 */
export async function searchDocuments(env, tenantId, query, options = {}) {
  const {
    limit = 10,
    minScore = 0.7,
    documentIds = null,
    returnVectors = false
  } = options;

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(env, query);

  // Search Vectorize with namespace filter
  const searchResults = await env.VECTORIZE.query(queryEmbedding, {
    topK: limit * 2, // Get more results to filter
    namespace: `tenant_${tenantId}`,
    returnValues: returnVectors,
    returnMetadata: true
  });

  // Filter by document IDs if specified
  let matches = searchResults.matches || [];
  if (documentIds && documentIds.length > 0) {
    matches = matches.filter(match =>
      documentIds.includes(match.metadata.documentId)
    );
  }

  // Filter by minimum score and limit results
  matches = matches
    .filter(match => match.score >= minScore)
    .slice(0, limit);

  // Enrich results with chunk text from D1
  const results = [];
  for (const match of matches) {
    const chunk = await env.DB.prepare(
      'SELECT text, chunk_index FROM document_chunks WHERE id = ?'
    )
    .bind(match.id)
    .first();

    if (chunk) {
      results.push({
        id: match.id,
        documentId: match.metadata.documentId,
        filename: match.metadata.filename,
        chunkIndex: match.metadata.chunkIndex,
        text: chunk.text,
        score: match.score,
        ...(returnVectors ? { vector: match.values } : {})
      });
    }
  }

  return results;
}

/**
 * Generate RAG response with context from documents
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {string} query - User question
 * @param {Object} options - Generation options
 * @returns {Promise<Object>} AI response with sources
 */
export async function generateRAGResponse(env, tenantId, query, options = {}) {
  const {
    limit = 5,
    minScore = 0.7,
    documentIds = null,
    temperature = 0.7,
    maxTokens = 2000,
    systemPrompt = null
  } = options;

  // Search for relevant document chunks
  const searchResults = await searchDocuments(env, tenantId, query, {
    limit,
    minScore,
    documentIds
  });

  if (searchResults.length === 0) {
    return {
      answer: "I couldn't find any relevant information in the documents to answer your question.",
      sources: [],
      context: []
    };
  }

  // Build context from search results
  const contextChunks = searchResults.map((result, idx) => {
    return `[Source ${idx + 1} - ${result.filename}, chunk ${result.chunkIndex}]:\n${result.text}`;
  });

  const context = contextChunks.join('\n\n---\n\n');

  // Build system prompt
  const defaultSystemPrompt = `You are a helpful AI assistant. Answer the user's question based on the provided context from documents.
If the context doesn't contain enough information to answer the question, say so clearly.
Always cite your sources using the [Source N] references provided in the context.`;

  const finalSystemPrompt = systemPrompt || defaultSystemPrompt;

  // Build messages for AI
  const messages = [
    {
      role: 'system',
      content: finalSystemPrompt
    },
    {
      role: 'user',
      content: `Context from documents:\n\n${context}\n\n---\n\nQuestion: ${query}`
    }
  ];

  // Use Gemma Sea Lion for RAG (128K context, SEA language support)
  const modelId = '@cf/aisingapore/gemma-sea-lion-v4-27b-it';

  // Call Workers AI for response generation
  const aiResponse = await env.AI.run(modelId, {
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: false
  });

  // Extract answer from AI response
  const answer = aiResponse.response || aiResponse.content || 'No response generated';

  // Prepare sources
  const sources = searchResults.map((result, idx) => ({
    index: idx + 1,
    documentId: result.documentId,
    filename: result.filename,
    chunkIndex: result.chunkIndex,
    score: result.score,
    text: result.text.substring(0, 200) + '...' // Preview
  }));

  return {
    answer,
    sources,
    context: searchResults,
    metadata: {
      model: modelId,
      chunksUsed: searchResults.length,
      temperature,
      maxTokens
    }
  };
}

/**
 * Delete document and all associated data
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {string} documentId - Document ID
 * @returns {Promise<void>}
 */
export async function deleteDocument(env, tenantId, documentId) {
  // Get document metadata
  const doc = await env.DB.prepare(
    'SELECT * FROM documents WHERE id = ? AND tenant_id = ?'
  )
  .bind(documentId, tenantId)
  .first();

  if (!doc) {
    throw new Error('Document not found');
  }

  // Delete file from R2
  try {
    await env.DOCS_BUCKET.delete(doc.storage_path);
  } catch (err) {
    console.error('Failed to delete from R2:', err);
  }

  // Get all chunk IDs for this document
  const chunks = await env.DB.prepare(
    'SELECT id FROM document_chunks WHERE document_id = ?'
  )
  .bind(documentId)
  .all();

  // Delete vectors from Vectorize
  if (chunks.results && chunks.results.length > 0) {
    const vectorIds = chunks.results.map(c => c.id);
    try {
      await env.VECTORIZE.deleteByIds(vectorIds);
    } catch (err) {
      console.error('Failed to delete from Vectorize:', err);
    }
  }

  // Delete chunk metadata from D1
  await env.DB.prepare(
    'DELETE FROM document_chunks WHERE document_id = ?'
  )
  .bind(documentId)
  .run();

  // Delete document metadata from D1
  await env.DB.prepare(
    'DELETE FROM documents WHERE id = ?'
  )
  .bind(documentId)
  .run();

  // Update tenant usage via TenantDO
  try {
    const tenantStub = env.TENANT.get(env.TENANT.idFromName(tenantId));

    // Decrement document count
    await tenantStub.fetch('http://internal/usage/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'documents_count',
        increment: -1
      })
    });

    // Decrement storage usage
    const fileSizeMB = doc.file_size / (1024 * 1024);
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
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {Object} options - Query options (limit, offset, status, etc.)
 * @returns {Promise<Object>} Paginated document list
 */
export async function listDocuments(env, tenantId, options = {}) {
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
  const params = [tenantId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ` ORDER BY ${sortField} ${order} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  // Execute query
  const results = await env.DB.prepare(query)
    .bind(...params)
    .all();

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM documents WHERE tenant_id = ?';
  const countParams = [tenantId];

  if (status) {
    countQuery += ' AND status = ?';
    countParams.push(status);
  }

  const countResult = await env.DB.prepare(countQuery)
    .bind(...countParams)
    .first();

  const total = countResult?.total || 0;

  // Parse metadata for each document
  const documents = (results.results || []).map(doc => ({
    ...doc,
    metadata: doc.metadata ? JSON.parse(doc.metadata) : {}
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
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} Document details
 */
export async function getDocument(env, tenantId, documentId) {
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
    metadata: doc.metadata ? JSON.parse(doc.metadata) : {}
  };
}

/**
 * Download document file from R2
 * @param {Object} env - Worker environment bindings
 * @param {string} tenantId - Tenant ID
 * @param {string} documentId - Document ID
 * @returns {Promise<Object>} File data and metadata
 */
export async function downloadDocument(env, tenantId, documentId) {
  const doc = await getDocument(env, tenantId, documentId);

  const r2Object = await env.DOCS_BUCKET.get(doc.storage_path);

  if (!r2Object) {
    throw new Error('Document file not found in storage');
  }

  return {
    body: r2Object.body,
    filename: doc.filename,
    mimeType: doc.mime_type,
    size: doc.file_size
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Split text into overlapping chunks
 * @param {string} text - Text to chunk
 * @param {number} chunkSize - Size of each chunk in characters
 * @param {number} overlap - Overlap between chunks in characters
 * @returns {Array} Array of chunks with text and position info
 */
export function chunkText(text, chunkSize = 800, overlap = 200) {
  if (!text || text.length === 0) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunkText = text.substring(start, end);

    chunks.push({
      text: chunkText,
      start,
      end
    });

    // Move start position forward, accounting for overlap
    start = end - overlap;

    // If we're at the end, break
    if (end === text.length) {
      break;
    }

    // Ensure we make progress even with large overlap
    if (start <= chunks[chunks.length - 1].start) {
      start = chunks[chunks.length - 1].end;
    }
  }

  return chunks;
}

/**
 * Generate embedding for text using Workers AI
 * @param {Object} env - Worker environment bindings
 * @param {string} text - Text to embed
 * @returns {Promise<Array>} Embedding vector
 */
export async function generateEmbedding(env, text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Cannot generate embedding for empty text');
  }

  // Qwen3 embedding supports up to 8192 tokens
  const maxLength = 32000; // characters, roughly 8000 tokens
  const truncatedText = text.length > maxLength
    ? text.substring(0, maxLength)
    : text;

  // Use Qwen3 Embedding model (1024 dimensions)
  const result = await env.AI.run('@cf/qwen/qwen3-embedding-0.6b', {
    text: [truncatedText]
  });

  // Extract embedding vector
  const embedding = result.data?.[0] || result[0];

  if (!embedding || !Array.isArray(embedding)) {
    throw new Error('Failed to generate embedding');
  }

  return embedding;
}
