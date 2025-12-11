import { Hono } from 'hono';
import { streamText } from 'ai';
import { createWorkersAI } from 'workers-ai-provider';
import { getUserId, getTenantId } from '../middleware/auth';

// AI Search instance name
const AI_SEARCH_INSTANCE = 'keyreply-kira-search';

// Default model for chat
const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// Knowledge source folders
const KNOWLEDGE_SOURCES = {
  user: (tenantId: string) => `${tenantId}/documents/`,
  self: () => 'kira.self/documents/',  // Kira's own documentation
  all: (tenantId: string) => null  // No filter - search everything accessible
} as const;

type KnowledgeSource = keyof typeof KNOWLEDGE_SOURCES;

const chat = new Hono();

/**
 * Build folder filter for AI Search based on knowledge source
 *
 * Filter format per Cloudflare docs:
 * - Use 'eq' for exact folder match (non-recursive)
 * - Use 'gt' + 'lte' with 'and' for recursive folder match (starts with)
 *
 * For "starts with" behavior, use:
 *   gt: "folder//" (double slash - ASCII greater than /)
 *   lte: "folder/z" (ASCII less than or equal to z)
 */
function buildFolderFilter(source: KnowledgeSource, tenantId: string) {
  // For 'all', don't apply any filter - search everything
  if (source === 'all') {
    return undefined;
  }

  // Base folder path (without trailing slash)
  const baseFolder = source === 'self'
    ? 'kira.self'
    : tenantId;

  // Use recursive folder filter (gt/lte pattern from Cloudflare docs)
  // gt: "folder//" captures paths starting after "/" ASCII character
  // lte: "folder/z" captures paths up to "z" ASCII character
  return {
    type: 'and' as const,
    filters: [
      { type: 'gt' as const, key: 'folder', value: `${baseFolder}//` },
      { type: 'lte' as const, key: 'folder', value: `${baseFolder}/z` }
    ]
  };
}

/**
 * POST /chat
 * Generate an AI response using AI Search RAG
 *
 * Uses Cloudflare AI Search for:
 * - Automatic document retrieval with similarity cache
 * - Folder-based multitenancy for user isolation
 * - AI Gateway for monitoring and rate limiting
 *
 * @param knowledgeSource - 'user' (default), 'self' (Kira docs), or 'all' (both)
 */
chat.post('/', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;
  const {
    prompt,
    context,
    useThinking = false,
    knowledgeSource = 'user'  // 'user' | 'self' | 'all'
  } = await c.req.json();

  if (!prompt) {
    return c.json({ error: 'Prompt is required' }, 400);
  }

  // Validate knowledge source
  const validSources: KnowledgeSource[] = ['user', 'self', 'all'];
  const source: KnowledgeSource = validSources.includes(knowledgeSource) ? knowledgeSource : 'user';

  try {
    // Get AI Search instance via AI binding
    const autorag = c.env.AI.autorag(AI_SEARCH_INSTANCE);

    // Build folder filter based on knowledge source
    const filter = buildFolderFilter(source, tenantId);

    // Build system prompt based on knowledge source
    const sourceDescription = source === 'self'
      ? "Kira's own documentation and codebase knowledge"
      : source === 'all'
        ? "both your personal knowledge base and Kira's documentation"
        : "your personal knowledge base";

    const systemPrompt = `You are Kira, an intelligent AI assistant for KeyReply Kira.

Your role is to help users by providing accurate, helpful responses based on ${sourceDescription}.

KNOWLEDGE SOURCE: ${source === 'self' ? 'Kira Self-Documentation' : source === 'all' ? 'All Sources' : 'User Documents'}

INSTRUCTIONS:
- Use the provided knowledge base context to answer questions accurately
- If the context contains relevant information, cite the source document
- If the context doesn't contain relevant information, say so clearly
- Be professional, concise, and helpful
- Format responses with markdown when appropriate
${source === 'self' ? '- When answering about Kira features, be specific about implementation details\n- Reference file paths when discussing code structure' : ''}

CURRENT PAGE CONTEXT: ${context || 'General'}`;

    // Optionally enable thinking mode
    const finalQuery = useThinking ? `/think ${prompt}` : prompt;

    // Use AI Search aiSearch() for combined retrieval + generation
    // This leverages similarity cache for repeated queries
    // Start with minimal options matching Cloudflare sample code
    const searchOptions: {
      query: string;
      system_prompt?: string;
      max_num_results?: number;
      filters?: unknown;
    } = {
      query: finalQuery
    };

    // Add optional parameters
    if (systemPrompt) {
      searchOptions.system_prompt = systemPrompt;
    }

    // Only add filters if defined (for 'all' source, we don't filter)
    if (filter) {
      searchOptions.filters = filter;
    }

    console.log('AI Search request:', JSON.stringify(searchOptions, null, 2));

    const response = await autorag.aiSearch(searchOptions);

    console.log('AI Search response:', JSON.stringify(response, null, 2));

    // Extract sources from search results
    const sources = (response.data || []).map(result => ({
      score: result.score,
      documentName: result.filename.split('/').pop() || result.filename,
      preview: result.content?.[0]?.text?.substring(0, 150) || ''
    }));

    return c.json({
      response: response.response || "I couldn't find relevant information to answer your question.",
      sources: sources.filter(s => s.score > 0.5),
      hasContext: sources.length > 0,
      searchQuery: response.search_query, // Rewritten query if applicable
      knowledgeSource: source  // Return which source was used
    });

  } catch (error) {
    console.error('Chat endpoint error:', error);
    return c.json({
      error: 'Failed to generate response',
      details: (error as Error).message
    }, 500);
  }
});

/**
 * POST /chat/search
 * Search documents without AI generation (retrieval only)
 */
chat.post('/search', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;
  const {
    query,
    limit = 10,
    minScore = 0.5,
    knowledgeSource = 'user'
  } = await c.req.json();

  if (!query) {
    return c.json({ error: 'Query is required' }, 400);
  }

  // Validate knowledge source
  const validSources: KnowledgeSource[] = ['user', 'self', 'all'];
  const source: KnowledgeSource = validSources.includes(knowledgeSource) ? knowledgeSource : 'user';

  try {
    const autorag = c.env.AI.autorag(AI_SEARCH_INSTANCE);

    // Build filter based on knowledge source
    const filter = buildFolderFilter(source, tenantId);

    // Build search options - keep minimal like aiSearch
    const searchOptions: {
      query: string;
      max_num_results?: number;
      filters?: unknown;
    } = {
      query,
      max_num_results: Math.min(limit, 50)
    };

    // Only add filters if defined
    if (filter) {
      searchOptions.filters = filter;
    }

    console.log('Search request:', JSON.stringify(searchOptions, null, 2));

    // Use search() for retrieval-only (no AI generation)
    const response = await autorag.search(searchOptions);

    console.log('Search response:', JSON.stringify(response, null, 2));

    const results = (response.data || []).map(result => ({
      filename: result.filename.split('/').pop() || result.filename,
      fullPath: result.filename,
      score: result.score,
      folder: result.attributes.folder,
      modifiedDate: new Date(result.attributes.modified_date).toISOString(),
      content: result.content.map(c => ({
        id: c.id,
        text: c.text
      }))
    }));

    return c.json({
      query: response.search_query,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Search endpoint error:', error);
    return c.json({
      error: 'Search failed',
      details: (error as Error).message
    }, 500);
  }
});

/**
 * POST /chat/stream
 * Streaming chat endpoint compatible with AI SDK useChat hook
 *
 * This endpoint receives messages in the AI SDK format and returns
 * a streaming response using Server-Sent Events (SSE).
 *
 * Request body:
 * - messages: Array of { role: 'user' | 'assistant', content: string }
 * - context?: string - Current page context
 * - knowledgeSource?: 'user' | 'self' | 'all'
 */
chat.post('/stream', async (c) => {
  const userId = getUserId(c);
  const tenantId = getTenantId(c) || `user_${userId}`;
  const body = await c.req.json();

  const {
    messages,
    context,
    knowledgeSource = 'all'
  } = body as {
    messages: Array<{ id: string; role: 'user' | 'assistant' | 'system'; content?: string; parts?: Array<{ type: string; text?: string }> }>;
    context?: string;
    knowledgeSource?: KnowledgeSource;
  };

  if (!messages || messages.length === 0) {
    return c.json({ error: 'Messages are required' }, 400);
  }

  // Validate knowledge source
  const validSources: KnowledgeSource[] = ['user', 'self', 'all'];
  const source: KnowledgeSource = validSources.includes(knowledgeSource) ? knowledgeSource : 'all';

  try {
    // Get the last user message for RAG context retrieval
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    // In AI SDK v6, message content can be string (legacy) or parts array
    let userQuery = '';
    if (lastUserMessage) {
      if (typeof lastUserMessage.content === 'string') {
        userQuery = lastUserMessage.content;
      } else if (lastUserMessage.parts && Array.isArray(lastUserMessage.parts)) {
        // Extract text from parts
        userQuery = lastUserMessage.parts
          .filter((p: { type: string }) => p.type === 'text')
          .map((p: { type: string; text?: string }) => p.text || '')
          .join(' ');
      }
    }

    // Step 1: Retrieve relevant context using AI Search
    let ragContext = '';
    let sources: Array<{ documentName: string; score: number; preview: string }> = [];

    if (userQuery) {
      try {
        const autorag = c.env.AI.autorag(AI_SEARCH_INSTANCE);
        const filter = buildFolderFilter(source, tenantId);

        const searchOptions: {
          query: string;
          max_num_results?: number;
          filters?: unknown;
        } = {
          query: userQuery,
          max_num_results: 5
        };

        if (filter) {
          searchOptions.filters = filter;
        }

        const searchResponse = await autorag.search(searchOptions);

        // Build RAG context from search results
        if (searchResponse.data && searchResponse.data.length > 0) {
          sources = searchResponse.data.map(result => ({
            score: result.score,
            documentName: result.filename.split('/').pop() || result.filename,
            preview: result.content?.[0]?.text?.substring(0, 150) || ''
          })).filter(s => s.score > 0.5);

          // Build context string from relevant documents
          ragContext = searchResponse.data
            .filter(r => r.score > 0.5)
            .map(r => {
              const docName = r.filename.split('/').pop() || r.filename;
              const content = r.content.map(c => c.text).join('\n');
              return `[Document: ${docName}]\n${content}`;
            })
            .join('\n\n---\n\n');
        }
      } catch (ragError) {
        console.error('RAG retrieval error:', ragError);
        // Continue without RAG context if retrieval fails
      }
    }

    // Step 2: Build system prompt with RAG context
    const sourceDescription = source === 'self'
      ? "Kira's own documentation and codebase knowledge"
      : source === 'all'
        ? "both your personal knowledge base and Kira's documentation"
        : "your personal knowledge base";

    let systemPrompt = `You are Kira, an intelligent AI assistant for KeyReply Kira.

Your role is to help users by providing accurate, helpful responses based on ${sourceDescription}.

KNOWLEDGE SOURCE: ${source === 'self' ? 'Kira Self-Documentation' : source === 'all' ? 'All Sources' : 'User Documents'}

INSTRUCTIONS:
- Be professional, concise, and helpful
- Format responses with markdown when appropriate
- If you're unsure about something, say so clearly
${source === 'self' ? '- When answering about Kira features, be specific about implementation details\n- Reference file paths when discussing code structure' : ''}

CURRENT PAGE CONTEXT: ${context || 'General'}`;

    // Add RAG context if available
    if (ragContext) {
      systemPrompt += `

RELEVANT KNOWLEDGE BASE CONTEXT:
The following documents from the knowledge base may be relevant to the user's question:

${ragContext}

Use this context to provide accurate answers. If the context doesn't contain relevant information, you can still answer based on your general knowledge but indicate this to the user.`;
    }

    // Step 3: Create WorkersAI provider and stream response
    const workersai = createWorkersAI({ binding: c.env.AI });

    // Convert messages to the format expected by streamText
    // Supporting both legacy content format and new parts format
    const modelMessages = messages.map(msg => {
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (msg.parts && Array.isArray(msg.parts)) {
        content = msg.parts
          .filter(p => p.type === 'text')
          .map(p => p.text || '')
          .join(' ');
      }
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content
      };
    });

    const result = await streamText({
      model: workersai(DEFAULT_MODEL),
      system: systemPrompt,
      messages: modelMessages,
      onFinish: async ({ text, usage }) => {
        console.log('Chat stream completed:', {
          userId,
          tenantId,
          knowledgeSource: source,
          sourcesCount: sources.length,
          usage
        });
      }
    });

    // Return streaming response compatible with useChat
    // AI SDK v6 uses toUIMessageStreamResponse for useChat
    return result.toUIMessageStreamResponse({
      headers: {
        'X-Knowledge-Source': source,
        'X-Sources-Count': sources.length.toString()
      }
    });

  } catch (error) {
    console.error('Chat stream error:', error);
    return c.json({
      error: 'Failed to generate streaming response',
      details: (error as Error).message
    }, 500);
  }
});

export default chat;
