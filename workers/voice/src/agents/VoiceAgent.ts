/**
 * Voice Agent
 *
 * Main agent class that orchestrates the voice pipeline:
 * WebRTC Audio → STT → LLM → TTS → WebRTC Audio
 */

import type { Env, SessionState, TranscriptionResult } from '../utils/types';
import { ConversationHandler } from '../handlers/ConversationHandler';
import { SpeechService, FluxStreamingPipeline } from '../services/SpeechService';

export interface VoiceAgentConfig {
  sessionId: string;
  phoneNumber?: string;
}

export class VoiceAgent {
  private env: Env;
  private config: VoiceAgentConfig;
  private sessionState: SessionState | null = null;
  private conversationHandler: ConversationHandler | null = null;
  private speechService: SpeechService;
  private speechPipeline: FluxStreamingPipeline | null = null;
  private isProcessing: boolean = false;

  // Callbacks for audio output
  private onAudioOutput?: (audio: ArrayBuffer) => void;
  private onStateChange?: (state: SessionState) => void;
  private onError?: (error: Error) => void;

  constructor(env: Env, config: VoiceAgentConfig) {
    this.env = env;
    this.config = config;
    this.speechService = new SpeechService(env);
  }

  /**
   * Set callback for audio output (to be sent to WebRTC)
   */
  setOnAudioOutput(callback: (audio: ArrayBuffer) => void): void {
    this.onAudioOutput = callback;
  }

  /**
   * Set callback for state changes
   */
  setOnStateChange(callback: (state: SessionState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Set callback for errors
   */
  setOnError(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  /**
   * Initialize the agent and load/create session
   */
  async initialize(): Promise<SessionState> {
    try {
      // Get or create Durable Object for session
      const sessionDO = this.env.VOICE_SESSION.get(
        this.env.VOICE_SESSION.idFromName(this.config.sessionId)
      );

      // Initialize session
      const response = await sessionDO.fetch('https://session/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.config.sessionId,
          phoneNumber: this.config.phoneNumber,
        }),
      });

      const data = await response.json() as { isNewSession: boolean; session: SessionState };
      this.sessionState = data.session;

      // Initialize conversation handler
      this.conversationHandler = new ConversationHandler(this.env, this.sessionState);

      // Set up audio output callback
      this.conversationHandler.setOnSpeak(audio => {
        if (this.onAudioOutput) {
          this.onAudioOutput(audio);
        }
      });

      // Initialize speech pipeline
      this.speechPipeline = new FluxStreamingPipeline(
        this.env,
        (text: string, isFinal: boolean) => {
          if (isFinal) {
            this.handleTranscription({ text, confidence: 1.0, isFinal, timestamp: new Date().toISOString() });
          }
        }
      );

      console.log(`Agent initialized for session ${this.config.sessionId} (call #${this.sessionState.callCount})`);

      return this.sessionState;
    } catch (error) {
      console.error('Agent initialization error:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
      throw error;
    }
  }

  /**
   * Start the conversation with initial greeting
   */
  async startConversation(): Promise<void> {
    if (!this.conversationHandler || !this.sessionState) {
      throw new Error('Agent not initialized');
    }

    try {
      // Generate and speak greeting
      const greeting = await this.conversationHandler.generateGreeting();

      // Synthesize and output audio
      const ttsResponse = await this.speechService.synthesizeSpeech({ text: greeting });

      if (this.onAudioOutput) {
        this.onAudioOutput(ttsResponse.audio);
      }

      // Save state
      await this.saveSession();
    } catch (error) {
      console.error('Error starting conversation:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    }
  }

  /**
   * Process incoming audio from WebRTC
   */
  processAudio(audioChunk: Uint8Array): void {
    if (!this.speechPipeline) {
      throw new Error('Speech pipeline not initialized');
    }

    this.speechPipeline.sendAudio(audioChunk);
  }

  /**
   * Handle transcription result
   */
  private async handleTranscription(result: TranscriptionResult): Promise<void> {
    if (!this.conversationHandler || !result.text.trim()) {
      return;
    }

    // Prevent concurrent processing
    if (this.isProcessing) {
      console.log('Already processing, queuing transcription');
      return;
    }

    this.isProcessing = true;

    try {
      console.log(`User said: "${result.text}"`);

      // Process through conversation handler
      await this.conversationHandler.handleUserInput(result.text);

      // Save updated state
      await this.saveSession();

      // Notify state change
      if (this.onStateChange && this.sessionState) {
        this.onStateChange(this.sessionState);
      }
    } catch (error) {
      console.error('Error handling transcription:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Handle user interruption
   */
  handleInterruption(): void {
    if (this.speechPipeline) {
      this.speechPipeline.close();
    }
    // Could also stop current TTS playback here
  }

  /**
   * End the conversation
   */
  async endConversation(): Promise<void> {
    try {
      // Mark session as inactive
      const sessionDO = this.env.VOICE_SESSION.get(
        this.env.VOICE_SESSION.idFromName(this.config.sessionId)
      );

      await sessionDO.fetch('https://session/end', {
        method: 'POST',
      });

      console.log(`Conversation ended for session ${this.config.sessionId}`);
    } catch (error) {
      console.error('Error ending conversation:', error);
    }
  }

  /**
   * Save current session state to Durable Object
   */
  private async saveSession(): Promise<void> {
    if (!this.sessionState) return;

    try {
      const sessionDO = this.env.VOICE_SESSION.get(
        this.env.VOICE_SESSION.idFromName(this.config.sessionId)
      );

      await sessionDO.fetch('https://session/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.sessionState),
      });
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState | null {
    return this.sessionState;
  }

  /**
   * Get lead qualification score
   */
  getQualificationScore(): number {
    return this.sessionState?.leadInfo.qualificationScore || 0;
  }
}
