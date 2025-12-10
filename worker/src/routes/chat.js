import { Hono } from 'hono';
import { getUserId } from '../middleware/auth';

const chat = new Hono();

/**
 * POST /chat
 * Generate an AI response based on the user's knowledge base
 */
chat.post('/', async (c) => {
    const userId = getUserId(c);
    // Default to false for thinking mode if not provided
    const { prompt, context, useThinking = false } = await c.req.json();

    if (!prompt) {
        return c.json({ error: 'Prompt is required' }, 400);
    }

    // User's namespace for isolated vector search
    const namespace = `user_${userId}`;

    try {
        // 1. Generate embedding for the query
        // Use the BGE base model for embeddings
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
            // Create placeholders for SQL query: ?,?,?
            const placeholders = chunkIds.map(() => '?').join(',');

            // Double-check user ownership in D1 query
            // We join chunks with documents to get original filename
            const { results: chunks } = await c.env.DB.prepare(`
        SELECT c.id, c.content, c.chunk_index, d.original_name, d.id as document_id
        FROM chunks c
        JOIN documents d ON c.document_id = d.id
        WHERE c.id IN (${placeholders})
          AND c.user_id = ?
          AND d.user_id = ?
      `).bind(...chunkIds, userId, userId).all();

            // Format context for LLM
            relevantContext = chunks
                .map((chunk, i) => `[Source ${i + 1}: ${chunk.original_name}]\n${chunk.content}`)
                .join('\n\n---\n\n');

            // Prepare sources list for frontend
            sources = chunks.map((chunk, i) => ({
                score: searchResults.matches.find(m => m.id === chunk.id)?.score || 0,
                documentId: chunk.document_id,
                documentName: chunk.original_name,
                chunkIndex: chunk.chunk_index,
            }));
        }

        // 4. Build messages for Qwen3
        const systemPrompt = `You are Kira, an intelligent AI assistant for PPP Academy.

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
            response: response.response, // Qwen response
            sources: sources.filter(s => s.score > 0.5), // Filter low relevance sources
            hasContext: relevantContext.length > 0,
        });

    } catch (error) {
        console.error('Chat endpoint error:', error);
        return c.json({ error: 'Failed to generate response', details: error.message }, 500);
    }
});

export default chat;
