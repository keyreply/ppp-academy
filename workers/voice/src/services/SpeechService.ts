/**
 * Speech Service - Real-time STT/TTS Integration
 *
 * STT: Deepgram Flux via WebSocket for real-time streaming
 * TTS: Minimax with Singapore voice
 */

import type { Env, TranscriptionResult, TTSRequest, TTSResponse } from '../utils/types';
import { DEFAULT_SPEECH_CONFIG, DEEPGRAM_CONFIG, MINIMAX_CONFIG } from '../utils/config';
import { StreamPacer } from '../utils/StreamPacer';

export class SpeechService {
  private env: Env;

  // Helper to estimate duration for PCM 16kHz 16-bit mono
  private estimateDuration(buffer: ArrayBuffer): number {
    return buffer.byteLength / 32000; // 16000 samples/sec * 2 bytes/sample
  }

  static async validateConnection(env: Env): Promise<{ success: boolean; message: string }> {
    const apiKey = env.MINIMAX_API_KEY;
    // GroupID not strictly needed in URL for .io endpoint, but we keep env for consistency if needed later

    if (!apiKey) {
      return { success: false, message: 'Missing MINIMAX_API_KEY' };
    }

    try {
      // Perform a minimal valid request
      const response = await fetch(
        `${MINIMAX_CONFIG.baseUrl}${MINIMAX_CONFIG.ttsEndpoint}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: MINIMAX_CONFIG.model,
            text: 'Connection check',
            stream: false,
            language_boost: 'auto',
            output_format: 'url',
            voice_setting: { voice_id: MINIMAX_CONFIG.voiceId, speed: 1.0, vol: 1.0, pitch: 0 },
            audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
          }),
        }
      );

      const data = (await response.json()) as any;

      if (data.base_resp && data.base_resp.status_code !== 0) {
        return {
          success: false,
          message: `Minimax Error: ${data.base_resp.status_code} - ${data.base_resp.status_msg}`,
        };
      }

      return { success: true, message: 'Connection Successful' };
    } catch (error) {
      return { success: false, message: `Network Error: ${String(error)}` };
    }
  }

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Create a WebSocket connection to Deepgram Flux for real-time STT
   * Returns a WebSocket that can receive audio and emit transcriptions
   *
   * @param config Optional Flux configuration for turn detection
   */
  async createFluxSTTWebSocket(config?: {
    eagerEotThreshold?: number;
    eotThreshold?: number;
    eotTimeoutMs?: number;
  }): Promise<{
    webSocket: WebSocket;
  }> {
    // Build Flux parameters with turn detection config
    const fluxParams: Record<string, unknown> = {
      encoding: 'linear16',
      sample_rate: '16000',
    };

    // Add turn detection parameters if provided
    if (config?.eagerEotThreshold !== undefined) {
      fluxParams.eager_eot_threshold = config.eagerEotThreshold.toString();
    }
    if (config?.eotThreshold !== undefined) {
      fluxParams.eot_threshold = config.eotThreshold.toString();
    }
    if (config?.eotTimeoutMs !== undefined) {
      fluxParams.eot_timeout_ms = config.eotTimeoutMs.toString();
    }

    console.log('[SpeechService] Creating Flux WebSocket with params:', JSON.stringify(fluxParams));

    // Use Workers AI WebSocket mode for Flux
    try {
      // @ts-ignore - The types for env.AI.run might not reflect that it returns a Response object with webSocket
      const resp = await this.env.AI.run(
        DEEPGRAM_CONFIG.fluxModel as Parameters<Ai['run']>[0],
        fluxParams,
        { websocket: true }
      ) as any; // Cast to any to safely access potentially existing webSocket prop

      // Check if it's a Response object (common in CF Workers for websocket upgrades)
      if (resp instanceof Response) {
        console.log('[SpeechService] env.AI.run returned a Response object. Status:', resp.status);
      }

      const ws = resp?.webSocket;

      if (!ws) {
        console.error('[SpeechService] Flux WebSocket creation failed. Object keys:', Object.keys(resp || {}));
        // If it is a Response, try to clone and text() it to see error body if status is not 101
        if (resp instanceof Response && resp.status !== 101) {
          const errorText = await resp.text();
          console.error('[SpeechService] Flux Response Error Body:', errorText);
        }
        throw new Error('Failed to create Flux WebSocket - no webSocket in response');
      }

      // The response contains the WebSocket for bidirectional streaming
      return { webSocket: ws };
    } catch (e) {
      console.error('[SpeechService] env.AI.run Exception:', e);
      throw e;
    }
  }

  /**
   * Transcribe audio using Deepgram Nova-3 (batch mode, for non-streaming)
   */
  async transcribeAudio(audioData: ArrayBuffer): Promise<TranscriptionResult> {
    try {
      const result = (await this.env.AI.run(
        DEEPGRAM_CONFIG.nova3Model as Parameters<Ai['run']>[0],
        {
          audio: Array.from(new Uint8Array(audioData)),
        }
      )) as { text: string };

      return {
        text: result.text || '',
        confidence: 1.0,
        isFinal: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }

  /**
   * Synthesize speech using Minimax TTS
   */
  async synthesizeSpeech(request: TTSRequest): Promise<TTSResponse> {
    // Check if MINIMAX_API_KEY is available
    if (!this.env.MINIMAX_API_KEY) {
      // Fallback to Workers AI Aura-2 if no Minimax key
      return this.synthesizeSpeechWithAura(request);
    }

    try {
      const voice = request.voice || DEFAULT_SPEECH_CONFIG.ttsVoice;

      console.log(`Minimax TTS Request: Voice=${voice}, Model=${MINIMAX_CONFIG.model}`);
      if (this.env.MINIMAX_API_KEY) {
        console.log(`Minimax API Key present: ${this.env.MINIMAX_API_KEY.substring(0, 10)}...`);
      } else {
        console.error('Minimax API Key is MISSING in SpeechService environment!');
      }

      const response = await fetch(
        `${MINIMAX_CONFIG.baseUrl}${MINIMAX_CONFIG.ttsEndpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.env.MINIMAX_API_KEY}`,
          },
          body: JSON.stringify({
            model: MINIMAX_CONFIG.model,
            text: request.text,
            stream: false,
            language_boost: 'auto',
            output_format: 'url',
            voice_setting: {
              voice_id: voice,
              speed: 1.0,
              vol: 1.0,
              pitch: 0,
            },
            audio_setting: {
              sample_rate: 32000,
              bitrate: 128000,
              format: 'mp3',
              channel: 1,
            },
            voice_modify: {
              pitch: 0,
              intensity: 0,
              timbre: 0,
              sound_effects: "spacious_echo"
            }
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Minimax TTS error:', errorText);
        // Fallback to Aura-2 on error
        return this.synthesizeSpeechWithAura(request);
      }

      const data = (await response.json()) as {
        audio_file?: string;
        data?: { audio?: string };
        base64_audio?: string;
        statusCode?: number;
        status_code?: number;
      };

      console.log('Minimax TTS Response keys:', Object.keys(data));

      // Determine if we have a URL or direct audio
      const audioUrl = data.data?.audio || data.audio_file;
      let rawAudio: ArrayBuffer | null = null;

      if (audioUrl && audioUrl.startsWith('http')) {
        console.log('Minimax returned audio URL, downloading:', audioUrl);
        // Download the audio
        const audioResp = await fetch(audioUrl);
        if (!audioResp.ok) throw new Error('Failed to download audio from Minimax URL');
        rawAudio = await audioResp.arrayBuffer();
      } else {
        // Fallback to base64 if it happens to be there
        const base64Audio = data.base64_audio;
        if (!base64Audio) {
          console.error('Full Minimax Response:', JSON.stringify(data).substring(0, 500) + '...');
          throw new Error('No audio URL or base64 in Minimax response');
        }
        // Decode Base64
        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        rawAudio = bytes.buffer;
      }

      return {
        audio: rawAudio!,
        duration: this.estimateDuration(rawAudio!),
      };
    } catch (error) {
      console.error('Minimax TTS error:', error);
      // Fallback to Aura-2
      return this.synthesizeSpeechWithAura(request);
    }
  }

  /**
   * Fallback TTS using Workers AI Aura-2
   */
  private async synthesizeSpeechWithAura(request: TTSRequest): Promise<TTSResponse> {
    try {
      const result = await this.env.AI.run(
        DEEPGRAM_CONFIG.aura2Model as Parameters<Ai['run']>[0],
        {
          text: request.text,
          speaker: 'luna', // Aura-2 voice
          encoding: 'linear16',
          sample_rate: DEFAULT_SPEECH_CONFIG.sampleRate,
        }
      );

      let audioBuffer: ArrayBuffer;

      if (result instanceof ReadableStream) {
        // Collect stream into buffer
        const reader = result.getReader();
        const chunks: Uint8Array[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const combined = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
          combined.set(chunk, offset);
          offset += chunk.length;
        }
        audioBuffer = combined.buffer;
      } else {
        audioBuffer = result as ArrayBuffer;
      }

      return {
        audio: audioBuffer,
        duration: this.estimateDuration(audioBuffer),
      };
    } catch (error) {
      console.error('Aura-2 TTS error:', error);
      throw error;
    }
  }

  /**
   * Synthesize speech with streaming output
   */
  /**
   * Stream speech using Minimax TTS (SSE) with time-synchronized pacing.
   * Calls onChunk with raw audio data as it arrives, paced to match real-time playback.
   *
   * @param request TTS request with text and voice settings
   * @param onChunk Callback for each audio chunk
   * @param options Optional settings for pacing and interruption
   * @returns Object with wasInterrupted flag indicating if stream was stopped early
   */
  async streamSpeech(
    request: TTSRequest,
    onChunk: (chunk: ArrayBuffer) => void,
    options?: {
      shouldStop?: () => boolean;
      targetBufferMs?: number;
    }
  ): Promise<{ wasInterrupted: boolean }> {
    if (!this.env.MINIMAX_API_KEY) {
      // Fallback to Aura (non-streaming for now, or implement mock stream)
      const response = await this.synthesizeSpeechWithAura(request);
      onChunk(response.audio);
      return { wasInterrupted: false };
    }

    // Initialize pacer for 16kHz 16-bit mono PCM
    const pacer = new StreamPacer({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      targetBufferMs: options?.targetBufferMs ?? DEFAULT_SPEECH_CONFIG.ttsBufferMs ?? 250,
    });

    let wasInterrupted = false;

    try {
      const voice = request.voice || MINIMAX_CONFIG.voiceId;

      const response = await fetch(
        `${MINIMAX_CONFIG.baseUrl}${MINIMAX_CONFIG.ttsEndpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.env.MINIMAX_API_KEY}`,
          },
          body: JSON.stringify({
            model: MINIMAX_CONFIG.model,
            text: request.text,
            stream: true,
            output_format: 'hex',
            voice_setting: {
              voice_id: voice,
              speed: request.speed || 1.0,
              vol: 1.0,
              pitch: request.pitch || 0,
            },
            audio_setting: {
              sample_rate: 16000,
              bitrate: 256000,
              format: 'pcm',
              channel: 1,
            },
            pronunciation_dict: {
              tone: ["NRIC/N R I C"]
            }
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Minimax API Error: ${response.status} ${await response.text()}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body reader');

      const decoder = new TextDecoder();
      let buffer = '';

      // Reset pacer at stream start
      pacer.reset();

      while (true) {
        // Check for interrupt before reading
        if (options?.shouldStop?.()) {
          console.log('[Minimax TTS] Stream interrupted - stopping...');
          wasInterrupted = true;
          reader.cancel();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Check for interrupt during line processing
          if (options?.shouldStop?.()) {
            console.log('[Minimax TTS] Stream interrupted during processing - stopping...');
            wasInterrupted = true;
            reader.cancel();
            break;
          }

          if (line.trim().startsWith('data:')) {
            try {
              const jsonStr = line.replace('data:', '').trim();
              // some SSE payloads might be "[DONE]"
              if (jsonStr === '[DONE]') continue;

              const data = JSON.parse(jsonStr);

              // data.data.audio is the hex string
              const hexAudio = data.data?.audio;
              if (hexAudio) {
                // Convert Hex to Uint8Array
                const byteArray = new Uint8Array(
                  hexAudio.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
                );

                // Pace the chunk transmission to match real-time playback
                await pacer.pace(byteArray.byteLength);

                // Double check interrupt after pacing wait
                if (options?.shouldStop?.()) {
                  console.log('[Minimax TTS] Stream interrupted after pacing - stopping...');
                  wasInterrupted = true;
                  reader.cancel();
                  break;
                }

                onChunk(byteArray.buffer);
              }
            } catch (e) {
              console.warn('Error parsing SSE line:', line.substring(0, 50), e);
            }
          }
        }

        // Break outer loop if interrupted during line processing
        if (wasInterrupted) break;
      }

      // Process remaining buffer (only if not interrupted)
      if (!wasInterrupted && buffer.trim().startsWith('data:')) {
        try {
          const jsonStr = buffer.replace('data:', '').trim();
          if (jsonStr !== '[DONE]') {
            const data = JSON.parse(jsonStr);
            const hexAudio = data.data?.audio;
            if (hexAudio) {
              const byteArray = new Uint8Array(
                hexAudio.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
              );
              await pacer.pace(byteArray.byteLength);
              if (!options?.shouldStop?.()) {
                onChunk(byteArray.buffer);
              }
            }
          }
        } catch (e) { /* ignore end of stream garbage */ }
      }

      // Log pacing stats
      const stats = pacer.getStats();
      console.log(`[Minimax TTS] Stream complete: ${stats.bytesSent} bytes, ${stats.audioDurationMs.toFixed(0)}ms audio, ${stats.elapsedMs}ms elapsed, lead=${stats.leadMs.toFixed(0)}ms, interrupted=${wasInterrupted}`);

    } catch (error) {
      console.error('Streaming TTS Error:', error);
      throw error;
    }

    return { wasInterrupted };
  }

  /**
   * Estimate audio duration from buffer size
   */

}

/**
 * Flux event types for turn detection
 */
export type FluxEventType =
  | 'StartOfTurn'    // User began speaking - use for barge-in detection
  | 'Update'         // Interim transcription
  | 'EagerEndOfTurn' // Early end-of-turn signal (if eager threshold set)
  | 'TurnResumed'    // User continued after eager EOT
  | 'EndOfTurn';     // Final end of turn

/**
 * Flux message from WebSocket
 */
export interface FluxMessage {
  request_id?: string;
  sequence_id?: number;
  event: FluxEventType;
  turn_index?: number;
  audio_window_start?: number;
  audio_window_end?: number;
  transcript?: string;
  words?: Array<{ word: string; start: number; end: number; confidence: number }>;
  end_of_turn_confidence?: number;
  // Legacy Deepgram fields (for backward compatibility)
  channel?: {
    alternatives?: Array<{ transcript: string; confidence: number }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
}

/**
 * Callbacks for Flux turn detection events
 */
export interface FluxTurnCallbacks {
  /** Called when user starts speaking (barge-in signal) */
  onStartOfTurn?: (turnIndex: number) => void;
  /** Called with interim/final transcripts */
  onTranscript: (text: string, isFinal: boolean, turnIndex?: number) => void;
  /** Called on early end-of-turn detection (for eager response) */
  onEagerEndOfTurn?: (transcript: string, confidence: number, turnIndex: number) => void;
  /** Called when user resumes speaking after eager EOT */
  onTurnResumed?: (turnIndex: number) => void;
  /** Called when turn is definitively complete */
  onEndOfTurn?: (transcript: string, turnIndex: number) => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Configuration for Flux turn detection
 */
export interface FluxConfig {
  /** Enable eager end-of-turn detection (0.3-0.9). When set, enables EagerEndOfTurn events */
  eagerEotThreshold?: number;
  /** End-of-turn confidence threshold (0.5-0.9, default 0.7) */
  eotThreshold?: number;
  /** Max time after speech to force end of turn (default 5000ms) */
  eotTimeoutMs?: number;
}

/**
 * Real-time streaming pipeline using Deepgram Flux WebSocket
 * Handles continuous audio streaming with turn detection events
 */
export class FluxStreamingPipeline {
  private env: Env;
  private webSocket: WebSocket | null = null;
  private callbacks: FluxTurnCallbacks;
  private config: FluxConfig;
  private isConnected: boolean = false;
  private pendingAudio: Uint8Array[] = [];
  private currentTurnIndex: number = 0;
  private isFluxModel: boolean = true; // Track if we're using Flux vs legacy

  constructor(
    env: Env,
    onTranscript: (text: string, isFinal: boolean) => void,
    onError?: (error: Error) => void,
    turnCallbacks?: Partial<FluxTurnCallbacks>,
    config?: FluxConfig
  ) {
    this.env = env;
    this.callbacks = {
      onTranscript,
      onError: onError || console.error,
      ...turnCallbacks,
    };
    this.config = {
      eagerEotThreshold: config?.eagerEotThreshold ?? 0.5, // Enable eager detection by default
      eotThreshold: config?.eotThreshold ?? 0.7,
      eotTimeoutMs: config?.eotTimeoutMs ?? 3000, // 3 second timeout
    };
  }

  /**
   * Initialize the Flux WebSocket connection
   */
  async connect(): Promise<void> {
    try {
      const speechService = new SpeechService(this.env);
      const { webSocket } = await speechService.createFluxSTTWebSocket(this.config);

      this.webSocket = webSocket;

      if (!this.webSocket) {
        throw new Error('WebSocket is null immediately after creation');
      }

      this.webSocket.accept();

      this.webSocket.addEventListener('open', () => {
        console.log('[Flux] WebSocket connected with turn detection enabled');
        this.isConnected = true;

        // Send any pending audio
        for (const chunk of this.pendingAudio) {
          this.webSocket?.send(chunk);
        }
        this.pendingAudio = [];
      });

      this.webSocket.addEventListener('message', (event: MessageEvent) => {
        this.handleMessage(event.data as string);
      });

      this.webSocket.addEventListener('error', (event: Event) => {
        console.error('[Flux] WebSocket error:', event);
        this.callbacks.onError?.(new Error('WebSocket error'));
      });

      this.webSocket.addEventListener('close', () => {
        console.log('[Flux] WebSocket closed');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('[Flux] Failed to connect:', error);
      this.callbacks.onError?.(error as Error);
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as FluxMessage;

      // Check if this is Flux format (has event field) or legacy Deepgram format
      if (message.event) {
        this.handleFluxEvent(message);
      } else {
        // Legacy Deepgram format (backward compatibility)
        this.handleLegacyMessage(message);
      }
    } catch {
      // Binary data or non-JSON, ignore
    }
  }

  /**
   * Handle Flux-specific event types
   */
  private handleFluxEvent(message: FluxMessage): void {
    const turnIndex = message.turn_index ?? this.currentTurnIndex;

    switch (message.event) {
      case 'StartOfTurn':
        this.currentTurnIndex = turnIndex;
        console.log(`[Flux] StartOfTurn: turn_index=${turnIndex}`);
        this.callbacks.onStartOfTurn?.(turnIndex);
        break;

      case 'Update':
        if (message.transcript?.trim()) {
          this.callbacks.onTranscript(message.transcript, false, turnIndex);
        }
        break;

      case 'EagerEndOfTurn':
        console.log(
          `[Flux] EagerEndOfTurn: confidence=${message.end_of_turn_confidence?.toFixed(2)}, ` +
          `turn_index=${turnIndex}, transcript="${message.transcript?.substring(0, 50)}..."`
        );
        if (message.transcript && message.end_of_turn_confidence !== undefined) {
          this.callbacks.onEagerEndOfTurn?.(
            message.transcript,
            message.end_of_turn_confidence,
            turnIndex
          );
          // Also emit as final transcript for handlers that don't use eager detection
          this.callbacks.onTranscript(message.transcript, true, turnIndex);
        }
        break;

      case 'TurnResumed':
        console.log(`[Flux] TurnResumed: turn_index=${turnIndex}`);
        this.callbacks.onTurnResumed?.(turnIndex);
        break;

      case 'EndOfTurn':
        console.log(
          `[Flux] EndOfTurn: turn_index=${turnIndex}, transcript="${message.transcript?.substring(0, 50)}..."`
        );
        if (message.transcript) {
          this.callbacks.onEndOfTurn?.(message.transcript, turnIndex);
          // Also emit as final transcript
          this.callbacks.onTranscript(message.transcript, true, turnIndex);
        }
        break;
    }
  }

  /**
   * Handle legacy Deepgram message format (backward compatibility)
   */
  private handleLegacyMessage(message: FluxMessage): void {
    this.isFluxModel = false; // Mark as not using Flux

    const transcript = message.channel?.alternatives?.[0]?.transcript;
    const isFinal = message.is_final === true;
    const speechFinal = message.speech_final === true;

    if (transcript && transcript.trim()) {
      this.callbacks.onTranscript(transcript, isFinal || speechFinal);
    }
  }

  /**
   * Check if using Flux model with turn detection
   */
  isUsingFluxTurnDetection(): boolean {
    return this.isFluxModel;
  }

  /**
   * Get current turn index
   */
  getCurrentTurnIndex(): number {
    return this.currentTurnIndex;
  }

  /**
   * Send audio data to Flux for transcription
   */
  sendAudio(audioData: Uint8Array): void {
    if (this.isConnected && this.webSocket) {
      this.webSocket.send(audioData);
    } else {
      // Queue audio until connected
      this.pendingAudio.push(audioData);
    }
  }

  /**
   * Check if connected
   */
  isActive(): boolean {
    return this.isConnected;
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    if (this.webSocket) {
      try {
        this.webSocket.close();
      } catch (e) {
        // Ignore errors if already closed or not accepted
        console.log('Flux WebSocket close ignored:', e);
      }
      this.webSocket = null;
    }
    this.isConnected = false;
    this.pendingAudio = [];
  }
}
