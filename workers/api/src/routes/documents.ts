import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const documents = new Hono();

/**
 * GET /documents
 * List user's documents
 */
documents.get('/', async (c) => {
  const userId = getUserId(c);

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, original_name, content_type, file_size, status, chunk_count,
             error_message, uploaded_at, processed_at
      FROM documents
      WHERE user_id = ?
      ORDER BY uploaded_at DESC
      LIMIT 100
    `).bind(userId).all();

    return c.json({ documents: results });
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
  const id = c.req.param('id');

  try {
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
  } catch (error) {
    console.error('Get document error:', error);
    return c.json({ error: 'Failed to get document' }, 500);
  }
});

/**
 * DELETE /documents/:id
 * Delete document and its embeddings
 */
documents.delete('/:id', async (c) => {
  const userId = getUserId(c);
  const id = c.req.param('id');

  try {
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
      // Vectorize supports deleteByIds
      await c.env.VECTORIZE.deleteByIds(chunks.map(c => c.id), { namespace });
    }

    // Delete from D1 (Foreign Key CASCADE usually handles chunks if configured, 
    // but explicit delete is safer if CASCADE not set).
    // Our plan script had CASCADE, so deleting document should be enough for D1 chunks.
    await c.env.DB.prepare('DELETE FROM documents WHERE id = ? AND user_id = ?')
      .bind(id, userId).run();

    // Delete from R2
    // Verify filename property exists
    if (document.filename) {
      await c.env.DOCS_BUCKET.delete(document.filename);
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

  try {
    const stats = await c.env.DB.prepare(`
      SELECT
        COUNT(*) as total_documents,
        SUM(COALESCE(file_size, 0)) as total_size,
        SUM(COALESCE(chunk_count, 0)) as total_chunks,
        SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) as ready_documents,
        SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing_documents,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_documents
      FROM documents
      WHERE user_id = ?
    `).bind(userId).first();

    return c.json({ stats });
  } catch (error) {
    console.error('Stats error:', error);
    return c.json({ error: 'Failed to get stats' }, 500);
  }
});

export default documents;
