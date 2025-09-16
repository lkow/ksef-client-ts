/**
 * HTTP client utilities for KSeF API
 */

import { request } from 'node:https';
import { Agent } from 'node:https';
import type { HttpClientOptions } from '@/types/config.js';
import { KsefApiError, AuthenticationError, ValidationError } from '@/types/common.js';

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
  private readonly options: Required<HttpClientOptions>;

  constructor(options: HttpClientOptions = {}) {
    this.options = {
      timeout: options.timeout ?? 30000,
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      keepAlive: options.keepAlive ?? true,
      headers: options.headers ?? {},
      userAgent: options.userAgent ?? 'KSeF-TypeScript-Client/1.0.0'
    };

    this.agent = new Agent({
      keepAlive: this.options.keepAlive,
      maxSockets: 10,
      timeout: this.options.timeout
    });
  }

  async request<T = any>(requestOptions: HttpRequestOptions): Promise<HttpResponse<T>> {
    const url = new URL(requestOptions.url);
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= (requestOptions.maxRetries ?? this.options.maxRetries); attempt++) {
      try {
        return await this.executeRequest<T>(requestOptions, url);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        // Don't retry on authentication or validation errors
        if (error instanceof AuthenticationError || error instanceof ValidationError) {
          throw error;
        }

        // Don't retry on client errors (4xx) except 429
        if (error instanceof KsefApiError && error.statusCode && error.statusCode >= 400 && error.statusCode < 500 && error.statusCode !== 429) {
          throw error;
        }

        // If this was the last attempt, throw the error
        if (attempt === (requestOptions.maxRetries ?? this.options.maxRetries)) {
          throw error;
        }

        // Wait before retrying
        const delay = (requestOptions.retryDelay ?? this.options.retryDelay) * Math.pow(2, attempt - 1);
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
    const { status, data } = response;
    
    // Try to extract error message from response
    let message = `HTTP ${status}`;
    let code: string | undefined;
    
    if (typeof data === 'object' && data !== null) {
      const errorData = data as any;
      
      // Check common error message fields
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

    // Create appropriate error type based on status code
    if (status === 401) {
      throw new AuthenticationError(message || 'Unauthorized', { statusCode: status });
    } else if (status === 400 || status === 422) {
      const errorInfo: { statusCode: number; code?: string } = { statusCode: status };
      if (code) errorInfo.code = code;
      throw new ValidationError(message || 'Validation failed', errorInfo);
    } else {
      const errorInfo: { statusCode: number; code?: string } = { statusCode: status };
      if (code) errorInfo.code = code;
      throw new KsefApiError(message, errorInfo);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.agent.destroy();
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