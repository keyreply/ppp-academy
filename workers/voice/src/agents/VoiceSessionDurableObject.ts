/**
 * Voice Session Durable Object
 *
 * Persists session state across multiple calls and handles real-time
 * WebSocket communication for voice streaming.
 */

import type { SessionState, LeadInfo, ConversationMessage, ConversationStage, Env } from '../utils/types';
import { RealtimeVoiceHandler, VoiceHandlerCallbacks } from '../handlers/RealtimeVoiceHandler';
import { FluxStreamingPipeline, FluxTurnCallbacks } from '../services/SpeechService';
import { BargeInDetector } from '../utils/BargeInDetector';
import { createStreamingStateManager, StreamingStateManager } from '../utils/StreamingStateManager';

export class VoiceSessionDurableObject implements DurableObject {
  private state: DurableObjectState;
  private env: Env;
  private sessionState: SessionState | null = null;
  private webSockets: Set<WebSocket> = new Set();
  private voiceHandler: RealtimeVoiceHandler | null = null;
  private sttPipeline: FluxStreamingPipeline | null = null;
  private bargeInDetector: BargeInDetector | null = null;
  private streamingStateManager: StreamingStateManager | null = null;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  /**
   * Handle incoming requests to the Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      switch (path) {
        case '/init':
          return this.handleInit(request);

        case '/get':
          return this.handleGet();

        case '/update':
          return this.handleUpdate(request);

        case '/message':
          return this.handleAddMessage(request);

        case '/lead':
          return this.handleUpdateLead(request);

        case '/end':
          return this.handleEndSession();

        case '/reset':
          return this.handleReset();

        case '/websocket':
          return this.handleWebSocketUpgrade(request);

        case '/audio':
          return this.handleAudioData(request);

        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error) {
      console.error('Durable Object error:', error);
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Handle WebSocket upgrade for real-time voice
   */
  private async handleWebSocketUpgrade(_request: Request): Promise<Response> {
    // Load session state if needed
    if (!this.sessionState) {
      this.sessionState = (await this.state.storage.get<SessionState>('session')) ?? null;
    }

    if (!this.sessionState) {
      return new Response('Session not found', { status: 404 });
    }

    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the server-side WebSocket
    this.state.acceptWebSocket(server);
    this.webSockets.add(server);

    // Initialize streaming state manager
    this.streamingStateManager = createStreamingStateManager();

    // Initialize barge-in detector as FALLBACK for non-Flux STT models
    this.bargeInDetector = new BargeInDetector({
      energyThreshold: 0.015, // Slightly lower threshold for sensitivity
      minFrames: 3,
      cooldownMs: 800, // 800ms cooldown between barge-ins
    });

    // Handle fallback barge-in events (only used when Flux turn detection unavailable)
    this.bargeInDetector.setOnBargeIn(event => {
      // Only process if STT pipeline is not using Flux turn detection
      if (this.sttPipeline?.isUsingFluxTurnDetection()) {
        return; // Flux handles barge-in via StartOfTurn event
      }

      console.log(
        `[VoiceSession] Fallback VAD barge-in detected! Energy: ${event.energyLevel.toFixed(3)}, ` +
          `Frames: ${event.consecutiveFrames}`
      );

      this.handleBargeIn('fallback_vad');
    });

    // Initialize voice handler with callbacks
    const callbacks: VoiceHandlerCallbacks = {
      onTranscript: (text, isFinal) => {
        this.broadcast({ type: 'transcript', text, isFinal });
      },
      onAgentText: (text, isFinal) => {
        this.broadcast({ type: 'agent_text', text, isFinal });
      },
      onAudio: audio => {
        // Send audio directly as binary
        for (const ws of this.webSockets) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(audio);
          }
        }
      },
      onStateUpdate: state => {
        this.broadcast({ type: 'state_update', ...state });
      },
      onError: error => {
        this.broadcast({ type: 'error', message: error.message });
      },
    };

    this.voiceHandler = new RealtimeVoiceHandler(
      this.env,
      this.sessionState,
      callbacks,
      this.streamingStateManager,
      this.bargeInDetector
    );

    // Flux turn detection callbacks - primary barge-in detection
    const fluxTurnCallbacks: Partial<FluxTurnCallbacks> = {
      onStartOfTurn: (turnIndex) => {
        // User started speaking - this is the barge-in signal from Flux
        console.log(`[VoiceSession] Flux StartOfTurn: turn_index=${turnIndex}`);

        // Only treat as barge-in if agent is currently speaking
        if (this.bargeInDetector?.isAgentCurrentlySpeaking()) {
          this.handleBargeIn('flux_start_of_turn');
        }

        this.broadcast({ type: 'start_of_turn', turnIndex });
      },
      onEagerEndOfTurn: (transcript, confidence, turnIndex) => {
        // Early end-of-turn - can start generating response
        console.log(
          `[VoiceSession] Flux EagerEndOfTurn: confidence=${confidence.toFixed(2)}, turn=${turnIndex}`
        );
        this.broadcast({
          type: 'eager_end_of_turn',
          transcript,
          confidence,
          turnIndex,
        });
      },
      onTurnResumed: (turnIndex) => {
        // User continued speaking after eager EOT - may need to cancel pending response
        console.log(`[VoiceSession] Flux TurnResumed: turn_index=${turnIndex}`);
        this.broadcast({ type: 'turn_resumed', turnIndex });
      },
      onEndOfTurn: (transcript, turnIndex) => {
        // Definitive end of turn
        console.log(`[VoiceSession] Flux EndOfTurn: turn_index=${turnIndex}`);
        this.broadcast({ type: 'end_of_turn', transcript, turnIndex });
      },
    };

    // Initialize STT pipeline with Flux turn detection
    this.sttPipeline = new FluxStreamingPipeline(
      this.env,
      (text, isFinal) => {
        if (this.voiceHandler) {
          this.voiceHandler.handleTranscript(text, isFinal);
        }
      },
      error => {
        console.error('STT error:', error);
        this.broadcast({ type: 'error', message: 'Speech recognition error' });
      },
      fluxTurnCallbacks,
      {
        eagerEotThreshold: 0.5, // Enable eager end-of-turn detection
        eotThreshold: 0.7,
        eotTimeoutMs: 3000,
      }
    );

    // Connect to Flux
    await this.sttPipeline.connect();

    // Generate greeting after connection
    const greeting = await this.voiceHandler.generateGreeting();
    this.broadcast({ type: 'greeting', text: greeting });

    // Save session state
    await this.saveSession();

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * Handle incoming audio data from WebSocket
   */
  private async handleAudioData(request: Request): Promise<Response> {
    if (!this.sttPipeline) {
      // Session might have ended or STT not ready
      return new Response('STT not active', { status: 400 });
    }

    const audioData = await request.arrayBuffer();
    const audioUint8 = new Uint8Array(audioData);

    if (!this.sttPipeline) {
      return new Response('STT connection closed', { status: 400 });
    }

    // Check for barge-in while agent is speaking
    if (this.bargeInDetector) {
      this.bargeInDetector.processAudioFrame(audioUint8);
    }

    this.sttPipeline.sendAudio(audioUint8);

    return new Response('OK');
  }

  /**
   * Handle WebSocket messages (called by runtime)
   */
  async webSocketMessage(_ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (message instanceof ArrayBuffer) {
      // Audio data
      const audioData = new Uint8Array(message);

      // Check for barge-in while agent is speaking
      if (this.bargeInDetector) {
        this.bargeInDetector.processAudioFrame(audioData);
      }

      if (this.sttPipeline) {
        this.sttPipeline.sendAudio(audioData);
      }
    } else {
      // JSON message
      try {
        const data = JSON.parse(message);
        if (data.type === 'text' && this.voiceHandler) {
          await this.voiceHandler.handleTranscript(data.text, true);
        }
      } catch (e) {
        console.error('Invalid message:', e);
      }
    }
  }

  /**
   * Handle WebSocket close
   */
  async webSocketClose(ws: WebSocket): Promise<void> {
    this.webSockets.delete(ws);

    if (this.webSockets.size === 0) {
      // Clean up when all connections close
      if (this.sttPipeline) {
        this.sttPipeline.close();
        this.sttPipeline = null;
      }

      // Save final state
      if (this.voiceHandler) {
        this.sessionState = this.voiceHandler.getSessionState();
        await this.saveSession();
      }
    }
  }

  /**
   * Handle barge-in event (user started speaking during agent speech)
   * Can be triggered by Flux StartOfTurn or fallback VAD detection
   *
   * @param source Source of barge-in detection ('flux_start_of_turn' or 'fallback_vad')
   */
  private handleBargeIn(source: 'flux_start_of_turn' | 'fallback_vad'): void {
    console.log(`[VoiceSession] Barge-in detected via ${source}`);

    // Stop current TTS stream
    if (this.streamingStateManager && this.sessionState) {
      const stopped = this.streamingStateManager.stopStream(this.sessionState.sessionId);
      if (stopped) {
        this.broadcast({
          type: 'barge_in',
          source,
          timestamp: Date.now(),
        });
      }
    }

    // Notify bargeInDetector that agent stopped speaking
    this.bargeInDetector?.agentStoppedSpeaking();
  }

  /**
   * Broadcast message to all connected WebSockets
   */
  private broadcast(message: Record<string, unknown>): void {
    const data = JSON.stringify(message);
    for (const ws of this.webSockets) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  /**
   * Initialize or resume a session
   */
  private async handleInit(request: Request): Promise<Response> {
    const body = (await request.json()) as { sessionId: string; phoneNumber?: string };

    // Try to load existing session
    this.sessionState = (await this.state.storage.get<SessionState>('session')) ?? null;

    if (this.sessionState) {
      // Existing session - increment call count
      this.sessionState.callCount += 1;
      this.sessionState.lastCallAt = new Date().toISOString();
      this.sessionState.isActive = true;
    } else {
      // New session
      this.sessionState = this.createNewSession(body.sessionId, body.phoneNumber);
    }

    await this.saveSession();
    this.state.waitUntil(this.updateRegistry('active'));

    return new Response(
      JSON.stringify({
        isNewSession: this.sessionState.callCount === 1,
        session: this.sessionState,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  /**
   * Get current session state
   */
  private async handleGet(): Promise<Response> {
    if (!this.sessionState) {
      this.sessionState = (await this.state.storage.get<SessionState>('session')) ?? null;
    }

    if (!this.sessionState) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Update session state
   */
  private async handleUpdate(request: Request): Promise<Response> {
    if (!this.sessionState) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updates = (await request.json()) as Partial<SessionState>;

    // Merge updates
    this.sessionState = {
      ...this.sessionState,
      ...updates,
      leadInfo: {
        ...this.sessionState.leadInfo,
        ...(updates.leadInfo || {}),
      },
    };

    await this.saveSession();
    this.state.waitUntil(this.updateRegistry('active'));

    return new Response(JSON.stringify(this.sessionState), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Add a message to conversation history
   */
  private async handleAddMessage(request: Request): Promise<Response> {
    if (!this.sessionState) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const message = (await request.json()) as ConversationMessage;
    this.sessionState.conversationHistory.push(message);

    // Keep history manageable (last 50 messages)
    if (this.sessionState.conversationHistory.length > 50) {
      const systemMessages = this.sessionState.conversationHistory.filter(m => m.role === 'system');
      const recentMessages = this.sessionState.conversationHistory
        .filter(m => m.role !== 'system')
        .slice(-40);
      this.sessionState.conversationHistory = [...systemMessages, ...recentMessages];
    }

    await this.saveSession();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Update lead information
   */
  private async handleUpdateLead(request: Request): Promise<Response> {
    if (!this.sessionState) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const updates = (await request.json()) as Partial<LeadInfo>;

    this.sessionState.leadInfo = {
      ...this.sessionState.leadInfo,
      ...updates,
      propertyPreferences: {
        ...this.sessionState.leadInfo.propertyPreferences,
        ...(updates.propertyPreferences || {}),
      },
      updatedAt: new Date().toISOString(),
    };

    await this.saveSession();

    return new Response(JSON.stringify(this.sessionState.leadInfo), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * End the current session (mark inactive)
   */
  private async handleEndSession(): Promise<Response> {
    if (!this.sessionState) {
      return new Response(JSON.stringify({ error: 'No session found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    this.sessionState.isActive = false;

    // Clean up WebSocket connections
    for (const ws of this.webSockets) {
      try {
        ws.close();
      } catch (e) {
        // Ignore errors if already closed
      }
    }
    this.webSockets.clear();

    // Clean up STT pipeline
    if (this.sttPipeline) {
      this.sttPipeline.close();
      this.sttPipeline = null;
    }

    await this.saveSession();
    this.state.waitUntil(this.updateRegistry('ended'));

    return new Response(JSON.stringify({ success: true, session: this.sessionState }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Reset session completely
   */
  private async handleReset(): Promise<Response> {
    await this.state.storage.delete('session');
    this.sessionState = null;

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * Create a new session state
   */
  private createNewSession(sessionId: string, phoneNumber?: string): SessionState {
    const now = new Date().toISOString();

    const leadInfo: LeadInfo = {
      id: crypto.randomUUID(),
      phoneNumber,
      propertyPreferences: {},
      notes: [],
      qualificationScore: 0,
      createdAt: now,
      updatedAt: now,
    };

    return {
      sessionId,
      leadInfo,
      conversationHistory: [],
      currentStage: 'greeting' as ConversationStage,
      callCount: 1,
      lastCallAt: now,
      isActive: true,
    };
  }

  /**
   * Save session to durable storage
   */
  private async saveSession(): Promise<void> {
    if (this.sessionState) {
      await this.state.storage.put('session', this.sessionState);
    }
  }

  /**
   * Alarm handler for session cleanup (optional)
   */
  async alarm(): Promise<void> {
    if (this.sessionState && !this.sessionState.isActive) {
      const lastCall = new Date(this.sessionState.lastCallAt || 0);
      const daysSinceLastCall = (Date.now() - lastCall.getTime()) / (1000 * 60 * 60 * 24);

      // Archive session after 30 days of inactivity
      if (daysSinceLastCall > 30) {
        console.log(`Archiving stale session: ${this.sessionState.sessionId}`);
      }
    }
  }

  /**
   * Helper to register session with global registry
   */
  private async updateRegistry(status: 'active' | 'ended' = 'active'): Promise<void> {
    if (!this.sessionState) return;

    try {
      const registryId = this.env.SESSION_REGISTRY.idFromName('global-registry');
      const registry = this.env.SESSION_REGISTRY.get(registryId);

      const metadata = {
        sessionId: this.sessionState.sessionId,
        startTime: this.sessionState.leadInfo.createdAt,
        status,
        leadId: this.sessionState.leadInfo.id,
        callCount: this.sessionState.callCount,
        lastUpdate: new Date().toISOString(),
      };

      if (status === 'active') {
        // use fetch since we can't type check the remote stub easily here without more generic types
        await registry.fetch('https://registry/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
        });
      } else {
        await registry.fetch('https://registry/unregister', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: this.sessionState.sessionId }),
        });
      }
    } catch (error) {
      console.error('Failed to update session registry:', error);
      // Don't fail the main session if registry fails
    }
  }
}
