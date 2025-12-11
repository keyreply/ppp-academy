/**
 * StreamingStateManager
 *
 * Manages the streaming state for TTS audio, allowing for coordinated
 * interruption when user barge-in is detected. Uses a session-based
 * approach to track active streams and their stop signals.
 */

export interface StreamState {
  sessionId: string;
  streamId: string;
  startedAt: number;
  shouldStop: boolean;
  bytesStreamed: number;
  interruptedAt?: number;
}

export class StreamingStateManager {
  private streams: Map<string, StreamState> = new Map();
  private onInterrupt?: (sessionId: string, streamId: string) => void;

  /**
   * Set callback for when a stream is interrupted
   */
  setOnInterrupt(callback: (sessionId: string, streamId: string) => void): void {
    this.onInterrupt = callback;
  }

  /**
   * Start tracking a new stream for a session.
   * Returns a unique stream ID.
   */
  startStream(sessionId: string): string {
    // Stop any existing stream for this session
    this.stopStream(sessionId);

    const streamId = `${sessionId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.streams.set(sessionId, {
      sessionId,
      streamId,
      startedAt: Date.now(),
      shouldStop: false,
      bytesStreamed: 0,
    });

    console.log(`[StreamingStateManager] Started stream ${streamId} for session ${sessionId}`);

    return streamId;
  }

  /**
   * Check if a stream should stop (for use in streaming loops)
   */
  getStopStream(sessionId: string): boolean {
    const state = this.streams.get(sessionId);
    return state?.shouldStop ?? false;
  }

  /**
   * Signal a stream to stop (called when barge-in detected)
   */
  stopStream(sessionId: string): boolean {
    const state = this.streams.get(sessionId);

    if (state && !state.shouldStop) {
      state.shouldStop = true;
      state.interruptedAt = Date.now();

      console.log(
        `[StreamingStateManager] Stopping stream ${state.streamId} for session ${sessionId} ` +
          `(streamed ${state.bytesStreamed} bytes in ${state.interruptedAt - state.startedAt}ms)`
      );

      if (this.onInterrupt) {
        this.onInterrupt(sessionId, state.streamId);
      }

      return true;
    }

    return false;
  }

  /**
   * Update bytes streamed count
   */
  updateBytesStreamed(sessionId: string, bytes: number): void {
    const state = this.streams.get(sessionId);
    if (state) {
      state.bytesStreamed += bytes;
    }
  }

  /**
   * Mark stream as complete and remove from tracking
   */
  endStream(sessionId: string): StreamState | undefined {
    const state = this.streams.get(sessionId);
    if (state) {
      console.log(
        `[StreamingStateManager] Ended stream ${state.streamId} for session ${sessionId} ` +
          `(total ${state.bytesStreamed} bytes, interrupted: ${!!state.interruptedAt})`
      );
      this.streams.delete(sessionId);
    }
    return state;
  }

  /**
   * Check if a session has an active stream
   */
  hasActiveStream(sessionId: string): boolean {
    const state = this.streams.get(sessionId);
    return state !== undefined && !state.shouldStop;
  }

  /**
   * Get current stream state for a session
   */
  getStreamState(sessionId: string): StreamState | undefined {
    return this.streams.get(sessionId);
  }

  /**
   * Get all active streams (for debugging)
   */
  getAllStreams(): StreamState[] {
    return Array.from(this.streams.values());
  }

  /**
   * Clear all streams (for cleanup)
   */
  clear(): void {
    this.streams.clear();
  }

  /**
   * Create a shouldStop checker function for use with SpeechService.streamSpeech
   */
  createStopChecker(sessionId: string): () => boolean {
    return () => this.getStopStream(sessionId);
  }
}

// Singleton instance for global state management
let globalInstance: StreamingStateManager | null = null;

/**
 * Get the global StreamingStateManager instance
 */
export function getStreamingStateManager(): StreamingStateManager {
  if (!globalInstance) {
    globalInstance = new StreamingStateManager();
  }
  return globalInstance;
}

/**
 * Create a new StreamingStateManager instance (for testing or isolated use)
 */
export function createStreamingStateManager(): StreamingStateManager {
  return new StreamingStateManager();
}
