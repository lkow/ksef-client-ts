/**
 * KSeF API rate limiting and constraint types
 * Based on: https://github.com/CIRFMF/ksef-docs/blob/main/limity/limity-api.md
 * Updated: 2025-01-29 (per documentation dated 12.09.2025)
 * 
 * IMPORTANT NOTES:
 * - Limits are calculated per (context + IP address) pair
 * - Context = ContextIdentifier (Nip, InternalId, NipVatUe)  
 * - Uses sliding/rolling window model (not fixed windows)
 * - In TEST environment, limits are DISABLED and not currently planned
 * - In PROD, blocking is dynamic based on violation frequency
 * - Retry-After header indicates seconds to wait after 429 response
 */

/**
 * Rate limit configuration for KSeF API operations
 */
export interface RateLimitConfig {
  /** Enable rate limiting (should be false for test, true for prod) */
  enabled: boolean;
  
  /** 
   * Maximum requests per second (sliding window: last 1 second)
   * Different per endpoint
   */
  requestsPerSecond: number;
  
  /** 
   * Maximum requests per minute (sliding window: last 60 seconds)
   * Different per endpoint
   */
  requestsPerMinute: number;
  
  /** 
   * Maximum requests per hour (sliding window: last 60 minutes)
   * Different per endpoint
   */
  requestsPerHour: number;
  
  /** 
   * Maximum concurrent sessions per NIP context (not per client instance)
   * Default: 5 sessions per NIP
   */
  maxConcurrentSessions: number;
  
  /** 
   * Maximum batch size for invoice submissions
   * Default: 100 invoices per batch
   */
  maxBatchSize: number;
  
  /** Burst allowance - extra tokens available initially */
  burstAllowance: number;
  
  /** Custom retry delay base for rate limit errors (ms) */
  retryDelayMs: number;
}

/**
 * Rate limits for a specific endpoint
 */
export interface EndpointRateLimit {
  /** Requests per second (last 1 second) */
  requestsPerSecond: number;
  /** Requests per minute (last 60 seconds) */
  requestsPerMinute: number;
  /** Requests per hour (last 60 minutes) */
  requestsPerHour: number;
}

/**
 * KSeF API endpoint-specific rate limits
 * Per official documentation (as of 12.09.2025)
 * https://github.com/CIRFMF/ksef-docs/blob/main/limity/limity-api.md
 * 
 * Note: Limits apply per (context + IP address) pair
 */
export const KSEF_ENDPOINT_LIMITS: Record<string, EndpointRateLimit> = {
  // Invoice Retrieval
  'GET /invoices/ksef/*': { 
    requestsPerSecond: 8, 
    requestsPerMinute: 16, 
    requestsPerHour: 64 
  },
  'POST /invoices/query/metadata': { 
    requestsPerSecond: 8, 
    requestsPerMinute: 16, 
    requestsPerHour: 20 
  },
  'POST /invoices/exports': { 
    requestsPerSecond: 4, 
    requestsPerMinute: 8, 
    requestsPerHour: 20 
  },
  
  // Batch Session
  'POST /sessions/batch': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 20, 
    requestsPerHour: 120 
  },
  'POST /sessions/batch/*/close': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 20, 
    requestsPerHour: 120 
  },
  // Note: Uploading batch parts (PUT /sessions/batch/*/parts/*) has NO limits
  
  // Interactive Session
  'POST /sessions/online': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 30, 
    requestsPerHour: 120 
  },
  'POST /sessions/online/*/invoices': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 30, 
    requestsPerHour: 180 
  },
  'POST /sessions/online/*/close': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 30, 
    requestsPerHour: 120 
  },
  
  // Session Status
  'GET /sessions/*/invoices/*': { 
    requestsPerSecond: 30, 
    requestsPerMinute: 120, 
    requestsPerHour: 720 
  },
  'GET /sessions': { 
    requestsPerSecond: 5, 
    requestsPerMinute: 10, 
    requestsPerHour: 60 
  },
  'GET /sessions/*/invoices': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 20, 
    requestsPerHour: 200 
  },
  'GET /sessions/*/invoices/failed': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 20, 
    requestsPerHour: 200 
  },
  'GET /sessions/*': { 
    requestsPerSecond: 10, 
    requestsPerMinute: 120, 
    requestsPerHour: 720 
  },
};

/**
 * Default rate limits based on most restrictive endpoint
 * Use for general API calls when specific endpoint is unknown
 * 
 * NOTE: These are based on POST /invoices/exports (most restrictive)
 */
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  enabled: false, // Disabled by default (test env), enable explicitly in prod
  requestsPerSecond: 4, // Most restrictive (POST /invoices/exports)
  requestsPerMinute: 8, // Most restrictive
  requestsPerHour: 20, // Most restrictive
  maxConcurrentSessions: 5, // Per NIP context (official limit)
  maxBatchSize: 100, // Per official documentation
  burstAllowance: 2, // Allow small burst
  retryDelayMs: 1000 // Base delay for exponential backoff
};

/**
 * Conservative rate limits for production
 * Leaves 25% headroom for burst scenarios and multiple parallel processes
 * Recommended for applications with unpredictable traffic patterns
 */
export const CONSERVATIVE_RATE_LIMITS: RateLimitConfig = {
  enabled: true,
  requestsPerSecond: 3, // 75% of most restrictive
  requestsPerMinute: 6, // 75% of most restrictive
  requestsPerHour: 15, // 75% of most restrictive
  maxConcurrentSessions: 3, // 60% of limit (allows 2 sessions headroom)
  maxBatchSize: 75, // 75% of limit
  burstAllowance: 1,
  retryDelayMs: 1000
};

/**
 * Aggressive rate limits for high-volume production
 * Uses full limits with minimal headroom
 * Only use when you control all traffic to the API for this context+IP
 */
export const AGGRESSIVE_RATE_LIMITS: RateLimitConfig = {
  enabled: true,
  requestsPerSecond: 8, // Highest safe default (invoice retrieval)
  requestsPerMinute: 16, // Highest safe default
  requestsPerHour: 64, // Highest safe default (GET /invoices/ksef/*)
  maxConcurrentSessions: 5, // Full limit
  maxBatchSize: 100, // Full limit
  burstAllowance: 3, // Allow moderate burst
  retryDelayMs: 500
};

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  /** Current number of requests in the window */
  currentRequests: number;
  
  /** Maximum requests allowed in the window */
  maxRequests: number;
  
  /** When the current window resets (timestamp) */
  windowResetAt: number;
  
  /** Whether currently at the limit */
  isAtLimit: boolean;
  
  /** Recommended wait time before next request (ms) */
  retryAfterMs?: number;
}

/**
 * Rate limit error class
 * Thrown when internal rate limiter blocks a request
 */
export class RateLimitError extends Error {
  code: 'RATE_LIMIT_EXCEEDED' = 'RATE_LIMIT_EXCEEDED';
  retryAfterMs: number;
  status: RateLimitStatus;
  
  constructor(message: string, retryAfterMs: number, status?: RateLimitStatus) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
    this.status = status || {
      currentRequests: 0,
      maxRequests: 0,
      windowResetAt: Date.now(),
      isAtLimit: true
    };
  }
}

/**
 * API constraint types
 */
export enum ApiConstraintType {
  /** Concurrent session limit */
  CONCURRENT_SESSIONS = 'CONCURRENT_SESSIONS',
  
  /** Request rate limit */
  REQUEST_RATE = 'REQUEST_RATE',
  
  /** Batch size limit */
  BATCH_SIZE = 'BATCH_SIZE',
  
  /** Token usage limit */
  TOKEN_USAGE = 'TOKEN_USAGE'
}

/**
 * API constraint violation
 */
export interface ConstraintViolation {
  /** Type of constraint violated */
  type: ApiConstraintType;
  
  /** Current value */
  currentValue: number;
  
  /** Maximum allowed value */
  maxValue: number;
  
  /** Violation message */
  message: string;
}

/**
 * Get rate limits for a specific endpoint
 * Falls back to DEFAULT_RATE_LIMITS if endpoint not found
 */
export function getRateLimitsForEndpoint(
  method: string,
  path: string,
  baseConfig: RateLimitConfig = DEFAULT_RATE_LIMITS
): RateLimitConfig {
  // Normalize path to match patterns (replace IDs with *)
  const normalizedPath = path.replace(/\/[0-9a-zA-Z-]+/g, '/*');
  const key = `${method} ${normalizedPath}`;
  
  const endpointLimits = KSEF_ENDPOINT_LIMITS[key];
  
  if (endpointLimits) {
    return {
      ...baseConfig,
      requestsPerSecond: endpointLimits.requestsPerSecond,
      requestsPerMinute: endpointLimits.requestsPerMinute,
      requestsPerHour: endpointLimits.requestsPerHour
    };
  }
  
  return baseConfig;
}
