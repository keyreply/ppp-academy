# AI Search Migration Guide

This document describes how to set up Cloudflare AI Search for the KeyReply Kira AI API.

## Prerequisites

- Cloudflare account with Workers subscription
- R2 bucket already created (`keyreply-kira-docs`)
- Wrangler CLI installed and authenticated

## 1. Create AI Search Instance

AI Search automatically indexes documents in your R2 bucket.

```bash
# Create AI Search instance connected to your R2 bucket
wrangler ai search create keyreply-kira-search \
  --r2-bucket keyreply-kira-docs \
  --description "KeyReply Kira AI knowledge base search"
```

Or via the Cloudflare Dashboard:
1. Go to **AI Search** in the sidebar
2. Click **Create**
3. Select your R2 bucket (`keyreply-kira-docs`)
4. Name it `keyreply-kira-search`

## 2. Create AI Gateway

AI Gateway provides monitoring, caching, and rate limiting for AI requests.

```bash
# Create AI Gateway
wrangler ai gateway create keyreply-kira-gateway
```

Or via Dashboard:
1. Go to **AI Gateway** in the sidebar
2. Click **Create Gateway**
3. Name it `keyreply-kira-gateway`

## 3. Configure AI Search Settings

After creation, configure these settings in the Dashboard:

### Indexing Configuration
- **Chunk size**: 800 characters (default)
- **Chunk overlap**: 200 characters

### Retrieval Configuration
- **Match threshold**: 0.5 (minimum similarity score)
- **Max results**: 10 (default)
- **Reranking**: Enabled

### Model Selection
- **Generation model**: Smart Default (recommended)
  - AI Search automatically picks the optimal model based on query complexity
  - Can be overridden per-request if needed

### Similarity Cache
- **Enabled**: Yes
- **Threshold**: 0.8 (reuse cached responses for similar queries)
- **Cache duration**: 30 days (automatic)

### AI Gateway Integration
- Connect to `keyreply-kira-gateway` for logging and analytics

## 4. Verify Wrangler Configuration

Your `wrangler.toml` should have:

```toml
# AI Search instance for RAG (replaces Vectorize)
# Uses automatic chunking, embeddings, similarity cache, and AI Gateway
# Multitenancy via folder-based metadata filtering: {tenantId}/documents/
# Create via: wrangler ai search create keyreply-kira-search --r2-bucket keyreply-kira-docs
# Note: AI binding provides access via env.AI.autorag("keyreply-kira-search")

# AI Gateway for monitoring, caching, and rate limiting
# Create via: wrangler ai gateway create keyreply-kira-gateway
[ai]
binding = "AI"
gateway = { id = "keyreply-kira-gateway" }
```

## 5. Multitenancy Setup

Documents are organized by tenant using folder paths in R2:

```
R2 Bucket: keyreply-kira-docs
├── tenant_abc123/
│   └── documents/
│       ├── doc1_report.pdf
│       └── doc2_guide.docx
├── tenant_xyz789/
│   └── documents/
│       └── doc3_manual.pdf
└── user_john/
    └── documents/
        └── personal_notes.txt
```

### Folder-Based Filtering

AI Search queries use folder metadata filters for tenant isolation:

```typescript
// Tenant-scoped search
const filter = {
  type: 'and',
  filters: [
    { type: 'gt', key: 'folder', value: `${tenantId}/documents//` },
    { type: 'lte', key: 'folder', value: `${tenantId}/documents/z` }
  ]
};

const results = await env.AI.autorag('keyreply-kira-search').search({
  query: 'user question',
  filters: filter,
  max_num_results: 10
});
```

## 6. Migration from Vectorize

### What Changed

| Before (Vectorize) | After (AI Search) |
|-------------------|-------------------|
| Manual chunking in `rag.ts` | Automatic chunking by AI Search |
| Manual embedding generation | Automatic embeddings |
| Vectorize namespace for isolation | Folder-based metadata filtering |
| D1 `document_chunks` table | Not needed - AI Search stores chunks |
| Manual queue processing | Auto-indexing on R2 upload |

### Database Changes

The `document_chunks` table is no longer needed. Documents table still tracks metadata:

```sql
-- documents table (still used)
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  filename TEXT NOT NULL,
  original_name TEXT,
  content_type TEXT,
  file_size INTEGER,
  storage_path TEXT NOT NULL,  -- R2 key
  status TEXT DEFAULT 'indexing',
  metadata TEXT,  -- JSON
  created_at TEXT,
  updated_at TEXT
);

-- document_chunks table (NO LONGER NEEDED)
-- Can be dropped after migration verification
```

### Code Changes

1. **Upload**: Documents go directly to R2, AI Search indexes automatically
2. **Search**: Use `env.AI.autorag().search()` or `.aiSearch()`
3. **Delete**: Delete from R2, AI Search removes from index automatically
4. **No queue processing**: Removed embedding/chunking from queue handler

## 7. API Endpoints

### Chat with RAG
```
POST /chat
{
  "prompt": "What is the return policy?",
  "context": "Customer Support"
}
```

### Search Only (no AI generation)
```
POST /chat/search
{
  "query": "return policy",
  "limit": 10,
  "minScore": 0.5
}
```

### Upload Document
```
POST /upload
Content-Type: multipart/form-data
file: <document>
description: "Product return policy document"
```

## 8. Monitoring

View AI Search and Gateway metrics in the Cloudflare Dashboard:

- **AI Search** > **Overview**: Indexing status, query volume
- **AI Gateway** > **Analytics**: Request logs, latency, cache hit rate

### Cache Status Header

Check if a response came from similarity cache:
- `cf-aig-cache-status: HIT` - Cached response
- `cf-aig-cache-status: MISS` - New response generated

## 9. Troubleshooting

### Documents Not Being Indexed
1. Check R2 bucket is connected to AI Search instance
2. Verify file format is supported (PDF, TXT, MD, DOCX, etc.)
3. Check document size (max varies by plan)

### No Search Results
1. Verify tenant folder path matches document location
2. Check `score_threshold` isn't too high
3. Ensure documents have been indexed (check Dashboard)

### Slow Responses
1. Enable similarity cache for repeated queries
2. Use AI Gateway for request caching
3. Reduce `max_num_results` if not all needed

## 10. Cost Considerations

AI Search pricing includes:
- **Storage**: Based on R2 usage
- **Embeddings**: Per token for indexing
- **Search queries**: Per query
- **AI generation**: Per token for aiSearch()

Optimize costs:
- Enable similarity cache (30-day retention)
- Use AI Gateway caching for repeated queries
- Set appropriate `max_num_results` limits
