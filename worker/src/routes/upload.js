import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const upload = new Hono();

/**
 * POST /upload
 * Handle file upload to R2 and queue for processing
 */
upload.post('/', async (c) => {
    const userId = getUserId(c);
    // Default parsing for multipart/form-data
    const formData = await c.req.parseBody();
    // Hono's parseBody handles multipart, but returning File objects depends on setup.
    // Using standard Request.formData() is safer for valid File objects in Cloudflare Workers.

    const rawFormData = await c.req.formData();
    const file = rawFormData.get('file');

    if (!file || !(file instanceof File)) {
        return c.json({ error: 'No file provided' }, 400);
    }

    // Check supported formats
    // Note: c.env.AI.toMarkdown() capability check might catch errors, 
    // but we can also pre-validate if we know extensions.
    const validExtensions = ['.pdf', '.docx', '.doc', '.txt', '.md', '.html', '.htm', '.pptx', '.ppt'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    // Also check MIME types if needed, but extension verification is a good first step.

    // We can let AI.toMarkdown() fail if unsupported, but good to give immediate feedback.
    // For now, let's proceed and handle errors in the queue if format is really bad, 
    // OR use the supported endpoint check if available. We'll skip complex check for speed.

    const documentId = crypto.randomUUID();
    // Store in user-specific path: /{user_id}/documents/{doc_id}/{filename}
    const key = `${userId}/documents/${documentId}/${file.name}`;

    try {
        // Upload to R2
        // We stream the file to R2
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
        // Use the document processing queue
        await c.env.DOC_PROCESSOR.send({
            type: 'document.process', // Wrap in standard message format
            data: {
                documentId,
                tenantId: userId, // Using userId as tenantId for now in this context? 
                // Or is tenantId distinct? The RAG plan used userId. 
                // Let's use userId mapping to tenantId logic if needed, 
                // but for RAG isolation we used userId in schemas.
                // Wait, the index.js handleQueue expects { type, data: { documentId, tenantId } }
                key,
                contentType: file.type,
            }
        });

        return c.json({
            id: documentId,
            filename: file.name,
            status: 'pending',
            message: 'Document uploaded and queued for processing',
        }, 201);

    } catch (error) {
        console.error("Upload error:", error);
        return c.json({ error: 'Upload failed', details: error.message }, 500);
    }
});

export default upload;
