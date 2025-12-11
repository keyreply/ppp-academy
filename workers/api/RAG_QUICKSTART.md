# RAG System Quick Start Guide

## Setup

### 1. Install Dependencies

```bash
npm install nanoid
# or
bun install nanoid
```

### 2. Configure Cloudflare Resources

Add to your `wrangler.toml`:

```toml
# Workers AI
[ai]
binding = "AI"

# Vectorize (768 dimensions for bge-base-en-v1.5)
[[vectorize]]
binding = "VECTORIZE"
index_name = "keyreply-kira-embeddings"
dimensions = 768
metric = "cosine"

# R2 bucket for document storage
[[r2_buckets]]
binding = "DOCS_BUCKET"
bucket_name = "keyreply-kira-documents"

# D1 database
[[d1_databases]]
binding = "DB"
database_name = "keyreply-kira-db"
database_id = "YOUR_DATABASE_ID"

# Document processing queue
[[queues.producers]]
binding = "DOCUMENT_QUEUE"
queue = "keyreply-kira-documents"

[[queues.consumers]]
queue = "keyreply-kira-documents"
max_batch_size = 10
max_batch_timeout = 30
max_retries = 3
```

### 3. Create Cloudflare Resources

```bash
# Create Vectorize index
wrangler vectorize create keyreply-kira-embeddings \
  --dimensions=768 \
  --metric=cosine

# Create R2 bucket
wrangler r2 bucket create keyreply-kira-documents

# Create queue
wrangler queues create keyreply-kira-documents

# Create D1 database (if not exists)
wrangler d1 create keyreply-kira-db
```

### 4. Create Database Tables

```bash
# Run migrations
wrangler d1 execute keyreply-kira-db --file=migrations/create_documents_tables.sql
```

**SQL Migration:**

```sql
-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  chunk_count INTEGER DEFAULT 0,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_documents_tenant ON documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- Document chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_index ON document_chunks(chunk_index);
```

## API Endpoints

### Upload Document
```bash
curl -X POST https://api.kira.keyreply.com/documents/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@document.pdf" \
  -F "title=My Document" \
  -F "description=Document description" \
  -F "tags=tag1,tag2"
```

### List Documents
```bash
curl -X GET "https://api.kira.keyreply.com/documents?limit=20&offset=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Search Documents
```bash
curl -X POST https://api.kira.keyreply.com/documents/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "How to reset password?",
    "limit": 10,
    "minScore": 0.7
  }'
```

### Ask Question (RAG)
```bash
curl -X POST https://api.kira.keyreply.com/documents/ask \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the refund policy?",
    "limit": 5,
    "temperature": 0.7
  }'
```

### Get Document Details
```bash
curl -X GET https://api.kira.keyreply.com/documents/DOC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Download Document
```bash
curl -X GET https://api.kira.keyreply.com/documents/DOC_ID/download \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o document.pdf
```

### Delete Document
```bash
curl -X DELETE https://api.kira.keyreply.com/documents/DOC_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Statistics
```bash
curl -X GET https://api.kira.keyreply.com/documents/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Document Processing Flow

```
1. Client uploads document
   ↓
2. File stored in R2
   ↓
3. Metadata saved to D1 (status: pending)
   ↓
4. Message sent to DOCUMENT_QUEUE
   ↓
5. Queue worker processes document:
   - Extract text (AI.toMarkdown for PDFs)
   - Split into chunks (800 chars, 200 overlap)
   - Generate embeddings (Workers AI)
   - Store vectors in Vectorize
   - Save chunk metadata to D1
   ↓
6. Update document status to 'processed'
   ↓
7. Update tenant usage stats
```

## Supported File Types

- PDF (application/pdf)
- Plain text (text/plain)
- Markdown (text/markdown)
- Word documents (application/msword, .docx)
- CSV (text/csv)
- JSON (application/json)

**Max file size:** 50MB

## RAG Configuration

### Chunking
- **Size:** 800 characters (~200 tokens)
- **Overlap:** 200 characters
- **Strategy:** Simple sliding window

### Embeddings
- **Model:** @cf/baai/bge-base-en-v1.5
- **Dimensions:** 768
- **Max input:** ~512 tokens (2000 chars)

### Search
- **Metric:** Cosine similarity
- **Default min score:** 0.7
- **Default limit:** 10 results

### Generation
- **Model:** @cf/qwen/qwen3-30b-a3b-fp8
- **Default temperature:** 0.7
- **Default max tokens:** 2000
- **Context chunks:** 5 (default)

## Code Usage Examples

### JavaScript/TypeScript Client

```javascript
// Upload document
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('title', 'My Document');
formData.append('tags', 'important,guide');

const uploadResponse = await fetch('/documents/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});

const { document } = await uploadResponse.json();
console.log('Uploaded:', document.id);

// Search documents
const searchResponse = await fetch('/documents/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'How to reset password?',
    limit: 5,
    minScore: 0.75
  })
});

const { results } = await searchResponse.json();
results.forEach(result => {
  console.log(`Score: ${result.score}, Text: ${result.text}`);
});

// Ask question (RAG)
const askResponse = await fetch('/documents/ask', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    query: 'What is the return policy?',
    temperature: 0.7,
    maxTokens: 1000
  })
});

const { answer, sources } = await askResponse.json();
console.log('Answer:', answer);
console.log('Sources:', sources.map(s => s.filename));
```

### React Component Example

```jsx
import { useState } from 'react';

function DocumentSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/documents/ask', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question..."
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {results && (
        <div>
          <h3>Answer:</h3>
          <p>{results.answer}</p>

          <h4>Sources:</h4>
          <ul>
            {results.sources.map((source, idx) => (
              <li key={idx}>
                {source.filename} (score: {source.score.toFixed(2)})
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

## Testing

### Local Development

```bash
# Start local development server
wrangler dev

# Test upload
curl -X POST http://localhost:8787/documents/upload \
  -H "Authorization: Bearer test_token" \
  -F "file=@test.pdf"

# Monitor logs
wrangler tail
```

### Queue Testing

```bash
# Send test message to queue
wrangler queues producer publish keyreply-kira-documents \
  --body='{"type":"document.process","data":{"documentId":"test_doc","tenantId":"test_tenant"}}'

# Monitor queue
wrangler queues consumer worker keyreply-kira-documents
```

## Troubleshooting

### Document stuck in "pending" status
- Check queue is running: `wrangler queues consumer worker keyreply-kira-documents`
- Check queue messages: `wrangler tail --format json`
- Manually trigger processing: `POST /documents/{id}/reprocess`

### Embeddings not generated
- Verify Workers AI binding is configured
- Check text extraction succeeded
- Review chunk count in document metadata

### Search returns no results
- Lower `minScore` threshold (try 0.5)
- Verify documents are processed (status: 'processed')
- Check namespace matches tenant ID

### High latency
- Reduce chunk limit in search/ask
- Enable caching for frequent queries
- Consider increasing queue batch size

## Monitoring

### Key Metrics to Track
- Upload success rate
- Average processing time
- Embedding generation latency
- Search query latency
- Error rate by type
- Storage usage per tenant
- Queue depth and lag

### Cloudflare Dashboard
- Workers Analytics: Request volume and errors
- R2 Analytics: Storage usage and bandwidth
- Vectorize Metrics: Query performance
- Queue Metrics: Message throughput and latency

## Cost Estimation

### Per 1000 Documents (avg 10 pages each)
- **R2 Storage:** $0.015/GB/month (~$0.15 for 10GB)
- **Vectorize:** $0.04/million dimensions (~$3.07 for 768×10,000 chunks)
- **Workers AI:**
  - Embeddings: $0.01/1000 chunks (~$0.10)
  - Generation: $0.01/1000 requests (~$0.01)
- **Queue:** $0.40/million messages (~$0.004)
- **D1:** Free tier covers most use cases

**Estimated cost:** ~$3.40/month for 1000 documents with 100 queries/day

## Security Best Practices

1. **Always validate tenant isolation** in queries
2. **Limit file sizes** to prevent abuse (50MB default)
3. **Sanitize file uploads** - check MIME types
4. **Rate limit uploads** per tenant
5. **Monitor quota usage** - track documents and storage
6. **Audit logging** - log all document operations
7. **Secure deletion** - remove all associated data
8. **API key rotation** - regular key updates

## Next Steps

1. Deploy worker: `wrangler deploy`
2. Create database migrations
3. Set up monitoring and alerts
4. Configure quotas per plan tier
5. Add frontend document manager
6. Implement file validation
7. Set up backup strategy
8. Document API for users

## Resources

- **Full Documentation:** `src/services/RAG_DOCUMENTATION.md`
- **RAG Service:** `src/services/rag.js`
- **API Routes:** `src/routes/documents.js`
- **Cloudflare Docs:** https://developers.cloudflare.com/
- **Workers AI Models:** https://developers.cloudflare.com/workers-ai/models/

## Support

Questions? Issues?
- GitHub: github.com/keyreply-kira
- Email: support@kira.keyreply.com
- Docs: docs.kira.keyreply.com
