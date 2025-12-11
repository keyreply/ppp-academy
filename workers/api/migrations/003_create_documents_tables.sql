-- Migration: Create Documents and Document Chunks Tables
-- Description: Tables for RAG system document storage and chunk management
-- Date: 2025-01-04

-- Documents table - stores metadata for uploaded documents
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, processed, error
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  metadata TEXT, -- JSON encoded metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processed_at TEXT
);

-- Indexes for documents table
CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_tenant_status ON documents(tenant_id, status);

-- Document chunks table - stores text chunks for vector embeddings
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY, -- Format: {documentId}:{chunkIndex}
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Indexes for document_chunks table
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_index ON document_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_chunks_document_index ON document_chunks(document_id, chunk_index);

-- Comments
-- documents.status values:
--   - 'pending': Document uploaded, waiting for processing
--   - 'processing': Currently being processed (extracting text, generating embeddings)
--   - 'processed': Successfully processed and ready for search
--   - 'error': Processing failed (see error_message for details)
--
-- documents.metadata: JSON object with custom fields like:
--   - title: User-provided document title
--   - description: Document description
--   - tags: Array of tags
--   - category: Document category
--   - source: Upload source (web, mobile, api, etc.)
--
-- document_chunks: Each chunk is independently embedded and stored in Vectorize
--   - Chunks are created with overlap to maintain context
--   - Default chunk size: 800 characters with 200 character overlap
--   - The full text is stored in D1 for display purposes
--   - Embeddings are stored in Vectorize, not in D1
