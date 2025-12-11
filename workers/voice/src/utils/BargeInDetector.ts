/**
 * BargeInDetector
 *
 * FALLBACK barge-in detection for non-Flux STT models.
 *
 * When using Deepgram Flux, prefer the native StartOfTurn event which provides
 * semantic-aware turn detection. This class is for backward compatibility with
 * other STT models that don't have built-in turn detection.
 *
 * Detects when a user starts speaking during TTS playback (barge-in).
 * Uses audio energy levels and VAD (Voice Activity Detection) heuristics
 * to determine if the user is interrupting.
 */

export interface BargeInConfig {
  /** Energy threshold for detecting speech (0-1 scale). Default: 0.02 */
  energyThreshold: number;
  /** Minimum consecutive frames above threshold to trigger barge-in. Default: 3 */
  minFrames: number;
  /** Time window in ms to analyze for speech. Default: 150 */
  windowMs: number;
  /** Sample rate of incoming audio. Default: 16000 */
  sampleRate: number;
  /** Cooldown period after barge-in before detecting again. Default: 1000ms */
  cooldownMs: number;
}

export interface BargeInEvent {
  timestamp: number;
  energyLevel: number;
  consecutiveFrames: number;
}

export class BargeInDetector {
  private config: BargeInConfig;
  private isAgentSpeaking: boolean = false;
  private consecutiveActiveFrames: number = 0;
  private lastBargeInTime: number = 0;
  private onBargeIn?: (event: BargeInEvent) => void;

  constructor(config: Partial<BargeInConfig> = {}) {
    this.config = {
      energyThreshold: config.energyThreshold ?? 0.02,
      minFrames: config.minFrames ?? 3,
      windowMs: config.windowMs ?? 150,
      sampleRate: config.sampleRate ?? 16000,
      cooldownMs: config.cooldownMs ?? 1000,
    };
  }

  /**
   * Set callback for when barge-in is detected
   */
  setOnBargeIn(callback: (event: BargeInEvent) => void): void {
    this.onBargeIn = callback;
  }

  /**
   * Notify detector that agent started speaking
   */
  agentStartedSpeaking(): void {
    this.isAgentSpeaking = true;
    this.consecutiveActiveFrames = 0;
  }

  /**
   * Notify detector that agent stopped speaking
   */
  agentStoppedSpeaking(): void {
    this.isAgentSpeaking = false;
    this.consecutiveActiveFrames = 0;
  }

  /**
   * Check if agent is currently speaking
   */
  isAgentCurrentlySpeaking(): boolean {
    return this.isAgentSpeaking;
  }

  /**
   * Process an incoming audio frame from the user's microphone.
   * Call this continuously with user audio to detect barge-in.
   *
   * @param audioData PCM 16-bit audio data
   * @returns true if barge-in detected, false otherwise
   */
  processAudioFrame(audioData: Int16Array | Uint8Array): boolean {
    // Only check for barge-in when agent is speaking
    if (!this.isAgentSpeaking) {
      this.consecutiveActiveFrames = 0;
      return false;
    }

    // Check cooldown
    const now = Date.now();
    if (now - this.lastBargeInTime < this.config.cooldownMs) {
      return false;
    }

    // Calculate energy level
    const energy = this.calculateEnergy(audioData);

    // Check if energy exceeds threshold
    if (energy > this.config.energyThreshold) {
      this.consecutiveActiveFrames++;

      // Barge-in detected when we have enough consecutive active frames
      if (this.consecutiveActiveFrames >= this.config.minFrames) {
        const event: BargeInEvent = {
          timestamp: now,
          energyLevel: energy,
          consecutiveFrames: this.consecutiveActiveFrames,
        };

        this.lastBargeInTime = now;
        this.consecutiveActiveFrames = 0;

        if (this.onBargeIn) {
          this.onBargeIn(event);
        }

        return true;
      }
    } else {
      // Reset if energy drops below threshold
      this.consecutiveActiveFrames = Math.max(0, this.consecutiveActiveFrames - 1);
    }

    return false;
  }

  /**
   * Calculate RMS energy of audio frame
   */
  private calculateEnergy(audioData: Int16Array | Uint8Array): number {
    let sumSquares = 0;

    if (audioData instanceof Int16Array) {
      // Already in 16-bit PCM format
      for (let i = 0; i < audioData.length; i++) {
        const sample = audioData[i] / 32768; // Normalize to -1 to 1
        sumSquares += sample * sample;
      }
    } else {
      // Convert from Uint8Array (assuming 16-bit little-endian PCM)
      const view = new DataView(audioData.buffer, audioData.byteOffset, audioData.byteLength);
      const samples = audioData.length / 2;
      for (let i = 0; i < samples; i++) {
        const sample = view.getInt16(i * 2, true) / 32768;
        sumSquares += sample * sample;
      }
    }

    const rms = Math.sqrt(sumSquares / (audioData.length / (audioData instanceof Int16Array ? 1 : 2)));
    return rms;
  }

  /**
   * Reset detector state
   */
  reset(): void {
    this.isAgentSpeaking = false;
    this.consecutiveActiveFrames = 0;
    this.lastBargeInTime = 0;
  }

  /**
   * Get current detector stats (for debugging)
   */
  getStats(): {
    isAgentSpeaking: boolean;
    consecutiveActiveFrames: number;
    timeSinceLastBargeIn: number;
  } {
    return {
      isAgentSpeaking: this.isAgentSpeaking,
      consecutiveActiveFrames: this.consecutiveActiveFrames,
      timeSinceLastBargeIn: Date.now() - this.lastBargeInTime,
    };
  }
}
