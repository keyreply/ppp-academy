/**
 * LLM Service - Cloudflare Workers AI Integration
 *
 * Uses SEA-LION (primary) with Qwen3 fallback for real-time responses.
 * Supports both streaming and non-streaming modes.
 */

import type { Env, LLMResponse, ConversationMessage, ToolCall, ToolDefinition } from '../utils/types';
import { WORKERS_AI_LLM_CONFIG, DEFAULT_LLM_CONFIG } from '../utils/config';
import { SmartTextChunker } from '../utils/SmartTextChunker';

export interface StreamingCallbacks {
  onToken: (token: string) => void;
  onSentence?: (sentence: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: (fullResponse: string) => void;
}

interface WorkersAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface WorkersAIResponse {
  response?: string;
  tool_calls?: Array<{
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

export class LLMService {
  private env: Env;
  private systemPrompt: string;

  constructor(env: Env, systemPrompt: string) {
    this.env = env;
    this.systemPrompt = systemPrompt;
  }

  /**
   * Generate a response from the LLM (non-streaming)
   */
  async generateResponse(
    messages: ConversationMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages);

    try {
      // Try primary model first
      return await this.runModel(
        WORKERS_AI_LLM_CONFIG.primaryModel,
        formattedMessages,
        tools
      );
    } catch (error) {
      console.warn('Primary model failed, trying fallback:', error);
      // Fallback to Qwen3
      return await this.runModel(
        WORKERS_AI_LLM_CONFIG.fallbackModel,
        formattedMessages,
        tools
      );
    }
  }

  /**
   * Run a specific Workers AI model
   */
  private async runModel(
    model: string,
    messages: WorkersAIMessage[],
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const input: Record<string, unknown> = {
      messages: [{ role: 'system', content: this.systemPrompt }, ...messages],
      temperature: DEFAULT_LLM_CONFIG.temperature,
      max_tokens: DEFAULT_LLM_CONFIG.maxTokens,
    };

    // Add tools if provided (for models that support function calling)
    if (tools && tools.length > 0) {
      input.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    const result = (await this.env.AI.run(
      model as Parameters<Ai['run']>[0],
      input
    )) as WorkersAIResponse;

    // Parse tool calls if present
    let toolCalls: ToolCall[] | undefined;
    if (result.tool_calls && result.tool_calls.length > 0) {
      toolCalls = result.tool_calls.map((tc, idx) => ({
        id: `call_${idx}`,
        name: tc.name,
        arguments: tc.arguments,
      }));
    }

    return {
      content: result.response || '',
      toolCalls,
      finishReason: toolCalls ? 'tool_calls' : 'stop',
    };
  }

  /**
   * Generate streaming response with sentence-level callbacks
   * This enables TTS to start as soon as a complete sentence is available
   */
  async generateStreamingWithCallbacks(
    messages: ConversationMessage[],
    callbacks: StreamingCallbacks,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const formattedMessages = this.formatMessages(messages);

    try {
      return await this.runStreamingModel(
        WORKERS_AI_LLM_CONFIG.primaryModel,
        formattedMessages,
        callbacks,
        tools
      );
    } catch (error) {
      console.warn('Primary streaming model failed, trying fallback:', error);
      return await this.runStreamingModel(
        WORKERS_AI_LLM_CONFIG.fallbackModel,
        formattedMessages,
        callbacks,
        tools
      );
    }
  }

  /**
   * Run streaming model with callbacks
   */
  private async runStreamingModel(
    model: string,
    messages: WorkersAIMessage[],
    callbacks: StreamingCallbacks,
    tools?: ToolDefinition[]
  ): Promise<LLMResponse> {
    const input: Record<string, unknown> = {
      messages: [{ role: 'system', content: this.systemPrompt }, ...messages],
      temperature: DEFAULT_LLM_CONFIG.temperature,
      max_tokens: DEFAULT_LLM_CONFIG.maxTokens,
      stream: true,
    };

    if (tools && tools.length > 0) {
      input.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    const stream = (await this.env.AI.run(
      model as Parameters<Ai['run']>[0],
      input
    )) as ReadableStream;

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    let fullContent = '';
    const toolCalls: ToolCall[] = [];

    // Use SmartTextChunker for intelligent splitting
    const chunker = new SmartTextChunker(12); // Split clauses if > 12 words

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Parse SSE data
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as { response?: string };
              const token = parsed.response;

              if (token) {
                fullContent += token;

                // Emit token immediately
                callbacks.onToken(token);

                // Check for chunk boundary
                if (callbacks.onSentence) {
                  const chunk = chunker.addToken(token);
                  if (chunk) {
                    callbacks.onSentence(chunk);
                  }
                }
              }
            } catch {
              // Handle non-JSON chunks (raw text from some models)
              if (data && data !== '[DONE]') {
                fullContent += data;
                callbacks.onToken(data);

                if (callbacks.onSentence) {
                  const chunk = chunker.addToken(data);
                  if (chunk) {
                    callbacks.onSentence(chunk);
                  }
                }
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Emit any remaining text
    if (callbacks.onSentence) {
      const remaining = chunker.flush();
      if (remaining) {
        callbacks.onSentence(remaining);
      }
    }

    // Emit completion callback
    if (callbacks.onComplete) {
      callbacks.onComplete(fullContent);
    }

    return {
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
    };
  }

  /**
   * Generate streaming response (async generator for simple use cases)
   */
  async *generateStreamingResponse(messages: ConversationMessage[]): AsyncGenerator<string> {
    const formattedMessages = this.formatMessages(messages);

    const input = {
      messages: [{ role: 'system', content: this.systemPrompt }, ...formattedMessages],
      temperature: DEFAULT_LLM_CONFIG.temperature,
      max_tokens: DEFAULT_LLM_CONFIG.maxTokens,
      stream: true,
    };

    let stream: ReadableStream;
    try {
      stream = (await this.env.AI.run(
        WORKERS_AI_LLM_CONFIG.primaryModel as Parameters<Ai['run']>[0],
        input
      )) as ReadableStream;
    } catch {
      stream = (await this.env.AI.run(
        WORKERS_AI_LLM_CONFIG.fallbackModel as Parameters<Ai['run']>[0],
        input
      )) as ReadableStream;
    }

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data) as { response?: string };
              if (parsed.response) {
                yield parsed.response;
              }
            } catch {
              if (data && data !== '[DONE]') {
                yield data;
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  private formatMessages(messages: ConversationMessage[]): WorkersAIMessage[] {
    return messages.map(msg => ({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content,
    }));
  }

  /**
   * Update system prompt (e.g., with lead context)
   */
  updateSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }
}

/**
 * Tool definitions for lead capture
 */
export const LEAD_CAPTURE_TOOLS: ToolDefinition[] = [
  {
    name: 'capture_lead_info',
    description: 'Capture or update lead information from the conversation',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Full name of the lead' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        property_type: {
          type: 'string',
          enum: ['house', 'condo', 'apartment', 'townhouse', 'land', 'commercial'],
          description: 'Type of property interested in',
        },
        bedrooms: { type: 'number', description: 'Number of bedrooms desired' },
        bathrooms: { type: 'number', description: 'Number of bathrooms desired' },
        budget_min: { type: 'number', description: 'Minimum budget' },
        budget_max: { type: 'number', description: 'Maximum budget' },
        locations: {
          type: 'array',
          items: { type: 'string' },
          description: 'Preferred locations/neighborhoods',
        },
        timeline: { type: 'string', description: 'Timeline for purchase' },
        notes: { type: 'string', description: 'Additional notes or preferences' },
      },
    },
  },
  {
    name: 'schedule_callback',
    description: 'Schedule a callback with a human agent',
    parameters: {
      type: 'object',
      properties: {
        preferred_date: { type: 'string', description: 'Preferred date for callback' },
        preferred_time: { type: 'string', description: 'Preferred time for callback' },
        reason: { type: 'string', description: 'Reason for callback' },
      },
      required: ['reason'],
    },
  },
  {
    name: 'end_conversation',
    description: 'End the conversation with appropriate closing',
    parameters: {
      type: 'object',
      properties: {
        reason: {
          type: 'string',
          enum: ['qualified_lead', 'not_interested', 'callback_scheduled', 'wrong_number', 'other'],
          description: 'Reason for ending conversation',
        },
        notes: { type: 'string', description: 'Final notes' },
      },
      required: ['reason'],
    },
  },
];
