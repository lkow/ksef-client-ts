import { describe, it, expect, vi } from 'vitest';
import { HttpClient, type HttpRequestOptions, type HttpResponse } from '../../src/utils/http.js';
import { AuthenticationError } from '../../src/types/common.js';
import type { AuthManager } from '../../src/api2/auth-manager.js';
import type { HttpClientOptions } from '../../src/types/config.js';

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
    options: HttpClientOptions = {}
  ) {
    super({ maxRetries: 3, ...options });
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
    const client = new TestHttpClient(run, { authManager });

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
    const client = new TestHttpClient(run, { authManager });

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
    const client = new TestHttpClient(run, { authManager });

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

describe('HttpClient X-System-Warning integration', () => {
  it('calls onSystemWarning when a successful response contains X-System-Warning', async () => {
    const onSystemWarning = vi.fn();
    const run = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {
        'X-System-Warning': '[WARN_1]: First warning'
      },
      data: { ok: true }
    }));
    const client = new TestHttpClient(run, { onSystemWarning });

    await client.request({
      method: 'GET',
      url: 'https://example.com/test?value=1'
    });

    expect(onSystemWarning).toHaveBeenCalledTimes(1);
    expect(onSystemWarning).toHaveBeenCalledWith({
      code: 'WARN_1',
      message: 'First warning',
      raw: '[WARN_1]: First warning',
      method: 'GET',
      url: 'https://example.com/test?value=1',
      status: 200
    });
  });

  it('parses multiple system warnings from a case-insensitive header', async () => {
    const onSystemWarning = vi.fn();
    const run = vi.fn(async () => ({
      status: 202,
      statusText: 'Accepted',
      headers: {
        'x-system-warning': '[WARN_1]: First warning | [WARN_2]: Second warning'
      },
      data: null
    }));
    const client = new TestHttpClient(run, { onSystemWarning });

    await client.request({
      method: 'POST',
      url: 'https://example.com/process'
    });

    expect(onSystemWarning).toHaveBeenCalledTimes(2);
    expect(onSystemWarning.mock.calls.map(([warning]) => warning)).toEqual([
      {
        code: 'WARN_1',
        message: 'First warning',
        raw: '[WARN_1]: First warning | [WARN_2]: Second warning',
        method: 'POST',
        url: 'https://example.com/process',
        status: 202
      },
      {
        code: 'WARN_2',
        message: 'Second warning',
        raw: '[WARN_1]: First warning | [WARN_2]: Second warning',
        method: 'POST',
        url: 'https://example.com/process',
        status: 202
      }
    ]);
  });

  it('passes unparsed system warning headers as UNKNOWN', async () => {
    const onSystemWarning = vi.fn();
    const run = vi.fn(async () => ({
      status: 200,
      statusText: 'OK',
      headers: {
        'X-System-Warning': 'unexpected warning format'
      },
      data: { ok: true }
    }));
    const client = new TestHttpClient(run, { onSystemWarning });

    await client.request({
      method: 'GET',
      url: 'https://example.com/test'
    });

    expect(onSystemWarning).toHaveBeenCalledWith({
      code: 'UNKNOWN',
      message: 'unexpected warning format',
      raw: 'unexpected warning format',
      method: 'GET',
      url: 'https://example.com/test',
      status: 200
    });
  });
});
