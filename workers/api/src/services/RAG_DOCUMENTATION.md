# RAG (Retrieval Augmented Generation) System Documentation

## Overview

The RAG system for PPP Academy enables semantic search and AI-powered question answering over uploaded documents. It uses Cloudflare's Workers AI for embeddings and text generation, Vectorize for vector storage, R2 for file storage, and D1 for metadata.

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Documents API  │ (routes/documents.js)
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│   RAG Service   │ (services/rag.js)
└──────┬──────────┘
       │
       ├─────────────┐
       │             │
       ▼             ▼
┌──────────┐  ┌──────────┐
│    R2    │  │   D1 DB  │
│ (Files)  │  │(Metadata)│
└──────────┘  └──────────┘
       │
       ▼
┌─────────────────┐
│ Document Queue  │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐
│ Process Worker  │
└──────┬──────────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌──────────────┐  ┌────────────┐
│ Workers AI   │  │ Vectorize  │
│ (Embeddings) │  │  (Vectors) │
└──────────────┘  └────────────┘
```

## Components

### 1. RAG Service (`services/rag.js`)

Core service providing document management and RAG capabilities.

#### Functions

##### `uploadDocument(env, tenantId, file, metadata)`
Uploads a document to R2 and queues it for processing.

**Parameters:**
- `env`: Worker environment bindings
- `tenantId`: Tenant ID
- `file`: File object from multipart form
- `metadata`: Additional metadata (title, description, tags, category)

**Returns:** Document metadata object

**Supported file types:**
- PDF (application/pdf)
- Plain text (text/plain)
- Markdown (text/markdown)
- Word documents (.doc, .docx)
- CSV (text/csv)
- JSON (application/json)

**Max file size:** 50MB

##### `processDocument(env, tenantId, documentId)`
Processes an uploaded document: extracts text, chunks it, generates embeddings, and stores in Vectorize.

**Processing steps:**
1. Retrieve document from D1 and R2
2. Extract text based on mime type (uses AI.toMarkdown() for PDFs)
3. Split text into chunks (800 chars with 200 char overlap)
4. Generate embeddings for each chunk using Workers AI
5. Store vectors in Vectorize with tenant namespace
6. Store chunk metadata in D1
7. Update document status and tenant usage stats

**Parameters:**
- `env`: Worker environment bindings
- `tenantId`: Tenant ID
- `documentId`: Document ID

##### `searchDocuments(env, tenantId, query, options)`
Performs semantic search across documents.

**Parameters:**
- `env`: Worker environment bindings
- `tenantId`: Tenant ID
- `query`: Search query string
- `options`:
  - `limit`: Max results (default: 10)
  - `minScore`: Minimum relevance score (default: 0.7)
  - `documentIds`: Filter by specific documents (optional)
  - `returnVectors`: Include embedding vectors (default: false)

**Returns:** Array of search results with scores and metadata

##### `generateRAGResponse(env, tenantId, query, options)`
Generates an AI-powered response using relevant document context.

**Parameters:**
- `env`: Worker environment bindings
- `tenantId`: Tenant ID
- `query`: User question
- `options`:
  - `limit`: Max context chunks (default: 5)
  - `minScore`: Minimum relevance score (default: 0.7)
  - `documentIds`: Filter by specific documents (optional)
  - `temperature`: AI temperature (default: 0.7)
  - `maxTokens`: Max response tokens (default: 2000)
  - `systemPrompt`: Custom system prompt (optional)

**Returns:** Object with answer, sources, context, and metadata

**AI Model:** @cf/qwen/qwen3-30b-a3b-fp8

##### `deleteDocument(env, tenantId, documentId)`
Deletes a document and all associated data (R2 file, vectors, metadata).

##### `listDocuments(env, tenantId, options)`
Lists documents for a tenant with pagination and filtering.

**Parameters:**
- `options`:
  - `limit`: Results per page (default: 20, max: 100)
  - `offset`: Pagination offset (default: 0)
  - `status`: Filter by status (pending, processing, processed, error)
  - `sortBy`: Sort field (default: created_at)
  - `sortOrder`: asc or desc (default: desc)

##### `getDocument(env, tenantId, documentId)`
Retrieves document metadata by ID.

##### `downloadDocument(env, tenantId, documentId)`
Downloads original document file from R2.

#### Helper Functions

##### `chunkText(text, chunkSize, overlap)`
Splits text into overlapping chunks.

**Parameters:**
- `text`: Text to chunk
- `chunkSize`: Chunk size in characters (default: 800)
- `overlap`: Overlap in characters (default: 200)

##### `generateEmbedding(env, text)`
Generates embedding vector for text using Workers AI.

**Model:** @cf/baai/bge-base-en-v1.5

**Text limit:** 2000 characters (~500 tokens)

### 2. Documents API (`routes/documents.js`)

HTTP API endpoints for document management.

#### Endpoints

##### `POST /documents/upload`
Upload a new document.

**Auth:** Required (Bearer token)

**Content-Type:** multipart/form-data

**Form fields:**
- `file`: File to upload (required)
- `title`: Document title (optional)
- `description`: Document description (optional)
- `tags`: Comma-separated tags (optional)
- `category`: Document category (optional)

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "abc123",
    "filename": "document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "status": "pending",
    "createdAt": "2025-01-01T00:00:00.000Z",
    "metadata": {...}
  },
  "message": "Document uploaded successfully and queued for processing"
}
```

##### `GET /documents`
List documents with pagination.

**Auth:** Required

**Query parameters:**
- `limit`: Results per page (1-100, default: 20)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by status
- `sortBy`: Sort field (created_at, updated_at, filename, file_size)
- `sortOrder`: asc or desc (default: desc)

**Response:**
```json
{
  "success": true,
  "documents": [...],
  "pagination": {
    "total": 50,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

##### `GET /documents/:documentId`
Get document details.

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "document": {
    "id": "abc123",
    "tenant_id": "tenant_123",
    "filename": "document.pdf",
    "mime_type": "application/pdf",
    "file_size": 1048576,
    "status": "processed",
    "chunk_count": 25,
    "created_at": "2025-01-01T00:00:00.000Z",
    "processed_at": "2025-01-01T00:05:00.000Z",
    "metadata": {...}
  }
}
```

##### `DELETE /documents/:documentId`
Delete a document.

**Auth:** Required + `documents.delete` permission

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully"
}
```

##### `GET /documents/:documentId/download`
Download original document file.

**Auth:** Required

**Response:** File download with appropriate headers

##### `POST /documents/search`
Semantic search across documents.

**Auth:** Required

**Request body:**
```json
{
  "query": "What is the refund policy?",
  "limit": 10,
  "minScore": 0.7,
  "documentIds": ["doc1", "doc2"]
}
```

**Response:**
```json
{
  "success": true,
  "query": "What is the refund policy?",
  "results": [
    {
      "id": "doc1:5",
      "documentId": "doc1",
      "filename": "policies.pdf",
      "chunkIndex": 5,
      "text": "Refund policy text...",
      "score": 0.89
    }
  ],
  "count": 1
}
```

##### `POST /documents/ask`
Ask a question and get AI-powered answer.

**Auth:** Required

**Quota:** Checks `ai_requests` quota

**Request body:**
```json
{
  "query": "What is the refund policy?",
  "limit": 5,
  "minScore": 0.7,
  "documentIds": ["doc1"],
  "temperature": 0.7,
  "maxTokens": 2000,
  "systemPrompt": "Custom system prompt..."
}
```

**Response:**
```json
{
  "success": true,
  "query": "What is the refund policy?",
  "answer": "According to the documents, the refund policy states...",
  "sources": [
    {
      "index": 1,
      "documentId": "doc1",
      "filename": "policies.pdf",
      "chunkIndex": 5,
      "score": 0.89,
      "text": "Preview of source text..."
    }
  ],
  "context": [...],
  "metadata": {
    "model": "@cf/qwen/qwen3-30b-a3b-fp8",
    "chunksUsed": 3,
    "temperature": 0.7,
    "maxTokens": 2000
  }
}
```

##### `POST /documents/:documentId/reprocess`
Reprocess a document.

**Auth:** Required + `documents.manage` permission

**Response:**
```json
{
  "success": true,
  "message": "Document queued for reprocessing"
}
```

##### `GET /documents/:documentId/chunks`
Get all chunks for a document.

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "documentId": "doc1",
  "chunks": [
    {
      "id": "doc1:0",
      "chunk_index": 0,
      "text": "Chunk text...",
      "start_offset": 0,
      "end_offset": 800
    }
  ],
  "count": 25
}
```

##### `GET /documents/stats`
Get document statistics for tenant.

**Auth:** Required

**Response:**
```json
{
  "success": true,
  "stats": {
    "total": 50,
    "byStatus": {
      "processed": 45,
      "processing": 3,
      "pending": 1,
      "error": 1
    },
    "storage": {
      "bytes": 104857600,
      "megabytes": 100,
      "gigabytes": 0.1
    }
  }
}
```

## Database Schema

### D1 Tables

#### `documents`
```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, processing, processed, error
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  metadata TEXT, -- JSON
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX idx_documents_tenant ON documents(tenant_id);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_created ON documents(created_at);
```

#### `document_chunks`
```sql
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY, -- {documentId}:{chunkIndex}
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_index ON document_chunks(chunk_index);
```

## Cloudflare Resources

### Required Bindings

Add these to `wrangler.toml`:

```toml
# Workers AI
[ai]
binding = "AI"

# Vectorize (vector database)
[[vectorize]]
binding = "VECTORIZE"
index_name = "keyreply-kira-embeddings"
dimensions = 768  # for bge-base-en-v1.5
metric = "cosine"

# R2 (file storage)
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "keyreply-kira-documents"

# D1 (metadata database)
[[d1_databases]]
binding = "DB"
database_name = "keyreply-kira-db"
database_id = "your-database-id"

# Queue (document processing)
[[queues.producers]]
binding = "DOCUMENT_QUEUE"
queue = "keyreply-kira-documents"

[[queues.consumers]]
queue = "keyreply-kira-documents"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
```

### Create Resources

```bash
# Create Vectorize index
wrangler vectorize create keyreply-kira-embeddings \
  --dimensions=768 \
  --metric=cosine

# Create R2 bucket
wrangler r2 bucket create keyreply-kira-documents

# Create D1 database
wrangler d1 create keyreply-kira-db

# Create queue
wrangler queues create keyreply-kira-documents
```

## Usage Examples

### Upload a Document

```bash
curl -X POST https://api.kira.keyreply.com/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "title=Product Documentation" \
  -F "description=Complete product guide" \
  -F "tags=product,guide,help" \
  -F "category=documentation"
```

### Search Documents

```bash
curl -X POST https://api.kira.keyreply.com/documents/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How do I reset my password?",
    "limit": 5,
    "minScore": 0.7
  }'
```

### Ask a Question

```bash
curl -X POST https://api.kira.keyreply.com/documents/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the return policy for damaged items?",
    "limit": 5,
    "temperature": 0.7
  }'
```

## Performance Considerations

### Chunking Strategy
- **Chunk size:** 800 characters (~200 tokens)
- **Overlap:** 200 characters to maintain context
- **Rationale:** Balances context preservation with embedding quality

### Embedding Model
- **Model:** @cf/baai/bge-base-en-v1.5
- **Dimensions:** 768
- **Max input:** ~512 tokens (2000 characters)
- **Performance:** Fast, multilingual, high quality

### Search Performance
- **Vector search:** Cosine similarity
- **Namespace filtering:** Ensures tenant isolation
- **Top-K:** Retrieve more than needed, then filter
- **Score threshold:** 0.7 default (adjustable)

### Cost Optimization
- **Lazy processing:** Documents queued for async processing
- **Batch embeddings:** Process multiple chunks efficiently
- **Quota management:** Track usage via TenantDO
- **Storage tiers:** R2 for cost-effective file storage

## Security

### Tenant Isolation
- **Namespace filtering:** All vectors tagged with `tenant_{tenantId}`
- **D1 queries:** All queries filtered by tenant_id
- **R2 paths:** Files stored in tenant-specific paths
- **Authentication:** All endpoints require valid session

### Permissions
- **Upload:** Requires authentication
- **Search/Ask:** Requires authentication
- **Delete:** Requires `documents.delete` permission
- **Reprocess:** Requires `documents.manage` permission

### Data Privacy
- **No cross-tenant access:** Strict namespace isolation
- **Secure storage:** R2 encryption at rest
- **Audit logging:** Track all document operations
- **Deletion:** Complete cleanup of all associated data

## Error Handling

### Document Processing Errors
- **Status tracking:** Documents marked as "error" with message
- **Retry logic:** Queue messages retried up to 3 times
- **Partial failure:** Chunk processing failures logged but don't block
- **User notification:** Status available via API

### Common Issues

**"File size exceeds maximum"**
- Files limited to 50MB
- Split large documents before upload

**"File type not supported"**
- Check supported MIME types
- Convert to PDF or text format

**"Document not found in storage"**
- R2 object may have been deleted
- Check storage path in metadata

**"Failed to generate embedding"**
- Text may be empty or invalid
- Workers AI may be unavailable
- Retry processing

**"Quota exceeded"**
- Check tenant quotas
- Upgrade plan or delete old documents

## Monitoring

### Key Metrics
- **Upload rate:** Documents uploaded per minute
- **Processing time:** Average time to process document
- **Embedding latency:** Time to generate embeddings
- **Search latency:** Time to perform semantic search
- **Error rate:** Processing failures percentage
- **Storage usage:** Total bytes stored per tenant

### Logging
All operations logged with:
- Timestamp
- Tenant ID
- Operation type
- Duration
- Success/failure
- Error details

### Queue Monitoring
```bash
# Check queue depth
wrangler queues consumer worker keyreply-kira-documents

# View queue messages
wrangler tail --format json
```

## Future Enhancements

### Planned Features
- [ ] Multi-modal embeddings (text + images)
- [ ] Advanced chunking strategies (semantic, recursive)
- [ ] Document versioning
- [ ] Bulk upload
- [ ] OCR for scanned documents
- [ ] Metadata extraction (entities, keywords)
- [ ] Duplicate detection
- [ ] Document comparison
- [ ] Export search results
- [ ] Custom embedding models

### Performance Improvements
- [ ] Caching for frequent searches
- [ ] Hybrid search (vector + keyword)
- [ ] Re-ranking of search results
- [ ] Streaming responses for long answers
- [ ] Parallel chunk processing
- [ ] Compressed embeddings

## Support

For issues or questions:
- GitHub Issues: [keyreply-kira/issues](https://github.com/keyreply-kira/issues)
- Documentation: [docs.kira.keyreply.com](https://docs.kira.keyreply.com)
- Email: support@kira.keyreply.com
