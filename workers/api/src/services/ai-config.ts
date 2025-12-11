/**
 * AI Configuration - Centralized model configuration for KeyReply Kira AI
 *
 * This file contains all AI model configurations including:
 * - LLM (Large Language Models)
 * - Embedding models
 * - Speech-to-Text (STT) models
 * - Text-to-Speech (TTS) models
 */

// ============================================
// LLM Models (Text Generation)
// ============================================

export const LLM_MODELS = {
  // Gemma Sea Lion (Recommended - Default for SEA region)
  GEMMA_SEA_LION: {
    id: '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
    name: 'Gemma Sea Lion V4 27B',
    provider: 'cloudflare',
    contextWindow: 128000,  // 128K context!
    costPer1MInput: 0.35,
    costPer1MOutput: 0.56,
    description: 'SEA-LION: Southeast Asian Languages In One Network. Best for SEA region with 128K context.',
    recommended: true,
    features: ['streaming', 'sea-languages', '128k-context']
  },

  // Qwen Models
  QWEN3_30B: {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    name: 'Qwen 3 30B',
    provider: 'cloudflare',
    contextWindow: 32768,
    costPer1MInput: 0.051,
    costPer1MOutput: 0.26,
    description: 'High-quality reasoning, best for complex tasks'
  },
  QWEN3_8B: {
    id: '@cf/qwen/qwen3-8b',
    name: 'Qwen 3 8B',
    provider: 'cloudflare',
    contextWindow: 32768,
    costPer1MInput: 0.0,  // Free tier
    costPer1MOutput: 0.0,
    description: 'Good balance of quality and cost'
  },
  QWEN3_1_7B: {
    id: '@cf/qwen/qwen3-1.7b',
    name: 'Qwen 3 1.7B',
    provider: 'cloudflare',
    contextWindow: 32768,
    costPer1MInput: 0.0,
    costPer1MOutput: 0.0,
    description: 'Fast, lightweight, good for simple tasks'
  },

  // Llama Models
  LLAMA_3_1_8B: {
    id: '@cf/meta/llama-3.1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'cloudflare',
    contextWindow: 8192,
    costPer1MInput: 0.0,
    costPer1MOutput: 0.0,
    description: 'Meta Llama, good for general chat (free)'
  },
  // DeepSeek Models
  DEEPSEEK_R1_DISTILL_QWEN_32B: {
    id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    provider: 'cloudflare',
    contextWindow: 32768,
    costPer1MInput: 0.14,
    costPer1MOutput: 0.27,
    description: 'Reasoning model, good for complex analysis'
  },

  // Mistral Models
  MISTRAL_7B: {
    id: '@cf/mistral/mistral-7b-instruct-v0.2',
    name: 'Mistral 7B Instruct',
    provider: 'cloudflare',
    contextWindow: 8192,
    costPer1MInput: 0.0,
    costPer1MOutput: 0.0,
    description: 'Fast European model (free)'
  }
};

// Default LLM for different use cases - Gemma Sea Lion as primary
export const DEFAULT_LLM = {
  primary: LLM_MODELS.GEMMA_SEA_LION,  // Default model for all use cases
  rag: LLM_MODELS.GEMMA_SEA_LION,      // RAG with 128K context
  chat: LLM_MODELS.GEMMA_SEA_LION,     // Chat with SEA language support
  agent: LLM_MODELS.GEMMA_SEA_LION,    // Agents use primary model
  analysis: LLM_MODELS.GEMMA_SEA_LION, // Analysis with long context
  summary: LLM_MODELS.GEMMA_SEA_LION,  // Summaries
  fallback: LLM_MODELS.QWEN3_30B       // Fallback model
};

// ============================================
// Embedding Models
// ============================================

export const EMBEDDING_MODELS = {
  // Qwen3 Embedding (Recommended - new default)
  QWEN3_EMBEDDING: {
    id: '@cf/qwen/qwen3-embedding-0.6b',
    name: 'Qwen3 Embedding 0.6B',
    provider: 'cloudflare',
    dimensions: 1024,  // Qwen3 embedding dimension
    maxTokens: 8192,
    costPer1M: 0.012,
    description: 'Qwen3 embedding model, supports instructions for task-specific embeddings',
    recommended: true,
    features: ['instruction-support', 'query-document-ranking']
  },

  // BGE Models (legacy, still available)
  BGE_BASE_EN: {
    id: '@cf/baai/bge-base-en-v1.5',
    name: 'BGE Base English',
    provider: 'cloudflare',
    dimensions: 768,
    maxTokens: 512,
    costPer1M: 0.0,  // Free
    description: 'Good for English text, free tier'
  },
  BGE_SMALL_EN: {
    id: '@cf/baai/bge-small-en-v1.5',
    name: 'BGE Small English',
    provider: 'cloudflare',
    dimensions: 384,
    maxTokens: 512,
    costPer1M: 0.0,
    description: 'Smaller, faster, slightly lower quality'
  },
  BGE_LARGE_EN: {
    id: '@cf/baai/bge-large-en-v1.5',
    name: 'BGE Large English',
    provider: 'cloudflare',
    dimensions: 1024,
    maxTokens: 512,
    costPer1M: 0.0,
    description: 'Highest quality English embeddings (free)'
  },
  BGE_M3: {
    id: '@cf/baai/bge-m3',
    name: 'BGE M3 Multilingual',
    provider: 'cloudflare',
    dimensions: 1024,
    maxTokens: 8192,
    costPer1M: 0.0,
    description: 'Multilingual, supports 100+ languages'
  }
};

// Default embedding model - Qwen3 for best quality
export const DEFAULT_EMBEDDING = EMBEDDING_MODELS.QWEN3_EMBEDDING;

// ============================================
// Speech-to-Text (STT) Models
// ============================================

export const STT_MODELS = {
  // Deepgram Nova 3 on Cloudflare (Recommended - new default)
  NOVA_3: {
    id: '@cf/deepgram/nova-3',
    name: 'Deepgram Nova 3',
    provider: 'cloudflare',
    type: 'workers-ai',
    languages: 'all',  // BCP-47 language tags supported
    maxDuration: null,  // No hard limit for batch
    costPerMinute: {
      http: 0.0052,      // $0.0052/min for HTTP batch
      websocket: 0.0092  // $0.0092/min for WebSocket streaming
    },
    description: 'Industry-leading Deepgram Nova 3 on Cloudflare Workers AI',
    recommended: true,
    features: [
      'transcription',
      'streaming',
      'diarization',
      'punctuation',
      'smart-formatting',
      'language-detection',
      'entity-extraction',
      'sentiment-analysis',
      'topic-detection',
      'intent-detection',
      'profanity-filtering',
      'text-redaction',
      'filler-words',
      'numerals-conversion'
    ]
  },

  // Cloudflare Whisper (Free tier fallback)
  WHISPER: {
    id: '@cf/openai/whisper',
    name: 'Whisper',
    provider: 'cloudflare',
    type: 'workers-ai',
    languages: ['en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr', 'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi', 'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no', 'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk', 'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk', 'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw', 'gl', 'mr', 'pa', 'si', 'km', 'sn', 'yo', 'so', 'af', 'oc', 'ka', 'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'ht', 'ps', 'tk', 'nn', 'mt', 'sa', 'lb', 'my', 'bo', 'tl', 'mg', 'as', 'tt', 'haw', 'ln', 'ha', 'ba', 'jw', 'su'],
    maxDuration: 30,  // seconds per request
    costPerMinute: 0.0,  // Free tier
    description: 'OpenAI Whisper on Cloudflare (free), 30s max per request',
    features: ['transcription', 'language-detection']
  },
  WHISPER_LARGE: {
    id: '@cf/openai/whisper-large-v3-turbo',
    name: 'Whisper Large V3 Turbo',
    provider: 'cloudflare',
    type: 'workers-ai',
    languages: 'all',  // 100+ languages
    maxDuration: 30,
    costPerMinute: 0.0,
    description: 'Larger Whisper model on Cloudflare (free), better accuracy',
    features: ['transcription', 'language-detection', 'timestamps']
  }
};

// Default STT models - Nova 3 is now the primary choice
export const DEFAULT_STT = {
  primary: STT_MODELS.NOVA_3,              // Best quality, Deepgram Nova 3
  realtime: STT_MODELS.NOVA_3,             // Best for real-time/streaming
  batch: STT_MODELS.NOVA_3,                // Best for batch processing
  free: STT_MODELS.WHISPER                 // Free tier fallback
};

// ============================================
// Text-to-Speech (TTS) Models
// ============================================

export const TTS_MODELS = {
  // Cloudflare TTS (coming soon)
  // Currently not available on Workers AI

  // Deepgram Aura (via API)
  DEEPGRAM_AURA: {
    id: 'aura-asteria-en',
    name: 'Deepgram Aura (Asteria)',
    provider: 'deepgram',
    type: 'api',
    apiEndpoint: 'https://api.deepgram.com/v1/speak',
    voices: ['asteria', 'luna', 'stella', 'athena', 'hera', 'orion', 'arcas', 'perseus', 'angus', 'orpheus', 'helios', 'zeus'],
    languages: ['en'],
    costPer1KChars: 0.0015,
    description: 'Natural-sounding voices, low latency',
    features: ['streaming', 'multiple-voices', 'ssml']
  }
};

// ============================================
// Helper Functions
// ============================================

/**
 * Get LLM model by use case
 */
export function getLLMModel(useCase = 'chat') {
  return DEFAULT_LLM[useCase] || DEFAULT_LLM.chat;
}

/**
 * Get embedding model
 */
export function getEmbeddingModel(multilingual = false) {
  return multilingual ? EMBEDDING_MODELS.BGE_M3 : DEFAULT_EMBEDDING;
}

/**
 * Get STT model by use case
 */
export function getSTTModel(useCase = 'batch') {
  return DEFAULT_STT[useCase] || DEFAULT_STT.batch;
}

/**
 * Run LLM inference
 */
export async function runLLM(env, messages, options = {}) {
  const model = options.model || getLLMModel(options.useCase);

  return await env.AI.run(model.id, {
    messages,
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature || 0.7,
    ...options.extra
  });
}

/**
 * Generate embeddings
 */
export async function generateEmbeddings(env, text, options = {}) {
  const model = options.model || getEmbeddingModel(options.multilingual);
  const texts = Array.isArray(text) ? text : [text];

  const result = await env.AI.run(model.id, { text: texts });
  return result.data;
}

/**
 * Transcribe audio using Deepgram Nova 3 on Cloudflare Workers AI (recommended)
 */
export async function transcribeWithNova3(env, audioData, options = {}) {
  const model = STT_MODELS.NOVA_3;

  // Nova 3 on Cloudflare Workers AI
  const result = await env.AI.run(model.id, {
    audio: audioData,
    detect_language: options.detectLanguage !== false,
    ...(options.language && { language: options.language }),
    ...options.extra
  });

  return {
    text: result.text || result.transcript || '',
    confidence: result.confidence,
    words: result.words,
    language: result.detected_language,
    provider: 'cloudflare',
    model: model.id,
    features: model.features
  };
}

/**
 * Transcribe audio using Cloudflare Whisper (free tier)
 */
export async function transcribeWithWhisper(env, audioData, options = {}) {
  const model = options.model || STT_MODELS.WHISPER;

  const result = await env.AI.run(model.id, {
    audio: audioData,
    ...options.extra
  });

  return {
    text: result.text,
    provider: 'cloudflare',
    model: model.id
  };
}

/**
 * Transcribe audio - auto-selects model based on configuration
 * Default: Nova 3 on Cloudflare Workers AI
 */
export async function transcribeAudio(env, audioData, options = {}) {
  const useFreeTier = options.freeTier || env.STT_FREE_TIER === 'true';

  // Use free Whisper if explicitly requested
  if (useFreeTier) {
    return transcribeWithWhisper(env, audioData, options);
  }

  // Default: Use Nova 3 on Cloudflare
  return transcribeWithNova3(env, audioData, options);
}

/**
 * Get all available models
 */
export function getAllModels() {
  return {
    llm: LLM_MODELS,
    embedding: EMBEDDING_MODELS,
    stt: STT_MODELS,
    tts: TTS_MODELS,
    defaults: {
      llm: DEFAULT_LLM,
      embedding: DEFAULT_EMBEDDING,
      stt: DEFAULT_STT
    }
  };
}
