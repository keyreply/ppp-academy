/**
 * Configuration for Voice Agent
 */


import type { AgentConfig, SpeechConfig, LLMConfig } from './types';

declare const process: {
  env: Record<string, string | undefined>;
};

export const DEFAULT_SPEECH_CONFIG: SpeechConfig = {
  sttModel: process.env.STT_MODEL || '@cf/deepgram/flux',
  ttsModel: process.env.TTS_MODEL || 'minimax',
  ttsVoice: process.env.MINIMAX_VOICE_ID || 'moss_audio_148aacec-d25f-11f0-96d2-927ba0120a3d', // Minimax Singapore voice
  sampleRate: 16000,
  encoding: 'linear16',
  ttsBufferMs: 500,
};

export const DEFAULT_LLM_CONFIG: LLMConfig = {
  model: process.env.LLM_MODEL || '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
  temperature: 0.7,
  maxTokens: 500,
  systemPrompt: '', // Loaded from prompt file
};

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  speech: DEFAULT_SPEECH_CONFIG,
  llm: DEFAULT_LLM_CONFIG,
  maxConversationTurns: 50,
  silenceTimeoutMs: 2000,
  interruptionThreshold: 0.8,
};

// Workers AI LLM configuration
export const WORKERS_AI_LLM_CONFIG = {
  // primaryModel: process.env.LLM_MODEL || '@cf/aisingapore/gemma-sea-lion-v4-27b-it',
  // fallbackModel: process.env.LLM_FALLBACK_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8',

  primaryModel: process.env.LLM_MODEL || '@cf/meta/llama-3.1-8b-instruct',
  fallbackModel: process.env.LLM_FALLBACK_MODEL || '@cf/meta/llama-3-8b-instruct',
};

// Minimax API configuration for TTS
export const MINIMAX_CONFIG = {
  baseUrl: process.env.MINIMAX_API_URL || 'https://api.minimax.io/v1',
  ttsEndpoint: '/t2a_v2',
  groupId: process.env.MINIMAX_GROUP_ID || '',
  model: process.env.MINIMAX_MODEL || 'speech-2.6-turbo',
  voiceId: process.env.MINIMAX_VOICE_ID || 'moss_audio_148aacec-d25f-11f0-96d2-927ba0120a3d',
};

// Deepgram configuration for Workers AI
export const DEEPGRAM_CONFIG = {
  fluxModel: '@cf/deepgram/flux', // WebSocket-only, real-time STT
  aura2Model: '@cf/deepgram/aura-2-en', // Latest TTS with streaming
  auraModel: '@cf/deepgram/aura-1', // Legacy TTS
  nova3Model: '@cf/deepgram/nova-3', // Batch STT
};

// Conversation stage transitions
export const STAGE_TRANSITIONS: Record<string, string[]> = {
  greeting: ['introduction'],
  introduction: ['needs_discovery'],
  needs_discovery: ['qualification', 'property_discussion'],
  qualification: ['property_discussion', 'next_steps'],
  property_discussion: ['next_steps', 'closing'],
  next_steps: ['closing', 'follow_up'],
  closing: ['follow_up'],
  follow_up: ['greeting', 'needs_discovery'],
};

// Lead qualification scoring weights
export const QUALIFICATION_WEIGHTS = {
  hasName: 10,
  hasEmail: 15,
  hasPhone: 10,
  hasBudget: 20,
  hasTimeline: 15,
  hasPropertyType: 10,
  hasLocation: 10,
  hasPreferences: 10,
};

export function calculateQualificationScore(leadInfo: {
  name?: string;
  email?: string;
  phoneNumber?: string;
  budget?: { min?: number; max?: number };
  timeline?: string;
  propertyPreferences: {
    type?: string;
    locations?: string[];
    features?: string[];
  };
}): number {
  let score = 0;

  if (leadInfo.name) score += QUALIFICATION_WEIGHTS.hasName;
  if (leadInfo.email) score += QUALIFICATION_WEIGHTS.hasEmail;
  if (leadInfo.phoneNumber) score += QUALIFICATION_WEIGHTS.hasPhone;
  if (leadInfo.budget?.min || leadInfo.budget?.max) score += QUALIFICATION_WEIGHTS.hasBudget;
  if (leadInfo.timeline) score += QUALIFICATION_WEIGHTS.hasTimeline;
  if (leadInfo.propertyPreferences.type) score += QUALIFICATION_WEIGHTS.hasPropertyType;
  if (leadInfo.propertyPreferences.locations?.length) score += QUALIFICATION_WEIGHTS.hasLocation;
  if (leadInfo.propertyPreferences.features?.length) score += QUALIFICATION_WEIGHTS.hasPreferences;

  return score;
}
