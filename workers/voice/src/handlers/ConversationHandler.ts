/**
 * Conversation Handler
 *
 * Manages conversation flow, context, and turn-taking for the voice agent.
 */

import type {
  Env,
  SessionState,
  ConversationStage,
  LeadInfo,
  ToolCall,
  LLMResponse,
} from '../utils/types';
import { LLMService, LEAD_CAPTURE_TOOLS } from '../services/LLMService';
import { SpeechService } from '../services/SpeechService';
import { STAGE_TRANSITIONS, calculateQualificationScore } from '../utils/config';
import { REAL_ESTATE_PROMPT } from '../prompts/loader';

export class ConversationHandler {
  private llmService: LLMService;
  private speechService: SpeechService;
  private sessionState: SessionState;
  private onSpeakCallback?: (audio: ArrayBuffer) => void;

  constructor(env: Env, sessionState: SessionState) {
    this.sessionState = sessionState;
    this.llmService = new LLMService(env, this.buildContextualPrompt());
    this.speechService = new SpeechService(env);
  }

  /**
   * Set callback for when agent needs to speak
   */
  setOnSpeak(callback: (audio: ArrayBuffer) => void): void {
    this.onSpeakCallback = callback;
  }

  /**
   * Handle incoming transcription from user
   */
  async handleUserInput(transcript: string): Promise<void> {
    if (!transcript.trim()) return;

    // Add user message to history
    this.addMessage('user', transcript);

    // Generate LLM response
    const response = await this.generateResponse();

    // Handle tool calls if any
    if (response.toolCalls) {
      await this.handleToolCalls(response.toolCalls);
    }

    // Speak the response
    if (response.content && this.onSpeakCallback) {
      const ttsResponse = await this.speechService.synthesizeSpeech({
        text: response.content,
      });
      this.onSpeakCallback(ttsResponse.audio);
    }

    // Add assistant message to history
    if (response.content) {
      this.addMessage('assistant', response.content);
    }

    // Update conversation stage
    this.updateStage();
  }

  /**
   * Generate initial greeting
   */
  async generateGreeting(): Promise<string> {
    const isReturning = this.sessionState.callCount > 1;

    let greeting: string;
    if (isReturning && this.sessionState.leadInfo.name) {
      greeting = `Hello ${this.sessionState.leadInfo.name}! Great to hear from you again. Last time we were discussing your interest in properties. How can I help you today?`;
    } else {
      greeting = `Hello! Thank you for taking my call. My name is Alex, and I'm reaching out from KeyReply Properties. We specialize in helping people find their perfect home. Do you have a moment to chat about your real estate needs?`;
    }

    this.addMessage('assistant', greeting);
    this.sessionState.currentStage = 'introduction';

    return greeting;
  }

  /**
   * Generate response from LLM
   */
  private async generateResponse(): Promise<LLMResponse> {
    // Update prompt with current context
    this.llmService.updateSystemPrompt(this.buildContextualPrompt());

    return this.llmService.generateResponse(
      this.sessionState.conversationHistory,
      LEAD_CAPTURE_TOOLS
    );
  }

  /**
   * Handle tool calls from LLM
   */
  private async handleToolCalls(toolCalls: ToolCall[]): Promise<void> {
    for (const call of toolCalls) {
      switch (call.name) {
        case 'capture_lead_info':
          this.updateLeadInfo(call.arguments as Partial<LeadInfo>);
          break;

        case 'schedule_callback':
          await this.handleScheduleCallback(call.arguments as {
            preferred_date?: string;
            preferred_time?: string;
            reason: string;
          });
          break;

        case 'end_conversation':
          this.handleEndConversation(call.arguments as {
            reason: string;
            notes?: string;
          });
          break;
      }
    }
  }

  /**
   * Update lead information
   */
  private updateLeadInfo(updates: Partial<LeadInfo> & Record<string, unknown>): void {
    const lead = this.sessionState.leadInfo;

    if (updates.name) lead.name = updates.name as string;
    if (updates.email) lead.email = updates.email as string;
    if (updates.phone) lead.phoneNumber = updates.phone as string;

    if (updates.property_type) {
      lead.propertyPreferences.type = updates.property_type as LeadInfo['propertyPreferences']['type'];
    }
    if (updates.bedrooms) {
      lead.propertyPreferences.bedrooms = updates.bedrooms as number;
    }
    if (updates.bathrooms) {
      lead.propertyPreferences.bathrooms = updates.bathrooms as number;
    }
    if (updates.locations) {
      lead.propertyPreferences.locations = updates.locations as string[];
    }

    if (updates.budget_min || updates.budget_max) {
      lead.budget = lead.budget || { currency: 'USD' };
      if (updates.budget_min) lead.budget.min = updates.budget_min as number;
      if (updates.budget_max) lead.budget.max = updates.budget_max as number;
    }

    if (updates.timeline) lead.timeline = updates.timeline as string;
    if (updates.notes) {
      if (Array.isArray(updates.notes)) {
        lead.notes.push(...(updates.notes as string[]));
      } else {
        lead.notes.push(updates.notes as string);
      }
    }

    // Recalculate qualification score
    lead.qualificationScore = calculateQualificationScore(lead);
    lead.updatedAt = new Date().toISOString();
  }

  /**
   * Handle callback scheduling
   */
  private async handleScheduleCallback(params: {
    preferred_date?: string;
    preferred_time?: string;
    reason: string;
  }): Promise<void> {
    this.sessionState.leadInfo.notes.push(
      `Callback requested: ${params.reason} - ${params.preferred_date || 'TBD'} ${params.preferred_time || ''}`
    );
    this.sessionState.currentStage = 'closing';
  }

  /**
   * Handle conversation end
   */
  private handleEndConversation(params: {
    reason: string;
    notes?: string;
  }): void {
    if (params.notes) {
      this.sessionState.leadInfo.notes.push(params.notes);
    }
    this.sessionState.leadInfo.notes.push(`Conversation ended: ${params.reason}`);
    this.sessionState.isActive = false;
  }

  /**
   * Update conversation stage based on context
   */
  private updateStage(): void {
    const currentStage = this.sessionState.currentStage;
    const lead = this.sessionState.leadInfo;
    const possibleNextStages = STAGE_TRANSITIONS[currentStage] || [];

    // Determine next stage based on lead qualification
    if (currentStage === 'needs_discovery' && lead.propertyPreferences.type) {
      this.sessionState.currentStage = 'qualification';
    } else if (currentStage === 'qualification' && lead.qualificationScore >= 50) {
      this.sessionState.currentStage = 'property_discussion';
    } else if (currentStage === 'property_discussion' && lead.qualificationScore >= 70) {
      this.sessionState.currentStage = 'next_steps';
    } else if (possibleNextStages.length === 1) {
      this.sessionState.currentStage = possibleNextStages[0] as ConversationStage;
    }
  }

  /**
   * Build contextual system prompt
   */
  private buildContextualPrompt(): string {
    const lead = this.sessionState.leadInfo;
    const stage = this.sessionState.currentStage;

    let context = REAL_ESTATE_PROMPT;

    // Add lead context
    context += `\n\n## Current Lead Context\n`;
    context += `- Call #${this.sessionState.callCount}\n`;
    context += `- Conversation Stage: ${stage}\n`;
    context += `- Qualification Score: ${lead.qualificationScore}/100\n`;

    if (lead.name) context += `- Name: ${lead.name}\n`;
    if (lead.propertyPreferences.type) context += `- Property Type: ${lead.propertyPreferences.type}\n`;
    if (lead.propertyPreferences.locations?.length) {
      context += `- Interested Locations: ${lead.propertyPreferences.locations.join(', ')}\n`;
    }
    if (lead.budget) {
      context += `- Budget: $${lead.budget.min || '?'} - $${lead.budget.max || '?'}\n`;
    }
    if (lead.timeline) context += `- Timeline: ${lead.timeline}\n`;

    // Add stage-specific instructions
    context += `\n## Stage Instructions\n`;
    switch (stage) {
      case 'greeting':
      case 'introduction':
        context += `Focus on building rapport and confirming interest in real estate discussion.\n`;
        break;
      case 'needs_discovery':
        context += `Ask open-ended questions about their ideal property and living situation.\n`;
        break;
      case 'qualification':
        context += `Gather specific details: budget, timeline, must-haves, deal-breakers.\n`;
        break;
      case 'property_discussion':
        context += `Discuss specific property types/areas that match their criteria.\n`;
        break;
      case 'next_steps':
        context += `Propose concrete next steps: property viewings, agent callback, listings email.\n`;
        break;
      case 'closing':
        context += `Summarize the conversation and confirm any scheduled follow-ups.\n`;
        break;
    }

    return context;
  }

  /**
   * Add message to conversation history
   */
  private addMessage(role: 'user' | 'assistant' | 'system', content: string): void {
    this.sessionState.conversationHistory.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState {
    return this.sessionState;
  }
}
