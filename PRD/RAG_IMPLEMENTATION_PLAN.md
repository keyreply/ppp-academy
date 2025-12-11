# RAG Implementation Plan for KeyReply Kira

## Implementation Status
- [ ] **Phase 1: Infrastructure Setup**
    - [x] Create Cloudflare Resources (R2, Vectorize, D1)
    - [x] Define D1 Schema
- [x] **Phase 2: Authentication Middleware**
- [x] **Phase 3: Multi-Tenant File Upload**
    - [x] Upload Handler
- [x] **Phase 4: Multi-Tenant Document Processing**
    - [x] Queue Consumer
    - [x] Workers AI Integration
- [x] **Phase 5: Multi-Tenant RAG Chat**
    - [x] Chat Endpoint
    - [x] Context Retrieval
- [x] **Phase 6: Multi-Tenant Document Management**
    - [x] List/Delete Documents
- [x] **Phase 7: Main Worker Entry Point**
- [ ] **Phase 8: wrangler.toml Configuration**

## Overview

This plan implements a fully **Cloudflare-native**, **multi-tenant** Retrieval-Augmented Generation (RAG) system for a SaaS platform. Each user manages their own documents and knowledge base, with complete data isolation.

**Key principles:**
- 100% Cloudflare services - no external APIs required
- Multi-tenant architecture - each user has isolated data
- Secure by default - users can only access their own documents

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Worker API      │────▶│   R2 Bucket     │
│   (React/Vite)  │     │  (Hono + Auth)   │     │   /{user_id}/   │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
                                 │                        │
                                 ▼                        ▼
                        ┌──────────────────┐     ┌─────────────────┐
                        │   Workers AI     │     │  Queue          │
                        │   - toMarkdown() │◀────│  (Event Handler)│
                        │   - Embeddings   │     └─────────────────┘
                        │   - Qwen3 LLM    │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   Vectorize      │
                        │   namespace=     │
                        │   {user_id}      │
                        └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │   D1 Database    │
                        │   user_id FK     │
                        └──────────────────┘
```

## Multi-Tenancy Strategy

| Layer | Isolation Method | Description |
|-------|------------------|-------------|
| **R2 Storage** | Path prefix | Files stored at `/{user_id}/documents/{doc_id}/` |
| **Vectorize** | Namespace | Each user gets a namespace: `user_{user_id}` |
| **D1 Database** | Foreign key | All tables have `user_id` column with indexes |
| **API** | Auth middleware | JWT/session validation on every request |

### Why Namespace for Vectorize?

- **Performance**: Namespace filtering is applied BEFORE vector search
- **Scale**: Up to 50,000 namespaces per index (50K users per index)
- **Simplicity**: No need for metadata index creation
- **Cost**: No additional billing impact for namespace filtering

## Cloudflare-Native Components

| Component | Purpose | Model/Service | Pricing |
|-----------|---------|---------------|---------|
| **R2** | File storage (per-user paths) | - | 10 GB free |
| **Workers AI** | Document conversion | `env.AI.toMarkdown()` | Free (most formats) |
| **Workers AI** | Embeddings | `@cf/baai/bge-base-en-v1.5` | Free tier: 10K neurons/day |
| **Workers AI** | LLM (Chat) | `@cf/qwen/qwen3-30b-a3b-fp8` | $0.051/M input, $0.34/M output |
| **Vectorize** | Vector database (namespaced) | - | 5M vectors free |
| **D1** | SQLite metadata | - | 5 GB free |
| **Queues** | Async processing | - | 1M ops free |
| **Workers** | API endpoints | - | 100K req/day free |

## Implementation Steps

### Phase 1: Infrastructure Setup

#### 1.1 Create Cloudflare Resources

```bash
# Create R2 bucket for documents (shared, isolated by path)
npx wrangler r2 bucket create keyreply-kira-docs

# Create Vectorize index (shared, isolated by namespace)
npx wrangler vectorize create keyreply-kira-vectors --dimensions=768 --metric=cosine

# Create D1 database for metadata
npx wrangler d1 create keyreply-kira-db

# Create Queue for async processing
npx wrangler queues create keyreply-kira-processor
```

#### 1.2 D1 Schema (Multi-Tenant)

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT, -- For simple auth, or use external auth
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table (for simple session auth)
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Documents table (multi-tenant)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, processing, ready, failed
  chunk_count INTEGER DEFAULT 0,
  error_message TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Document chunks table (multi-tenant)
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Create indexes for multi-tenant queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_documents_status ON documents(user_id, status);
CREATE INDEX idx_chunks_user_id ON chunks(user_id);
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
```

### Phase 2: Authentication Middleware

#### 2.1 Simple Session-Based Auth

```javascript
// middleware/auth.js
export async function authMiddleware(c, next) {
  // Get session token from cookie or header
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '')
    || getCookie(c, 'session');

  if (!sessionToken) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Validate session
  const session = await c.env.DB.prepare(`
    SELECT s.id, s.user_id, s.expires_at, u.email, u.name
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionToken).first();

  if (!session) {
    return c.json({ error: 'Session expired or invalid' }, 401);
  }

  // Attach user to context
  c.set('user', {
    id: session.user_id,
    email: session.email,
    name: session.name,
  });
  c.set('userId', session.user_id);

  await next();
}

// Helper to get current user ID (used in all queries)
export function getUserId(c) {
  return c.get('userId');
}
```

#### 2.2 Auth Routes

```javascript
// routes/auth.js
import { Hono } from 'hono';
import { hashPassword, verifyPassword } from '../utils/crypto';

const auth = new Hono();

// Register
auth.post('/register', async (c) => {
  const { email, password, name } = await c.req.json();

  // Validate input
  if (!email || !password) {
    return c.json({ error: 'Email and password required' }, 400);
  }

  // Check if user exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();

  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  // Create user
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await c.env.DB.prepare(`
    INSERT INTO users (id, email, name, password_hash)
    VALUES (?, ?, ?, ?)
  `).bind(userId, email, name || null, passwordHash).run();

  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await c.env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(sessionId, userId, expiresAt.toISOString()).run();

  return c.json({
    user: { id: userId, email, name },
    session: { token: sessionId, expiresAt },
  }, 201);
});

// Login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json();

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await c.env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (?, ?, ?)
  `).bind(sessionId, user.id, expiresAt.toISOString()).run();

  return c.json({
    user: { id: user.id, email: user.email, name: user.name },
    session: { token: sessionId, expiresAt },
  });
});

// Logout
auth.post('/logout', async (c) => {
  const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '');
  if (sessionToken) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?')
      .bind(sessionToken).run();
  }
  return c.json({ success: true });
});

// Get current user
auth.get('/me', async (c) => {
  const user = c.get('user');
  return c.json({ user });
});

export default auth;
```

### Phase 3: Multi-Tenant File Upload

#### 3.1 Upload Handler (User-Scoped)

```javascript
// routes/upload.js
import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const upload = new Hono();

upload.post('/', async (c) => {
  const userId = getUserId(c);
  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // Check supported formats
  const supported = await c.env.AI.toMarkdown().supported();
  const isSupported = supported.some(f =>
    f.mimeTypes?.includes(file.type) ||
    f.extensions?.some(ext => file.name.endsWith(ext))
  );

  if (!isSupported) {
    return c.json({ error: 'Unsupported file format' }, 400);
  }

  const documentId = crypto.randomUUID();

  // Store in user-specific path: /{user_id}/documents/{doc_id}/{filename}
  const key = `${userId}/documents/${documentId}/${file.name}`;

  // Upload to R2
  await c.env.DOCS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: {
      originalName: file.name,
      userId: userId,
    },
  });

  // Create document record with user_id
  await c.env.DB.prepare(`
    INSERT INTO documents (id, user_id, filename, original_name, content_type, file_size, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `).bind(documentId, userId, key, file.name, file.type, file.size).run();

  // Queue for processing
  await c.env.DOC_PROCESSOR.send({
    documentId,
    userId,
    key,
    contentType: file.type,
  });

  return c.json({
    id: documentId,
    filename: file.name,
    status: 'pending',
    message: 'Document uploaded and queued for processing',
  }, 201);
});

export default upload;
```

### Phase 4: Multi-Tenant Document Processing

#### 4.1 Queue Consumer (User-Namespaced Vectors)

```javascript
// Queue handler for document processing
export default {
  async queue(batch, env) {
    for (const message of batch.messages) {
      const { documentId, userId, key, contentType } = message.body;

      try {
        // Update status to processing
        await env.DB.prepare('UPDATE documents SET status = ? WHERE id = ? AND user_id = ?')
          .bind('processing', documentId, userId).run();

        // 1. Fetch file from R2
        const object = await env.DOCS_BUCKET.get(key);
        if (!object) {
          throw new Error('File not found in R2');
        }

        // 2. Convert to Markdown using Workers AI
        const fileBlob = await object.blob();
        const conversionResult = await env.AI.toMarkdown({
          name: key,
          blob: fileBlob,
        });

        const markdownText = conversionResult.data;

        if (!markdownText || markdownText.trim().length === 0) {
          throw new Error('No text content extracted from document');
        }

        // 3. Chunk the text
        const chunks = chunkText(markdownText, {
          chunkSize: 1000,
          overlap: 100
        });

        // 4. Process chunks in batches
        const BATCH_SIZE = 50;
        let totalChunks = 0;

        // User's namespace for vector isolation
        const namespace = `user_${userId}`;

        for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
          const batchChunks = chunks.slice(batchStart, batchStart + BATCH_SIZE);

          // Generate embeddings for batch
          const embeddingResult = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
            text: batchChunks,
          });

          // Prepare vectors with user namespace
          const vectors = [];
          const chunkRecords = [];

          for (let i = 0; i < batchChunks.length; i++) {
            const chunkIndex = batchStart + i;
            const chunkId = `${documentId}-${chunkIndex}`;

            vectors.push({
              id: chunkId,
              values: embeddingResult.data[i],
              namespace: namespace, // User isolation via namespace
              metadata: {
                documentId,
                chunkIndex,
                preview: batchChunks[i].substring(0, 100),
              },
            });

            chunkRecords.push({
              id: chunkId,
              userId,
              documentId,
              chunkIndex,
              content: batchChunks[i],
            });
          }

          // Upsert vectors to Vectorize with namespace
          await env.VECTORIZE.upsert(vectors);

          // Insert chunk records to D1
          for (const chunk of chunkRecords) {
            await env.DB.prepare(`
              INSERT INTO chunks (id, user_id, document_id, chunk_index, content)
              VALUES (?, ?, ?, ?, ?)
            `).bind(chunk.id, chunk.userId, chunk.documentId, chunk.chunkIndex, chunk.content).run();
          }

          totalChunks += batchChunks.length;
        }

        // 5. Update document status to ready
        await env.DB.prepare(`
          UPDATE documents
          SET status = 'ready', chunk_count = ?, processed_at = datetime('now')
          WHERE id = ? AND user_id = ?
        `).bind(totalChunks, documentId, userId).run();

        message.ack();

      } catch (error) {
        console.error(`Processing failed for ${documentId}:`, error);

        await env.DB.prepare(`
          UPDATE documents SET status = 'failed', error_message = ? WHERE id = ? AND user_id = ?
        `).bind(error.message, documentId, userId).run();

        if (error.message.includes('Unsupported') || error.message.includes('No text content')) {
          message.ack();
        } else {
          message.retry();
        }
      }
    }
  }
};

function chunkText(text, options = {}) {
  const { chunkSize = 1000, overlap = 100 } = options;
  const chunks = [];
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const paragraphs = cleanText.split(/\n\n+/);
  let currentChunk = '';

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if ((currentChunk + '\n\n' + trimmedPara).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const words = currentChunk.split(/\s+/);
      const overlapWords = words.slice(-Math.floor(overlap / 5));
      currentChunk = overlapWords.join(' ') + '\n\n' + trimmedPara;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
```

### Phase 5: Multi-Tenant RAG Chat

#### 5.1 Chat Endpoint (User-Scoped Search)

```javascript
// routes/chat.js
import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const chat = new Hono();

chat.post('/', async (c) => {
  const userId = getUserId(c);
  const { prompt, context, useThinking = false } = await c.req.json();

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  // User's namespace for isolated vector search
  const namespace = `user_${userId}`;

  // 1. Generate embedding for the query
  const queryEmbedding = await c.env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: prompt,
  });

  // 2. Search ONLY in user's namespace (data isolation)
  const searchResults = await c.env.VECTORIZE.query(queryEmbedding.data[0], {
    topK: 5,
    namespace: namespace, // Critical: Only search user's vectors
    returnMetadata: true,
  });

  // 3. Fetch chunk contents from D1 (with user_id check for defense in depth)
  let relevantContext = '';
  let sources = [];

  if (searchResults.matches && searchResults.matches.length > 0) {
    const chunkIds = searchResults.matches.map(m => m.id);
    const placeholders = chunkIds.map(() => '?').join(',');

    // Double-check user ownership in D1 query
    const { results: chunks } = await c.env.DB.prepare(`
      SELECT c.id, c.content, c.chunk_index, d.original_name, d.id as document_id
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.id IN (${placeholders})
        AND c.user_id = ?
        AND d.user_id = ?
    `).bind(...chunkIds, userId, userId).all();

    relevantContext = chunks
      .map((chunk, i) => `[Source ${i + 1}: ${chunk.original_name}]\n${chunk.content}`)
      .join('\n\n---\n\n');

    sources = chunks.map((chunk, i) => ({
      score: searchResults.matches[i]?.score,
      documentId: chunk.document_id,
      documentName: chunk.original_name,
      chunkIndex: chunk.chunk_index,
    }));
  }

  // 4. Build messages for Qwen3
  const systemPrompt = `You are Kira, an intelligent AI assistant for KeyReply Kira.

Your role is to help users by providing accurate, helpful responses based on their personal knowledge base.

INSTRUCTIONS:
- Use the provided knowledge base context to answer questions accurately
- If the context contains relevant information, cite the source document
- If the context doesn't contain relevant information, say so clearly
- Be professional, concise, and helpful
- Format responses with markdown when appropriate

USER'S KNOWLEDGE BASE CONTEXT:
${relevantContext || 'No relevant documents found in your knowledge base.'}

CURRENT PAGE CONTEXT: ${context || 'General'}`;

  const userPrompt = useThinking ? `/think ${prompt}` : prompt;

  // 5. Call Qwen3 for response generation
  const response = await c.env.AI.run('@cf/qwen/qwen3-30b-a3b-fp8', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 1024,
    temperature: 0.7,
  });

  return c.json({
    response: response.response,
    sources: sources.filter(s => s.score > 0.5),
    hasContext: relevantContext.length > 0,
  });
});

export default chat;
```

### Phase 6: Multi-Tenant Document Management

```javascript
// routes/documents.js
import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const documents = new Hono();

// List user's documents only
documents.get('/', async (c) => {
  const userId = getUserId(c);

  const { results } = await c.env.DB.prepare(`
    SELECT id, original_name, content_type, file_size, status, chunk_count,
           error_message, uploaded_at, processed_at
    FROM documents
    WHERE user_id = ?
    ORDER BY uploaded_at DESC
    LIMIT 100
  `).bind(userId).all();

  return c.json({ documents: results });
});

// Get document details (user-scoped)
documents.get('/:id', async (c) => {
  const userId = getUserId(c);
  const { id } = c.req.param();

  const document = await c.env.DB.prepare(`
    SELECT * FROM documents WHERE id = ? AND user_id = ?
  `).bind(id, userId).first();

  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  const { results: chunks } = await c.env.DB.prepare(`
    SELECT id, chunk_index, content FROM chunks
    WHERE document_id = ? AND user_id = ?
    ORDER BY chunk_index
  `).bind(id, userId).all();

  return c.json({ document, chunks });
});

// Delete document (user-scoped)
documents.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const { id } = c.req.param();

  // Get document (verify ownership)
  const document = await c.env.DB.prepare(
    'SELECT filename FROM documents WHERE id = ? AND user_id = ?'
  ).bind(id, userId).first();

  if (!document) {
    return c.json({ error: 'Document not found' }, 404);
  }

  // Get chunk IDs for vector deletion
  const { results: chunks } = await c.env.DB.prepare(
    'SELECT id FROM chunks WHERE document_id = ? AND user_id = ?'
  ).bind(id, userId).all();

  // Delete from Vectorize (in user's namespace)
  if (chunks.length > 0) {
    const namespace = `user_${userId}`;
    await c.env.VECTORIZE.deleteByIds(chunks.map(c => c.id), { namespace });
  }

  // Delete from D1 (chunks cascade)
  await c.env.DB.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();

  // Delete from R2
  await c.env.DOCS_BUCKET.delete(document.filename);

  return c.json({ success: true, message: 'Document deleted' });
});

// Get document stats for user
documents.get('/stats', async (c) => {
  const userId = getUserId(c);

  const stats = await c.env.DB.prepare(`
    SELECT
      COUNT(*) as total_documents,
      SUM(file_size) as total_size,
      SUM(chunk_count) as total_chunks,
      SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_documents,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_documents,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_documents
    FROM documents
    WHERE user_id = ?
  `).bind(userId).first();

  return c.json({ stats });
});

export default documents;
```

### Phase 7: Main Worker Entry Point

```javascript
// src/index.js
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authMiddleware } from './middleware/auth';
import auth from './routes/auth';
import upload from './routes/upload';
import documents from './routes/documents';
import chat from './routes/chat';

const app = new Hono();

// CORS
app.use('/*', cors({
  origin: ['https://keyreply-kira.pages.dev', 'http://localhost:5173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Public routes (no auth required)
app.route('/auth', auth);

// Protected routes (auth required)
app.use('/upload/*', authMiddleware);
app.use('/documents/*', authMiddleware);
app.use('/chat/*', authMiddleware);

app.route('/upload', upload);
app.route('/documents', documents);
app.route('/chat', chat);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

// Supported formats
app.get('/supported-formats', async (c) => {
  const formats = await c.env.AI.toMarkdown().supported();
  return c.json({ formats });
});

export default app;
```

### Phase 8: wrangler.toml Configuration

```toml
name = "keyreply-kira-api"
main = "src/index.js"
compatibility_date = "2025-11-27"
account_id = "2e25a3c929c0317b8c569a9e7491cf78"

# R2 Bucket binding (shared bucket, isolated by user path)
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "keyreply-kira-docs"

# Vectorize binding (shared index, isolated by namespace)
[[vectorize]]
binding = "VECTORIZE"
index_name = "keyreply-kira-vectors"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "keyreply-kira-db"
database_id = "<your-database-id>"

# Queue producer
[[queues.producers]]
binding = "DOC_PROCESSOR"
queue = "keyreply-kira-processor"

# Queue consumer
[[queues.consumers]]
queue = "keyreply-kira-processor"
max_batch_size = 10
max_batch_timeout = 30

# Workers AI binding
[ai]
binding = "AI"

# Environment variables
[vars]
CORS_ORIGIN = "https://keyreply-kira.pages.dev"
```

## File Structure

```
worker/
├── src/
│   ├── index.js              # Main entry with Hono app
│   ├── middleware/
│   │   └── auth.js           # Auth middleware
│   ├── routes/
│   │   ├── auth.js           # Login/register/logout
│   │   ├── upload.js         # File upload (user-scoped)
│   │   ├── documents.js      # Document CRUD (user-scoped)
│   │   └── chat.js           # RAG chat (user-scoped)
│   ├── services/
│   │   ├── processor.js      # Queue consumer
│   │   └── chunking.js       # Text chunking
│   └── utils/
│       └── crypto.js         # Password hashing
├── wrangler.toml
├── package.json
└── schema.sql

src/
├── components/
│   ├── Auth/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   └── AuthContext.jsx
│   └── KnowledgeBase/
│       ├── index.jsx
│       ├── DocumentUpload.jsx
│       ├── DocumentList.jsx
│       └── DocumentDetails.jsx
└── services/
    └── api.js
```

## API Endpoints Summary

### Public Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login and get session |
| POST | `/auth/logout` | Logout and invalidate session |
| GET | `/health` | Health check |
| GET | `/supported-formats` | List supported file formats |

### Protected Endpoints (Require Auth)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/auth/me` | Get current user info |
| POST | `/upload` | Upload document |
| GET | `/documents` | List user's documents |
| GET | `/documents/:id` | Get document details |
| DELETE | `/documents/:id` | Delete document |
| GET | `/documents/stats` | Get user's document stats |
| POST | `/chat` | RAG-enhanced chat |

## Security Checklist

- [x] **Authentication**: Session-based auth on all protected routes
- [x] **R2 Isolation**: Files stored in user-specific paths `/{user_id}/`
- [x] **Vectorize Isolation**: Vectors stored in user namespaces `user_{user_id}`
- [x] **D1 Isolation**: All queries filtered by `user_id`
- [x] **Defense in Depth**: Double-check ownership in D1 even after namespace query
- [x] **CORS**: Restricted to known origins
- [x] **Session Expiry**: Sessions expire after 7 days

## Cost Estimation (Per User)

### Free Tier Limits
- **R2**: 10 GB total (shared across all users)
- **Vectorize**: 5M vectors total (shared across all users)
- **D1**: 5 GB total (shared across all users)

### Per-User Estimate (100 users, 50 docs each)
- **R2**: 100 users × 50 docs × 500KB = 2.5 GB ✓ Free
- **Vectorize**: 100 users × 50 docs × 10 chunks = 50K vectors ✓ Free
- **D1**: 100 users × 50 docs metadata = ~100MB ✓ Free

### LLM Costs (Pay-as-you-go)
- **Input**: $0.051/M tokens
- **Output**: $0.34/M tokens
- **Per query**: ~$0.0001 (500 input + 300 output tokens)
- **1000 queries/user/month**: ~$0.10/user/month

## Deployment Commands

```bash
# 1. Create infrastructure
npx wrangler r2 bucket create keyreply-kira-docs
npx wrangler vectorize create keyreply-kira-vectors --dimensions=768 --metric=cosine
npx wrangler d1 create keyreply-kira-db
npx wrangler queues create keyreply-kira-processor

# 2. Apply D1 schema
npx wrangler d1 execute keyreply-kira-db --remote --file=./schema.sql

# 3. Deploy worker
cd worker && bun install && bun run deploy

# 4. Build and deploy frontend
bun run build && bun run deploy
```

## Sources

- [Cloudflare Vectorize Metadata Filtering](https://developers.cloudflare.com/vectorize/reference/metadata-filtering/)
- [Cloudflare RAG Tutorial](https://developers.cloudflare.com/workers-ai/guides/tutorials/build-a-retrieval-augmented-generation-ai/)
- [Workers AI Markdown Conversion](https://developers.cloudflare.com/workers-ai/features/markdown-conversion/)
- [Qwen3-30B-A3B Model](https://developers.cloudflare.com/workers-ai/models/qwen3-30b-a3b-fp8/)
- [AutoRAG Multi-tenancy](https://developers.cloudflare.com/changelog/2025-04-23-autorag-metadata-filtering/)
