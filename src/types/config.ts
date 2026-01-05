import type { RateLimitConfig } from './limits.js';

/**
 * Shared HTTP client configuration used by the API v2 services.
 */

export interface HttpClientOptions {
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  
  /** Maximum number of retries for failed requests (default: 3) */
  maxRetries?: number;
  
  /** Base delay for retry backoff in milliseconds (default: 1000) */
  retryDelay?: number;
  
  /** Keep-alive for HTTP connections (default: true) */
  keepAlive?: boolean;
  
  /** Additional HTTP headers */
  headers?: Record<string, string>;
  
  /** Custom User-Agent string */
  userAgent?: string;
  
  /** Rate limiting configuration */
  rateLimitConfig?: RateLimitConfig;
}
