import { describe, it, expect, vi } from 'vitest';
import { HttpClient, type HttpRequestOptions, type HttpResponse } from '../../src/utils/http.js';
import { AuthenticationError } from '../../src/types/common.js';
import type { AuthManager } from '../../src/api2/auth-manager.js';

function createStubAuthManager(overrides: Partial<AuthManager> = {}): AuthManager {
  let accessToken = 'managed-access-token';
  let refreshToken = 'managed-refresh-token';

  return {
    getAccessToken: () => accessToken,
    setAccessToken: (token) => {
      accessToken = token;
    },
    getRefreshToken: () => refreshToken,
    setRefreshToken: (token) => {
      refreshToken = token;
    },
    onUnauthorized: async () => null,
    ...overrides
  };
}

class TestHttpClient extends HttpClient {
  constructor(
    private readonly run: (options: HttpRequestOptions) => Promise<HttpResponse<unknown>>,
    authManager?: AuthManager
  ) {
    super({ authManager, maxRetries: 3 });
  }

  protected override async executeRequest<T>(requestOptions: HttpRequestOptions, _url: URL): Promise<HttpResponse<T>> {
    return await this.run(requestOptions) as HttpResponse<T>;
  }
}

describe('HttpClient AuthManager integration', () => {
  it('injects managed access token when Authorization header is absent', async () => {
    const authManager = createStubAuthManager();
    const run = vi.fn(async (options: HttpRequestOptions) => ({
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { ok: true, authorization: options.headers?.Authorization }
    }));
    const client = new TestHttpClient(run, authManager);

    const response = await client.request({
      method: 'GET',
      url: 'https://example.com/test'
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(run.mock.calls[0]?.[0].headers?.Authorization).toBe('Bearer managed-access-token');
    expect((response.data as { authorization?: string }).authorization).toBe('Bearer managed-access-token');
  });

  it('refreshes once after 401 and retries with the new token', async () => {
    const onUnauthorized = vi.fn(async () => 'refreshed-access-token');
    const authManager = createStubAuthManager({ onUnauthorized });
    const run = vi.fn()
      .mockRejectedValueOnce(new AuthenticationError('Unauthorized', { statusCode: 401 }))
      .mockResolvedValueOnce({
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { ok: true }
      });
    const client = new TestHttpClient(run, authManager);

    const response = await client.request({
      method: 'GET',
      url: 'https://example.com/secure',
      headers: {
        Authorization: 'Bearer stale-access-token'
      }
    });

    expect(response.data).toEqual({ ok: true });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]?.[0].headers?.Authorization).toBe('Bearer refreshed-access-token');
  });

  it('does not trigger refresh when skipAuthRetry is true', async () => {
    const onUnauthorized = vi.fn(async () => 'refreshed-access-token');
    const authManager = createStubAuthManager({ onUnauthorized });
    const run = vi.fn().mockRejectedValueOnce(new AuthenticationError('Unauthorized', { statusCode: 401 }));
    const client = new TestHttpClient(run, authManager);

    await expect(client.request({
      method: 'POST',
      url: 'https://example.com/auth/token/refresh',
      headers: {
        Authorization: 'Bearer refresh-token'
      },
      skipAuthRetry: true
    })).rejects.toBeInstanceOf(AuthenticationError);

    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
