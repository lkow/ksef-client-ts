import { vi, type Mock } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import type { HttpRequestOptions, HttpResponse } from '../../src/utils/http.js';

export interface MockHttpClient {
  request: Mock<[HttpRequestOptions], Promise<HttpResponse<any>>>;
  getRequests: () => HttpRequestOptions[];
  getLastRequest: () => HttpRequestOptions | undefined;
  mockResponse: <T>(data: T, options?: Partial<HttpResponse<T>>) => void;
  mockResponseOnce: <T>(data: T, options?: Partial<HttpResponse<T>>) => void;
  mockError: (error: Error) => void;
  reset: () => void;
}

export function createMockHttpClient(): MockHttpClient {
  const requests: HttpRequestOptions[] = [];
  let defaultResponse: HttpResponse<any> = {
    status: 200,
    statusText: 'OK',
    headers: {},
    data: {}
  };
  const responseQueue: HttpResponse<any>[] = [];

  const requestMock = vi.fn(async (options: HttpRequestOptions): Promise<HttpResponse<any>> => {
    requests.push(options);
    if (responseQueue.length > 0) {
      return responseQueue.shift()!;
    }
    return defaultResponse;
  });

  return {
    request: requestMock,

    getRequests: () => [...requests],

    getLastRequest: () => requests[requests.length - 1],

    mockResponse: <T>(data: T, options?: Partial<HttpResponse<T>>) => {
      defaultResponse = {
        status: options?.status ?? 200,
        statusText: options?.statusText ?? 'OK',
        headers: options?.headers ?? {},
        data
      };
    },

    mockResponseOnce: <T>(data: T, options?: Partial<HttpResponse<T>>) => {
      const response: HttpResponse<T> = {
        status: options?.status ?? 200,
        statusText: options?.statusText ?? 'OK',
        headers: options?.headers ?? {},
        data
      };
      responseQueue.push(response);
    },

    mockError: (error: Error) => {
      requestMock.mockRejectedValueOnce(error);
    },

    reset: () => {
      requests.length = 0;
      responseQueue.length = 0;
      defaultResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: {}
      };
      requestMock.mockClear();
    }
  };
}

// Generate a test RSA key pair once for all tests
const testKeyPair = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

/**
 * Creates a mock SecurityService for testing services that depend on it
 */
export function createMockSecurityService() {
  return {
    getPublicKey: vi.fn().mockResolvedValue(testKeyPair.publicKey)
  };
}

/**
 * Get the test key pair for decryption tests
 */
export function getTestKeyPair() {
  return testKeyPair;
}

