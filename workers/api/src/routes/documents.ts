import { Hono } from 'hono';
import { getUserId, getTenantId } from '../middleware/auth';

const documents = new Hono();

/**
 * GET /documents
 * List user's documents
 *
 * With AI Search, documents are automatically indexed when uploaded to R2.
 * This endpoint lists document metadata from D1.
 */
documents.get('/', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, original_name, content_type, file_size, status, storage_path,
             metadata, created_at, updated_at
      FROM documents
      WHERE tenant_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    `).bind(tenantId).all();

    // Parse metadata JSON for each document
    const documents = results.map(doc => ({
      ...doc,
      metadata: doc.metadata ? JSON.parse(doc.metadata as string) : {}
    }));

    return c.json({ documents });
  } catch (error) {
    console.error('List documents error:', error);
    return c.json({ error: 'Failed to list documents' }, 500);
  }
});

/**
 * GET /documents/:id
 * Get document details
 */
documents.get('/:id', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;
  const id = c.req.param('id');

  try {
    const document = await c.env.DB.prepare(`
      SELECT * FROM documents WHERE id = ? AND tenant_id = ?
    `).bind(id, tenantId).first();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // AI Search handles chunking automatically - no chunks table needed
    return c.json({
      document: {
        ...document,
        metadata: document.metadata ? JSON.parse(document.metadata as string) : {}
      }
    });
  } catch (error) {
    console.error('Get document error:', error);
    return c.json({ error: 'Failed to get document' }, 500);
  }
});

/**
 * DELETE /documents/:id
 * Delete document from R2 and D1
 *
 * AI Search automatically removes the document from its index
 * when the R2 object is deleted.
 */
documents.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;
  const id = c.req.param('id');

  try {
    // Get document (verify ownership)
    const document = await c.env.DB.prepare(
      'SELECT storage_path, file_size FROM documents WHERE id = ? AND tenant_id = ?'
    ).bind(id, tenantId).first();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    // Delete from R2 (AI Search auto-removes from index)
    if (document.storage_path) {
      try {
        await c.env.DOCS_BUCKET.delete(document.storage_path as string);
      } catch (err) {
        console.error('Failed to delete from R2:', err);
      }
    }

    // Delete metadata from D1
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ? AND tenant_id = ?')
      .bind(id, tenantId).run();

    // Update tenant usage tracking
    try {
      const tenantStub = c.env.TENANT.get(c.env.TENANT.idFromName(tenantId));

      await tenantStub.fetch('http://internal/usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: 'documents_count',
          increment: -1
        })
      });

      if (document.file_size) {
        const fileSizeMB = (document.file_size as number) / (1024 * 1024);
        await tenantStub.fetch('http://internal/usage/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            metric: 'storage_used_mb',
            increment: -fileSizeMB
          })
        });
      }
    } catch (err) {
      console.error('Failed to update tenant usage:', err);
    }

    return c.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    return c.json({ error: 'Failed to delete document' }, 500);
  }
});

/**
 * GET /documents/stats/summary
 * Get usage stats
 */
documents.get('/stats/summary', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;

  try {
    const stats = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_documents,
        SUM(COALESCE(file_size, 0)) as total_size,
        SUM(CASE WHEN status = 'indexing' THEN 1 ELSE 0 END) as indexing_documents,
        SUM(CASE WHEN status = 'ready' OR status = 'indexed' THEN 1 ELSE 0 END) as ready_documents,
        SUM(CASE WHEN status = 'failed' OR status = 'error' THEN 1 ELSE 0 END) as failed_documents
      FROM documents
      WHERE tenant_id = ?
    `).bind(tenantId).first();

    return c.json({ stats });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

/**
 * GET /documents/:id/download
 * Download document file from R2
 */
documents.get('/:id/download', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;
  const id = c.req.param('id');

  try {
    const document = await c.env.DB.prepare(`
      SELECT storage_path, original_name, content_type FROM documents
      WHERE id = ? AND tenant_id = ?
    `).bind(id, tenantId).first();

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    const r2Object = await c.env.DOCS_BUCKET.get(document.storage_path as string);

    if (!r2Object) {
      return c.json({ error: 'Document file not found in storage' }, 404);
    }

    return new Response(r2Object.body, {
      headers: {
        'Content-Type': document.content_type as string || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${document.original_name}"`,
        'Content-Length': r2Object.size.toString()
      }
    });
  } catch (error) {
    console.error('Download error:', error);
    return c.json({ error: 'Failed to download document' }, 500);
  }
});

export default documents;
