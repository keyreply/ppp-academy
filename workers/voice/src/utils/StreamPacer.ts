/**
 * StreamPacer
 *
 * Helps pace the transmission of audio data to match real-time playback speed
 * while maintaining a small safety buffer. This prevents stuttering (buffer underrun)
 * while ensuring low latency for interruptions (buffer overflow).
 */
export class StreamPacer {
  private startTime: number = 0;
  private bytesSent: number = 0;
  private readonly bytesPerSecond: number;
  private readonly targetBufferMs: number;

  /**
   * @param sampleRate Audio sample rate (e.g., 16000 for 16kHz)
   * @param channels Number of channels (default 1)
   * @param bitsPerSample Bits per sample (default 16)
   * @param targetBufferMs Target safety buffer in milliseconds (default 200ms)
   */
  constructor({
    sampleRate = 16000,
    channels = 1,
    bitsPerSample = 16,
    targetBufferMs = 200,
  }: {
    sampleRate?: number;
    channels?: number;
    bitsPerSample?: number;
    targetBufferMs?: number;
  } = {}) {
    this.bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
    this.targetBufferMs = targetBufferMs;
  }

  /**
   * Call this when you start streaming a new utterance.
   */
  reset(): void {
    this.startTime = Date.now();
    this.bytesSent = 0;
  }

  /**
   * Calculates how long to wait before sending the next chunk to maintain the target buffer.
   * @param chunkLengthBytes Size of the chunk you are about to send
   * @returns Promise that resolves when it's safe to send the chunk
   */
  async pace(chunkLengthBytes: number): Promise<void> {
    if (this.bytesSent === 0) {
      this.startTime = Date.now();
    }

    this.bytesSent += chunkLengthBytes;

    const audioDurationMs = (this.bytesSent / this.bytesPerSecond) * 1000;
    const elapsedMs = Date.now() - this.startTime;
    const currentLeadMs = audioDurationMs - elapsedMs;

    // If we are ahead of the target buffer, wait
    if (currentLeadMs > this.targetBufferMs) {
      const waitTime = currentLeadMs - this.targetBufferMs;
      if (waitTime > 5) {
        // Only wait if it's significant
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    // If currentLeadMs < targetBufferMs, we return immediately (catch up)
  }

  /**
   * Get stats about the current pacing session
   */
  getStats(): { bytesSent: number; elapsedMs: number; audioDurationMs: number; leadMs: number } {
    const elapsedMs = Date.now() - this.startTime;
    const audioDurationMs = (this.bytesSent / this.bytesPerSecond) * 1000;
    return {
      bytesSent: this.bytesSent,
      elapsedMs,
      audioDurationMs,
      leadMs: audioDurationMs - elapsedMs,
    };
  }
}
