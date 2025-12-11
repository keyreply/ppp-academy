import { Hono } from 'hono';
import { getUserId, getTenantId } from '../middleware/auth';
import { nanoid } from 'nanoid';

const upload = new Hono();

// Valid file extensions for AI Search indexing
const VALID_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm', '.pptx', '.ppt', '.csv', '.json'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * POST /upload
 * Upload document to R2 for AI Search automatic indexing
 *
 * AI Search automatically indexes R2 bucket content, so we just need to:
 * 1. Upload to R2 with proper folder structure for multitenancy
 * 2. Store metadata in D1 for document management
 *
 * Folder structure: {tenantId}/documents/{documentId}_{filename}
 * AI Search uses folder-based metadata filtering for tenant isolation
 */
upload.post('/', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`; // Fallback to user-based tenant

  const rawFormData = await c.req.formData();
  const file = rawFormData.get('file');
  const description = rawFormData.get('description') as string || '';

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // Validate file extension
  const hasValidExt = VALID_EXTENSIONS.some(ext =>
    file.name.toLowerCase().endsWith(ext)
  );
  if (!hasValidExt) {
    return c.json({
      error: 'Unsupported file format',
      supported: VALID_EXTENSIONS
    }, 400);
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return c.json({
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
    }, 400);
  }

  const documentId = nanoid();
  const timestamp = new Date().toISOString();

  // R2 key with tenant folder structure for AI Search multitenancy
  // Format: {tenantId}/documents/{documentId}_{filename}
  const r2Key = `${tenantId}/documents/${documentId}_${file.name}`;

  try {
    // Upload to R2 with context metadata for AI Search
    // AI Search automatically indexes new R2 objects
    await c.env.DOCS_BUCKET.put(r2Key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: {
        // AI Search uses 'context' field for additional LLM context
        context: description || `Document: ${file.name}`,
        tenantId,
        documentId,
        userId,
        originalName: file.name,
        uploadedAt: timestamp
      }
    });

    // Store document metadata in D1 for management/listing
    await c.env.DB.prepare(`
      INSERT INTO documents (id, tenant_id, user_id, filename, original_name, content_type, file_size, storage_path, status, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      documentId,
      tenantId,
      userId,
      r2Key,
      file.name,
      file.type,
      file.size,
      r2Key,
      'indexing', // AI Search handles processing automatically
      JSON.stringify({ description }),
      timestamp,
      timestamp
    ).run();

    // Update tenant usage tracking
    try {
      const tenantStub = c.env.TENANT.get(c.env.TENANT.idFromName(tenantId));
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

    return c.json({
      id: documentId,
      filename: file.name,
      size: file.size,
      status: 'indexing',
      r2Key,
      message: 'Document uploaded. AI Search will index automatically.'
    }, 201);

  } catch (error) {
    console.error('Upload error:', error);
    return c.json({
      error: 'Upload failed',
      details: (error as Error).message
    }, 500);
  }
});

/**
 * POST /upload/batch
 * Upload multiple documents at once
 */
upload.post('/batch', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;

  const rawFormData = await c.req.formData();
  const files = rawFormData.getAll('files');

  if (!files || files.length === 0) {
    return c.json({ error: 'No files provided' }, 400);
  }

  const results: Array<{
    filename: string;
    status: 'success' | 'error';
    id?: string;
    error?: string;
  }> = [];

  for (const file of files) {
    if (!(file instanceof File)) {
      results.push({
        filename: 'unknown',
        status: 'error',
        error: 'Invalid file object'
      });
      continue;
    }

    // Validate extension
    const hasValidExt = VALID_EXTENSIONS.some(ext =>
      file.name.toLowerCase().endsWith(ext)
    );
    if (!hasValidExt) {
      results.push({
        filename: file.name,
        status: 'error',
        error: 'Unsupported file format'
      });
      continue;
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      results.push({
        filename: file.name,
        status: 'error',
        error: 'File too large'
      });
      continue;
    }

    const documentId = nanoid();
    const timestamp = new Date().toISOString();
    const r2Key = `${tenantId}/documents/${documentId}_${file.name}`;

    try {
      await c.env.DOCS_BUCKET.put(r2Key, file.stream(), {
        httpMetadata: { contentType: file.type },
        customMetadata: {
          context: `Document: ${file.name}`,
          tenantId,
          documentId,
          userId,
          originalName: file.name,
          uploadedAt: timestamp
        }
      });

      await c.env.DB.prepare(`
        INSERT INTO documents (id, tenant_id, user_id, filename, original_name, content_type, file_size, storage_path, status, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        documentId,
        tenantId,
        userId,
        r2Key,
        file.name,
        file.type,
        file.size,
        r2Key,
        'indexing',
        JSON.stringify({}),
        timestamp,
        timestamp
      ).run();

      results.push({
        filename: file.name,
        status: 'success',
        id: documentId
      });
    } catch (error) {
      results.push({
        filename: file.name,
        status: 'error',
        error: (error as Error).message
      });
    }
  }

  const successful = results.filter(r => r.status === 'success').length;
  const failed = results.filter(r => r.status === 'error').length;

  return c.json({
    message: `Uploaded ${successful} files, ${failed} failed`,
    results
  }, successful > 0 ? 201 : 400);
});

export default upload;
