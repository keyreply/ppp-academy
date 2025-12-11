/**
 * Realtime Voice Handler
 *
 * Orchestrates the full voice pipeline with streaming:
 * User Audio → Flux STT → Streaming LLM → Streaming TTS → Audio Output
 *
 * Optimized for low latency by:
 * 1. Using WebSocket for real-time STT
 * 2. Streaming LLM with sentence-level chunking
 * 3. Starting TTS as soon as first sentence is ready
 */

import type { Env, SessionState, ToolCall } from '../utils/types';
import { SpeechService } from '../services/SpeechService';
import { LLMService, LEAD_CAPTURE_TOOLS, StreamingCallbacks } from '../services/LLMService';
import { STAGE_TRANSITIONS, calculateQualificationScore } from '../utils/config';
import { REAL_ESTATE_PROMPT } from '../prompts/loader';
import type { StreamingStateManager } from '../utils/StreamingStateManager';
import type { BargeInDetector } from '../utils/BargeInDetector';

export interface VoiceHandlerCallbacks {
  onTranscript: (text: string, isFinal: boolean) => void;
  onAgentText: (text: string, isFinal: boolean) => void;
  onAudio: (audio: ArrayBuffer) => void;
  onStateUpdate: (state: Partial<SessionState>) => void;
  onError: (error: Error) => void;
}

export class RealtimeVoiceHandler {
  private sessionState: SessionState;
  private llmService: LLMService;
  private speechService: SpeechService;
  private callbacks: VoiceHandlerCallbacks;
  private isProcessing: boolean = false;
  private pendingTranscripts: string[] = [];
  private ttsQueue: Promise<void> = Promise.resolve();
  private streamingStateManager?: StreamingStateManager;
  private bargeInDetector?: BargeInDetector;

  constructor(
    env: Env,
    sessionState: SessionState,
    callbacks: VoiceHandlerCallbacks,
    streamingStateManager?: StreamingStateManager,
    bargeInDetector?: BargeInDetector
  ) {
    this.sessionState = sessionState;
    this.callbacks = callbacks;
    this.llmService = new LLMService(env, this.buildContextualPrompt());
    this.speechService = new SpeechService(env);
    this.streamingStateManager = streamingStateManager;
    this.bargeInDetector = bargeInDetector;
  }

  /**
   * Handle final transcript from STT
   */
  async handleTranscript(text: string, isFinal: boolean): Promise<void> {
    // Emit transcript to UI
    this.callbacks.onTranscript(text, isFinal);

    // Only process final transcripts
    if (!isFinal || !text.trim()) {
      return;
    }

    // Queue transcripts if we're currently processing
    if (this.isProcessing) {
      this.pendingTranscripts.push(text);
      return;
    }

    await this.processUserInput(text);
  }

  /**
   * Process user input through LLM with streaming response
   */
  private async processUserInput(text: string): Promise<void> {
    this.isProcessing = true;

    try {
      // Add user message to history
      this.addMessage('user', text);

      // Update LLM context with current state
      this.llmService.updateSystemPrompt(this.buildContextualPrompt());

      // Streaming callbacks for sentence-level TTS
      let fullResponse = '';
      const streamCallbacks: StreamingCallbacks = {
        onToken: token => {
          // Emit each token to UI for real-time display
          this.callbacks.onAgentText(token, false);
        },
        onSentence: sentence => {
          // Queue TTS for each sentence as it completes
          this.queueTTS(sentence);
        },
        onToolCall: toolCall => {
          this.handleToolCall(toolCall);
        },
        onComplete: content => {
          fullResponse = content;
          this.callbacks.onAgentText('', true); // Signal completion
        },
      };

      // Generate streaming response
      await this.llmService.generateStreamingWithCallbacks(
        this.sessionState.conversationHistory,
        streamCallbacks,
        LEAD_CAPTURE_TOOLS
      );

      // Add assistant message to history
      if (fullResponse) {
        this.addMessage('assistant', fullResponse);
      }

      // Update conversation stage
      this.updateStage();

      // Emit state update
      this.callbacks.onStateUpdate({
        currentStage: this.sessionState.currentStage,
        leadInfo: this.sessionState.leadInfo,
      });
    } catch (error) {
      console.error('Error processing user input:', error);
      this.callbacks.onError(error as Error);
    } finally {
      this.isProcessing = false;

      // Process any queued transcripts
      if (this.pendingTranscripts.length > 0) {
        const next = this.pendingTranscripts.shift()!;
        await this.processUserInput(next);
      }
    }
  }

  /**
   * Queue TTS synthesis and playback
   * Ensures sentences are spoken in order
   */
  private queueTTS(text: string): void {
    this.ttsQueue = this.ttsQueue.then(async () => {
      try {
        // Notify barge-in detector that agent started speaking
        this.bargeInDetector?.agentStartedSpeaking();

        // Start stream tracking if manager is available
        if (this.streamingStateManager) {
          this.streamingStateManager.startStream(this.sessionState.sessionId);
        }

        const { wasInterrupted } = await this.speechService.streamSpeech(
          { text },
          (chunk) => {
            // Track bytes sent
            if (this.streamingStateManager) {
              this.streamingStateManager.updateBytesStreamed(
                this.sessionState.sessionId,
                chunk.byteLength
              );
            }
            this.callbacks.onAudio(chunk);
          },
          {
            shouldStop: this.streamingStateManager
              ? this.streamingStateManager.createStopChecker(this.sessionState.sessionId)
              : undefined,
            targetBufferMs: 250,
          }
        );

        // End stream tracking
        if (this.streamingStateManager) {
          this.streamingStateManager.endStream(this.sessionState.sessionId);
        }

        // Notify barge-in detector that agent stopped speaking
        this.bargeInDetector?.agentStoppedSpeaking();

        if (wasInterrupted) {
          console.log('[RealtimeVoiceHandler] TTS was interrupted by user');
        }
      } catch (error) {
        console.error('TTS error:', error);
        // Make sure to clean up state on error
        this.bargeInDetector?.agentStoppedSpeaking();
        if (this.streamingStateManager) {
          this.streamingStateManager.endStream(this.sessionState.sessionId);
        }
      }
    });
  }

  /**
   * Generate and speak initial greeting
   */
  async generateGreeting(): Promise<string> {
    const isReturning = this.sessionState.callCount > 1;
    const name = this.sessionState.leadInfo.name;

    let greeting: string;
    if (isReturning && name) {
      greeting = `Hello ${name}! Great to hear from you again. Last time we were discussing your interest in properties. How can I help you today?`;
    } else {
      greeting = `Hello! Thank you for taking my call. My name is Alex, and I'm reaching out from KeyReply Properties. We specialize in helping people find their perfect home. Do you have a moment to chat about your real estate needs?`;
    }

    // Add to history
    this.addMessage('assistant', greeting);
    this.sessionState.currentStage = 'introduction';

    // Speak greeting
    this.callbacks.onAgentText(greeting, true);
    this.queueTTS(greeting);

    return greeting;
  }

  /**
   * Handle tool calls from LLM
   */
  private handleToolCall(toolCall: ToolCall): void {
    switch (toolCall.name) {
      case 'capture_lead_info':
        this.updateLeadInfo(toolCall.arguments as Record<string, unknown>);
        break;

      case 'schedule_callback':
        this.handleScheduleCallback(
          toolCall.arguments as {
            preferred_date?: string;
            preferred_time?: string;
            reason: string;
          }
        );
        break;

      case 'end_conversation':
        this.handleEndConversation(
          toolCall.arguments as {
            reason: string;
            notes?: string;
          }
        );
        break;
    }
  }

  /**
   * Update lead information from tool call
   */
  private updateLeadInfo(updates: Record<string, unknown>): void {
    const lead = this.sessionState.leadInfo;

    if (updates.name) lead.name = updates.name as string;
    if (updates.email) lead.email = updates.email as string;
    if (updates.phone) lead.phoneNumber = updates.phone as string;

    if (updates.property_type) {
      lead.propertyPreferences.type = updates.property_type as typeof lead.propertyPreferences.type;
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
    if (updates.notes) lead.notes.push(updates.notes as string);

    // Recalculate qualification score
    lead.qualificationScore = calculateQualificationScore(lead);
    lead.updatedAt = new Date().toISOString();
  }

  /**
   * Handle callback scheduling
   */
  private handleScheduleCallback(params: {
    preferred_date?: string;
    preferred_time?: string;
    reason: string;
  }): void {
    this.sessionState.leadInfo.notes.push(
      `Callback requested: ${params.reason} - ${params.preferred_date || 'TBD'} ${params.preferred_time || ''}`
    );
    this.sessionState.currentStage = 'closing';
  }

  /**
   * Handle conversation end
   */
  private handleEndConversation(params: { reason: string; notes?: string }): void {
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

    if (currentStage === 'needs_discovery' && lead.propertyPreferences.type) {
      this.sessionState.currentStage = 'qualification';
    } else if (currentStage === 'qualification' && lead.qualificationScore >= 50) {
      this.sessionState.currentStage = 'property_discussion';
    } else if (currentStage === 'property_discussion' && lead.qualificationScore >= 70) {
      this.sessionState.currentStage = 'next_steps';
    } else if (possibleNextStages.length === 1) {
      this.sessionState.currentStage = possibleNextStages[0] as typeof currentStage;
    }
  }

  /**
   * Build contextual system prompt
   */
  private buildContextualPrompt(): string {
    const lead = this.sessionState.leadInfo;
    const stage = this.sessionState.currentStage;

    let context = REAL_ESTATE_PROMPT;

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
