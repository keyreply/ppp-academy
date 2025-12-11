import { DurableObject } from "cloudflare:workers";

/**
 * RateLimiterDO - In-memory rate limiting Durable Object
 *
 * Features:
 * - Sliding window rate limiting
 * - Token bucket algorithm
 * - Concurrent request limiting
 * - Combined API rate limiting
 */
export class RateLimiterDO extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);

    // In-memory data structures
    this.slidingWindows = new Map(); // key -> [timestamps]
    this.tokenBuckets = new Map(); // key -> { tokens, lastRefill }
    this.locks = new Map(); // key -> { count, max }
    this.apiRateLimits = new Map(); // apiKeyId:endpoint -> counters

    // Cleanup interval
    this.setupCleanup();
  }

  /**
   * Setup periodic cleanup of expired data
   */
  setupCleanup() {
    this.ctx.storage.setAlarm(Date.now() + 60000); // Every minute
  }

  /**
   * Alarm handler for periodic cleanup
   */
  async alarm() {
    const now = Date.now();

    // Cleanup sliding windows
    for (const [key, timestamps] of this.slidingWindows.entries()) {
      // Keep only recent entries (last 24 hours)
      const recent = timestamps.filter(ts => now - ts < 24 * 60 * 60 * 1000);
      if (recent.length === 0) {
        this.slidingWindows.delete(key);
      } else {
        this.slidingWindows.set(key, recent);
      }
    }

    // Cleanup token buckets (remove inactive ones)
    for (const [key, bucket] of this.tokenBuckets.entries()) {
      if (now - bucket.lastRefill > 24 * 60 * 60 * 1000) {
        this.tokenBuckets.delete(key);
      }
    }

    // Schedule next cleanup
    this.ctx.storage.setAlarm(Date.now() + 60000);
  }

  /**
   * Handle incoming fetch requests
   */
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/rate-limit/check' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.checkRateLimit(body);
        return Response.json(result);
      }

      if (path === '/token-bucket/check' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.checkTokenBucket(body);
        return Response.json(result);
      }

      if (path === '/lock/acquire' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.acquireLock(body);
        return Response.json(result);
      }

      if (path === '/lock/release' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.releaseLock(body);
        return Response.json(result);
      }

      if (path === '/api-rate-limit/check' && request.method === 'POST') {
        const body = await request.json();
        const result = await this.checkAPIRateLimit(body);
        return Response.json(result);
      }

      if (path === '/stats' && request.method === 'GET') {
        return Response.json({
          slidingWindows: this.slidingWindows.size,
          tokenBuckets: this.tokenBuckets.size,
          locks: this.locks.size,
          apiRateLimits: this.apiRateLimits.size
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('RateLimiterDO error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  /**
   * Sliding window rate limiting
   * @param {Object} params
   * @param {string} params.key - Unique identifier for the resource
   * @param {number} params.limit - Maximum number of requests
   * @param {number} params.windowMs - Time window in milliseconds
   * @returns {Object} { allowed, remaining, resetAt }
   */
  async checkRateLimit({ key, limit, windowMs }) {
    const now = Date.now();
    const windowStart = now - windowMs;

    // Get or create timestamp array for this key
    let timestamps = this.slidingWindows.get(key) || [];

    // Remove timestamps outside the window
    timestamps = timestamps.filter(ts => ts > windowStart);

    // Check if limit is exceeded
    const allowed = timestamps.length < limit;

    if (allowed) {
      // Add current timestamp
      timestamps.push(now);
      this.slidingWindows.set(key, timestamps);
    }

    // Calculate when the oldest request will expire
    const oldestTimestamp = timestamps[0] || now;
    const resetAt = oldestTimestamp + windowMs;

    return {
      allowed,
      remaining: Math.max(0, limit - timestamps.length),
      resetAt,
      current: timestamps.length,
      limit
    };
  }

  /**
   * Token bucket rate limiting
   * @param {Object} params
   * @param {string} params.key - Unique identifier
   * @param {number} params.maxTokens - Maximum tokens in bucket
   * @param {number} params.refillRate - Tokens added per second
   * @param {number} params.tokensNeeded - Tokens needed for this request
   * @returns {Object} { allowed, tokensRemaining, retryAfter }
   */
  async checkTokenBucket({ key, maxTokens, refillRate, tokensNeeded = 1 }) {
    const now = Date.now();

    // Get or create bucket
    let bucket = this.tokenBuckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: maxTokens,
        lastRefill: now
      };
    } else {
      // Refill tokens based on time elapsed
      const secondsElapsed = (now - bucket.lastRefill) / 1000;
      const tokensToAdd = secondsElapsed * refillRate;
      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if enough tokens available
    const allowed = bucket.tokens >= tokensNeeded;

    if (allowed) {
      bucket.tokens -= tokensNeeded;
    }

    // Save bucket state
    this.tokenBuckets.set(key, bucket);

    // Calculate retry after if not allowed
    let retryAfter = 0;
    if (!allowed) {
      const tokensShort = tokensNeeded - bucket.tokens;
      retryAfter = Math.ceil(tokensShort / refillRate);
    }

    return {
      allowed,
      tokensRemaining: Math.floor(bucket.tokens),
      maxTokens,
      retryAfter
    };
  }

  /**
   * Acquire a concurrent request lock
   * @param {Object} params
   * @param {string} params.key - Resource key
   * @param {number} params.maxConcurrent - Maximum concurrent requests
   * @returns {Object} { acquired, current, max }
   */
  async acquireLock({ key, maxConcurrent }) {
    let lock = this.locks.get(key);

    if (!lock) {
      lock = { count: 0, max: maxConcurrent };
    }

    const acquired = lock.count < maxConcurrent;

    if (acquired) {
      lock.count++;
      this.locks.set(key, lock);
    }

    return {
      acquired,
      current: lock.count,
      max: maxConcurrent
    };
  }

  /**
   * Release a concurrent request lock
   * @param {Object} params
   * @param {string} params.key - Resource key
   * @returns {Object} { released, current }
   */
  async releaseLock({ key }) {
    const lock = this.locks.get(key);

    if (!lock || lock.count === 0) {
      return { released: false, current: 0, error: 'No lock to release' };
    }

    lock.count--;

    if (lock.count === 0) {
      this.locks.delete(key);
    } else {
      this.locks.set(key, lock);
    }

    return {
      released: true,
      current: lock.count
    };
  }

  /**
   * Combined API rate limiting with multiple checks
   * @param {Object} params
   * @param {string} params.apiKeyId - API key identifier
   * @param {string} params.endpoint - Endpoint path
   * @param {Object} params.config - Rate limit configuration
   * @returns {Object} { allowed, limits: [] }
   */
  async checkAPIRateLimit({ apiKeyId, endpoint, config }) {
    const checks = [];

    // Per-second rate limit
    if (config.perSecond) {
      const result = await this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:second`,
        limit: config.perSecond,
        windowMs: 1000
      });
      checks.push({
        name: 'per-second',
        ...result
      });
    }

    // Per-minute rate limit
    if (config.perMinute) {
      const result = await this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:minute`,
        limit: config.perMinute,
        windowMs: 60000
      });
      checks.push({
        name: 'per-minute',
        ...result
      });
    }

    // Per-hour rate limit
    if (config.perHour) {
      const result = await this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:hour`,
        limit: config.perHour,
        windowMs: 3600000
      });
      checks.push({
        name: 'per-hour',
        ...result
      });
    }

    // Per-day rate limit
    if (config.perDay) {
      const result = await this.checkRateLimit({
        key: `${apiKeyId}:${endpoint}:day`,
        limit: config.perDay,
        windowMs: 86400000
      });
      checks.push({
        name: 'per-day',
        ...result
      });
    }

    // Token bucket for burst control
    if (config.tokenBucket) {
      const result = await this.checkTokenBucket({
        key: `${apiKeyId}:${endpoint}:tokens`,
        maxTokens: config.tokenBucket.maxTokens,
        refillRate: config.tokenBucket.refillRate,
        tokensNeeded: config.tokenBucket.tokensNeeded || 1
      });
      checks.push({
        name: 'token-bucket',
        ...result
      });
    }

    // Concurrent requests limit
    if (config.maxConcurrent) {
      const result = await this.acquireLock({
        key: `${apiKeyId}:${endpoint}:concurrent`,
        maxConcurrent: config.maxConcurrent
      });
      checks.push({
        name: 'concurrent',
        ...result
      });
    }

    // Overall allowed if all checks pass
    const allowed = checks.every(check =>
      check.allowed !== false && check.acquired !== false
    );

    // Find the most restrictive limit
    const mostRestrictive = checks.reduce((min, check) => {
      if (check.remaining !== undefined &&
          (min === null || check.remaining < min.remaining)) {
        return check;
      }
      return min;
    }, null);

    return {
      allowed,
      limits: checks,
      mostRestrictive: mostRestrictive?.name,
      remaining: mostRestrictive?.remaining,
      resetAt: mostRestrictive?.resetAt
    };
  }
}

