/**
 * HTTP client utilities for KSeF API
 */

import { request } from 'node:https';
import { Agent } from 'node:https';
import type { HttpClientOptions } from '@/types/config.js';
import { KsefApiError, AuthenticationError, ValidationError } from '@/types/common.js';
import { RateLimiter, createRateLimiter } from './rate-limiter.js';
import type { RateLimitError } from '@/types/limits.js';

export interface HttpRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface HttpResponse<T = any> {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
}

export class HttpClient {
  private readonly agent: Agent;
  private readonly options: Required<Omit<HttpClientOptions, 'rateLimitConfig'>>;
  private readonly rateLimiter?: RateLimiter;

  constructor(options: HttpClientOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      keepAlive: options.keepAlive ?? true,
      headers: options.headers ?? {},
      userAgent: options.userAgent ?? 'KSeF-TypeScript-Client/1.0.0'
    };

    // Initialize rate limiter if configured
    if (options.rateLimitConfig) {
      this.rateLimiter = createRateLimiter(options.rateLimitConfig, false);
    }

    this.agent = new Agent({
      keepAlive: this.options.keepAlive,
      maxSockets: options.rateLimitConfig?.maxConcurrentSessions ?? 10,
      timeout: this.options.timeout
    });
  }

  async request<T = any>(requestOptions: HttpRequestOptions): Promise<HttpResponse<T>> {
    const url = new URL(requestOptions.url);
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= (requestOptions.maxRetries ?? this.options.maxRetries); attempt++) {
      try {
        // Check rate limit before making request
        if (this.rateLimiter) {
          await this.rateLimiter.acquireToken();
        }

        return await this.executeRequest<T>(requestOptions, url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Handle rate limit errors from rate limiter
        if (this.isRateLimitError(error)) {
          const rateLimitError = error as RateLimitError;
          await this.sleep(rateLimitError.retryAfterMs);
          continue; // Retry immediately after waiting
        }

        // Don't retry on authentication or validation errors
        if (error instanceof AuthenticationError || error instanceof ValidationError) {
          throw error;
        }

        // Handle 429 errors from server with Retry-After
        if (error instanceof KsefApiError && error.statusCode === 429) {
          const retryAfter = this.parseRetryAfter(error) || (requestOptions.retryDelay ?? this.options.retryDelay) * Math.pow(2, attempt);
          await this.sleep(retryAfter);
          continue; // Retry after waiting
        }

        // Don't retry on other client errors (4xx)
        if (error instanceof KsefApiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === (requestOptions.maxRetries ?? this.options.maxRetries)) {
          throw error;
        }

        // Wait before retrying with exponential backoff and jitter
        const baseDelay = (requestOptions.retryDelay ?? this.options.retryDelay) * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000; // Add up to 1 second of jitter
        const delay = baseDelay + jitter;
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  private async executeRequest<T>(requestOptions: HttpRequestOptions, url: URL): Promise<HttpResponse<T>> {
    return new Promise((resolve, reject) => {
      const headers: Record<string, string> = {
        'User-Agent': this.options.userAgent,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...this.options.headers,
        ...requestOptions.headers
      };

      if (requestOptions.body) {
        headers['Content-Length'] = Buffer.byteLength(requestOptions.body).toString();
      }

      const requestConfig = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: requestOptions.method,
        headers,
        agent: this.agent,
        timeout: requestOptions.timeout ?? this.options.timeout
      };

      const req = request(requestConfig, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const responseHeaders: Record<string, string> = {};
            Object.entries(res.headers).forEach(([key, value]) => {
              if (typeof value === 'string') {
                responseHeaders[key] = value;
              } else if (Array.isArray(value)) {
                responseHeaders[key] = value.join(', ');
              }
            });

            let parsedData: T;
            try {
              parsedData = data ? JSON.parse(data) : null;
            } catch {
              // If JSON parsing fails, return raw data
              parsedData = data as unknown as T;
            }

            const response: HttpResponse<T> = {
              status: res.statusCode || 0,
              statusText: res.statusMessage || '',
              headers: responseHeaders,
              data: parsedData
            };

            if (res.statusCode && res.statusCode >= 400) {
              this.handleErrorResponse(response);
            } else {
              resolve(response);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', (error) => {
        reject(new KsefApiError(`Network error: ${error.message}`));
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new KsefApiError('Request timeout'));
      });

      if (requestOptions.body) {
        req.write(requestOptions.body);
      }

      req.end();
    });
  }

  private handleErrorResponse<T>(response: HttpResponse<T>): never {
    const { status, data, headers } = response;
    
    // Try to extract error message from response
    let message = `HTTP ${status}`;
    let code: string | undefined;
    
    if (typeof data === 'object' && data !== null) {
      const errorData = data as any;
      
      // KSeF error format: { status: { code, description, details } }
      if ('status' in errorData && typeof errorData.status === 'object') {
        const statusObj = errorData.status;
        if ('description' in statusObj) {
          message = statusObj.description;
        }
        if ('details' in statusObj && Array.isArray(statusObj.details) && statusObj.details.length > 0) {
          message += ': ' + statusObj.details.join(', ');
        }
        if ('code' in statusObj) {
          code = statusObj.code.toString();
        }
      } else {
        // Fallback to common error message fields
        if ('message' in errorData) {
          message = errorData.message;
        } else if ('error' in errorData) {
          message = errorData.error;
        } else if ('description' in errorData) {
          message = errorData.description;
        } else if ('processingDescription' in errorData) {
          message = errorData.processingDescription;
        }
        
        if ('code' in errorData) {
          code = errorData.code;
        } else if ('processingCode' in errorData) {
          code = errorData.processingCode.toString();
        }
      }
    }

    // Create appropriate error type based on status code
    if (status === 401) {
      throw new AuthenticationError(message || 'Unauthorized', { statusCode: status });
    } else if (status === 400 || status === 422) {
      const errorInfo: { statusCode: number; code?: string } = { 
        statusCode: status
      };
      if (code) errorInfo.code = code;
      throw new ValidationError(message || 'Validation failed', errorInfo);
    } else {
      const errorInfo: { statusCode: number; code?: string } = { 
        statusCode: status
      };
      if (code) errorInfo.code = code;
      const error = new KsefApiError(message, errorInfo);
      // Store headers temporarily for Retry-After parsing
      (error as any).headers = headers;
      throw error;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private isRateLimitError(error: unknown): error is RateLimitError {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'RATE_LIMIT_EXCEEDED';
  }

  /**
   * Parse Retry-After header from KSeF API 429 response
   * Per limity-api.md: Returns time in seconds
   * 
   * @param error KsefApiError with response headers
   * @returns Milliseconds to wait, or undefined if not found
   */
  private parseRetryAfter(error: KsefApiError): number | undefined {
    // Access headers from error
    const errorInfo = error as any;
    const headers = errorInfo.headers as Record<string, string> | undefined;
    
    if (!headers) {
      return undefined;
    }

    // Check for Retry-After header (case-insensitive)
    const retryAfterHeader = Object.keys(headers).find(
      key => key.toLowerCase() === 'retry-after'
    );

    if (!retryAfterHeader) {
      return undefined;
    }

    const value = headers[retryAfterHeader];
    
    if (!value) {
      return undefined;
    }
    
    // Retry-After can be either:
    // 1. Delay in seconds (e.g., "30")
    // 2. HTTP date (e.g., "Wed, 21 Oct 2025 07:28:00 GMT")
    
    // Try parsing as number (seconds)
    const seconds = parseInt(value, 10);
    if (!isNaN(seconds) && seconds > 0) {
      return seconds * 1000; // Convert to milliseconds
    }

    // Try parsing as HTTP date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const now = Date.now();
      const retryTime = date.getTime();
      const delay = retryTime - now;
      return delay > 0 ? delay : undefined;
    }

    return undefined;
  }

  /**
   * Get rate limiter instance
   */
  getRateLimiter(): RateLimiter | undefined {
    return this.rateLimiter;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.agent.destroy();
    if (this.rateLimiter) {
      this.rateLimiter.reset();
    }
  }
}

/**
 * Create a default HTTP client instance optimized for Lambda
 */
export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  return new HttpClient({
    keepAlive: true,
    timeout: 30000,
    maxRetries: 3,
    retryDelay: 1000,
    ...options
  });
}

/**
 * Utility to build query string from parameters
 */
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(item => searchParams.append(key, item.toString()));
      } else {
        searchParams.set(key, value.toString());
      }
    }
  });
  
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * Create request body with proper JSON serialization
 */
export function createRequestBody(data: any): string {
  if (typeof data === 'string') {
    return data;
  }
  
  return JSON.stringify(data, null, 0);
} 