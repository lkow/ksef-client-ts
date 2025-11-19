/**
 * Rate limiting utility for KSeF API operations
 * Implements token bucket algorithm for rate limiting
 */

import type { RateLimitConfig, RateLimitStatus } from '@/types/limits.js';
import { DEFAULT_RATE_LIMITS, RateLimitError } from '@/types/limits.js';
import { Logger } from './logger.js';

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  windowStart: number;
  requestCount: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private secondBucket: TokenBucket;
  private minuteBucket: TokenBucket;
  private hourBucket: TokenBucket;
  private sessionCount: number;
  private logger: Logger;

  constructor(config: Partial<RateLimitConfig> = {}, debug = false) {
    this.config = { ...DEFAULT_RATE_LIMITS, ...config };
    this.logger = new Logger({
      debug,
      prefix: '[RateLimiter]'
    });

    // Initialize token buckets
    const now = Date.now();
    this.secondBucket = {
      tokens: this.config.requestsPerSecond,
      lastRefill: now,
      windowStart: now,
      requestCount: 0
    };

    this.minuteBucket = {
      tokens: this.config.requestsPerMinute,
      lastRefill: now,
      windowStart: now,
      requestCount: 0
    };

    this.hourBucket = {
      tokens: this.config.requestsPerHour,
      lastRefill: now,
      windowStart: now,
      requestCount: 0
    };

    this.sessionCount = 0;

    this.logger.debug('Rate limiter initialized', {
      requestsPerSecond: this.config.requestsPerSecond,
      requestsPerMinute: this.config.requestsPerMinute,
      requestsPerHour: this.config.requestsPerHour,
      maxConcurrentSessions: this.config.maxConcurrentSessions
    });
  }

  /**
   * Check if a request can be made within rate limits
   * Per KSeF docs: All three limits (req/s, req/min, req/h) apply in parallel
   * Blocking occurs on first exceeded limit
   */
  async acquireToken(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const now = Date.now();
    
    // Refill buckets if needed
    this.refillBuckets(now);

    // Check second limit (most restrictive short-term)
    if (this.secondBucket.tokens < 1) {
      const waitTime = this.getWaitTime(this.secondBucket, 1000);
      throw this.createRateLimitError(waitTime, 'second');
    }

    // Check minute limit
    if (this.minuteBucket.tokens < 1) {
      const waitTime = this.getWaitTime(this.minuteBucket, 60000);
      throw this.createRateLimitError(waitTime, 'minute');
    }

    // Check hour limit
    if (this.hourBucket.tokens < 1) {
      const waitTime = this.getWaitTime(this.hourBucket, 3600000);
      throw this.createRateLimitError(waitTime, 'hour');
    }

    // Consume tokens from all buckets
    this.secondBucket.tokens--;
    this.secondBucket.requestCount++;
    this.minuteBucket.tokens--;
    this.minuteBucket.requestCount++;
    this.hourBucket.tokens--;
    this.hourBucket.requestCount++;

    this.logger.debug('Token acquired', {
      secondTokens: this.secondBucket.tokens,
      minuteTokens: this.minuteBucket.tokens,
      hourTokens: this.hourBucket.tokens
    });
  }

  /**
   * Acquire a session slot
   */
  acquireSession(): void {
    if (!this.config.enabled) {
      return;
    }

    if (this.sessionCount >= this.config.maxConcurrentSessions) {
      throw new Error(
        `Maximum concurrent sessions (${this.config.maxConcurrentSessions}) exceeded. ` +
        `Current sessions: ${this.sessionCount}`
      );
    }

    this.sessionCount++;
    this.logger.debug(`Session acquired (${this.sessionCount}/${this.config.maxConcurrentSessions})`);
  }

  /**
   * Release a session slot
   */
  releaseSession(): void {
    if (this.sessionCount > 0) {
      this.sessionCount--;
      this.logger.debug(`Session released (${this.sessionCount}/${this.config.maxConcurrentSessions})`);
    }
  }

  /**
   * Get current rate limit status
   */
  getStatus(): RateLimitStatus {
    const now = Date.now();
    this.refillBuckets(now);

    const minuteResetAt = this.minuteBucket.windowStart + 60000;
    const hourResetAt = this.hourBucket.windowStart + 3600000;
    
    const isAtMinuteLimit = this.minuteBucket.tokens < 1;
    const isAtHourLimit = this.hourBucket.tokens < 1;

    const status: RateLimitStatus = {
      currentRequests: Math.max(
        this.minuteBucket.requestCount,
        this.hourBucket.requestCount
      ),
      maxRequests: this.config.requestsPerMinute,
      windowResetAt: Math.min(minuteResetAt, hourResetAt),
      isAtLimit: isAtMinuteLimit || isAtHourLimit
    };
    
    if (isAtMinuteLimit) {
      status.retryAfterMs = minuteResetAt - now;
    } else if (isAtHourLimit) {
      status.retryAfterMs = hourResetAt - now;
    }
    
    return status;
  }

  /**
   * Wait for rate limit to reset if needed
   */
  async waitIfNeeded(): Promise<void> {
    const status = this.getStatus();
    if (status.isAtLimit && status.retryAfterMs) {
      this.logger.debug(`Rate limit reached, waiting ${status.retryAfterMs}ms`);
      await this.sleep(status.retryAfterMs);
    }
  }

  /**
   * Validate batch size
   */
  validateBatchSize(batchSize: number): void {
    if (!this.config.enabled) {
      return;
    }

    if (batchSize > this.config.maxBatchSize) {
      throw new Error(
        `Batch size (${batchSize}) exceeds maximum allowed (${this.config.maxBatchSize}). ` +
        `Split into smaller batches.`
      );
    }
  }

  /**
   * Reset rate limiter state
   */
  reset(): void {
    const now = Date.now();
    this.secondBucket = {
      tokens: this.config.requestsPerSecond,
      lastRefill: now,
      windowStart: now,
      requestCount: 0
    };
    this.minuteBucket = {
      tokens: this.config.requestsPerMinute,
      lastRefill: now,
      windowStart: now,
      requestCount: 0
    };
    this.hourBucket = {
      tokens: this.config.requestsPerHour,
      lastRefill: now,
      windowStart: now,
      requestCount: 0
    };
    this.sessionCount = 0;
    this.logger.debug('Rate limiter reset');
  }

  // Private helper methods

  private refillBuckets(now: number): void {
    // Refill second bucket (last 1 second)
    const secondElapsed = now - this.secondBucket.windowStart;
    if (secondElapsed >= 1000) {
      this.secondBucket.tokens = this.config.requestsPerSecond;
      this.secondBucket.windowStart = now;
      this.secondBucket.requestCount = 0;
      this.logger.debug('Second bucket refilled');
    }

    // Refill minute bucket (last 60 seconds)
    const minuteElapsed = now - this.minuteBucket.windowStart;
    if (minuteElapsed >= 60000) {
      this.minuteBucket.tokens = this.config.requestsPerMinute;
      this.minuteBucket.windowStart = now;
      this.minuteBucket.requestCount = 0;
      this.logger.debug('Minute bucket refilled');
    }

    // Refill hour bucket (last 60 minutes)
    const hourElapsed = now - this.hourBucket.windowStart;
    if (hourElapsed >= 3600000) {
      this.hourBucket.tokens = this.config.requestsPerHour;
      this.hourBucket.windowStart = now;
      this.hourBucket.requestCount = 0;
      this.logger.debug('Hour bucket refilled');
    }
  }

  private getWaitTime(bucket: TokenBucket, windowDuration: number): number {
    const now = Date.now();
    const elapsed = now - bucket.windowStart;
    return Math.max(0, windowDuration - elapsed);
  }

  private createRateLimitError(retryAfterMs: number, window: 'second' | 'minute' | 'hour'): RateLimitError {
    const status = this.getStatus();
    return new RateLimitError(
      `Rate limit exceeded for ${window} window. Retry after ${retryAfterMs}ms`,
      retryAfterMs,
      status
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current session count
   */
  getSessionCount(): number {
    return this.sessionCount;
  }

  /**
   * Get configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

/**
 * Update rate limiter config at runtime
 * Useful for switching between endpoint-specific limits
 */
export function updateRateLimiter(limiter: RateLimiter, config: Partial<RateLimitConfig>): void {
  const currentConfig = limiter.getConfig();
  const newLimiter = new RateLimiter({ ...currentConfig, ...config });
  // Copy internal state
  Object.assign(limiter, newLimiter);
}

/**
 * Create a rate limiter with default configuration
 */
export function createRateLimiter(config?: RateLimitConfig, debug = false): RateLimiter {
  return new RateLimiter(config, debug);
}

