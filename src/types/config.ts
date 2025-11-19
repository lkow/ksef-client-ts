/**
 * Configuration types for KSeF client
 */

import type { AuthCredentials } from './auth.js';
import type { KsefEnvironmentConfig, ContextIdentifier } from './common.js';
import type { RateLimitConfig } from './limits.js';

export interface KsefClientConfig {
  /** KSeF environment configuration */
  environment: KsefEnvironmentConfig | 'test' | 'prod';
  
  /** Authentication credentials (certificate or token) - optional for external signing */
  credentials?: AuthCredentials;
  
  /** Taxpayer identifier (NIP or PESEL) */
  contextIdentifier: ContextIdentifier;
  
  /** HTTP client options */
  httpOptions?: HttpClientOptions;
  
  /** Debug logging enabled */
  debug?: boolean;
  
  /** Session management options */
  sessionOptions?: SessionOptions;
}

export interface ExternalSigningConfig {
  /** KSeF environment configuration */
  environment: KsefEnvironmentConfig | 'test' | 'prod';
  
  /** Taxpayer identifier (NIP or PESEL) */
  contextIdentifier: ContextIdentifier;
  
  /** HTTP client options */
  httpOptions?: HttpClientOptions;
  
  /** Debug logging enabled */
  debug?: boolean;
  
  /** Session management options */
  sessionOptions?: SessionOptions;
}

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

export interface SessionOptions {
  /** Automatically refresh expired sessions (default: true) */
  autoRefresh?: boolean;
  
  /** Session poll interval for status checks in milliseconds (default: 2000) */
  pollInterval?: number;
  
  /** Maximum polling timeout in milliseconds (default: 300000) */
  maxPollTimeout?: number;
  
  /** Maximum concurrent operations (default: 10) */
  maxConcurrentOperations?: number;
}

export interface OperationOptions {
  /** Maximum time to wait for operation completion in milliseconds */
  timeout?: number;
  
  /** Polling interval for status checks in milliseconds */
  pollInterval?: number;
  
  /** Whether to automatically retry on transient failures */
  autoRetry?: boolean;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
}

export interface InvoiceSubmissionOptions extends OperationOptions {
  /** Whether to automatically retrieve UPO after successful submission */
  retrieveUpo?: boolean;
  
  /** Batch size for batch submissions */
  batchSize?: number;
}

export interface QueryOptions {
  /** Page size for paginated results (default: 100) */
  pageSize?: number;
  
  /** Page offset for pagination (default: 0) */
  pageOffset?: number;
  
  /** Maximum number of pages to fetch (default: unlimited) */
  maxPages?: number;
} 