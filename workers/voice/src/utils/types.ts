/**
 * Type definitions for Voice Agent
 */

export interface Env {
  AI: Ai;
  VOICE_SESSION: DurableObjectNamespace;
  SESSION_REGISTRY: DurableObjectNamespace;
  MINIMAX_API_KEY?: string;
  MINIMAX_GROUP_ID?: string;
  DEEPGRAM_API_KEY?: string;
  ENVIRONMENT: string;
  ASSETS: Fetcher;
}

export interface LeadInfo {
  id: string;
  phoneNumber?: string;
  name?: string;
  email?: string;
  propertyPreferences: PropertyPreferences;
  budget?: BudgetRange;
  timeline?: string;
  notes: string[];
  qualificationScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyPreferences {
  type?: 'house' | 'condo' | 'apartment' | 'townhouse' | 'land' | 'commercial';
  bedrooms?: number;
  bathrooms?: number;
  minSize?: number;
  maxSize?: number;
  locations?: string[];
  features?: string[];
  mustHaves?: string[];
  dealBreakers?: string[];
}

export interface BudgetRange {
  min?: number;
  max?: number;
  currency: string;
  financing?: 'cash' | 'mortgage' | 'undecided';
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface SessionState {
  sessionId: string;
  leadInfo: LeadInfo;
  conversationHistory: ConversationMessage[];
  currentStage: ConversationStage;
  callCount: number;
  lastCallAt?: string;
  isActive: boolean;
}

export type ConversationStage =
  | 'greeting'
  | 'introduction'
  | 'needs_discovery'
  | 'qualification'
  | 'property_discussion'
  | 'next_steps'
  | 'closing'
  | 'follow_up';

export interface SpeechConfig {
  sttModel: string;
  ttsModel: string;
  ttsVoice: string;
  sampleRate: number;
  encoding: string;
  ttsBufferMs?: number;
}

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface AgentConfig {
  speech: SpeechConfig;
  llm: LLMConfig;
  maxConversationTurns: number;
  silenceTimeoutMs: number;
  interruptionThreshold: number;
}

export interface TranscriptionResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: string;
}

export interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  pitch?: number;
}

export interface TTSResponse {
  audio: ArrayBuffer;
  duration: number;
}

export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
