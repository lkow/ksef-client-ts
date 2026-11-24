import { describe, it, expect, beforeEach } from 'vitest';
import { AuthSessionService } from '../../src/api2/services/auth-sessions.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

describe('AuthSessionService', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  it('lists rev2 sessions with pagination and structured authentication data', async () => {
    const page = {
      continuationToken: 'next-page',
      items: [{
        referenceNumber: 'session-ref',
        startDate: '2026-11-24T08:00:00Z',
        authenticationMethodInfo: {
          category: { code: 'FutureValue', rawCode: 'Other', displayName: 'Other' },
          code: 'NewMethod',
          displayName: 'New authentication method'
        },
        status: { code: 200, description: 'Success' }
      }]
    };
    mockHttpClient.mockResponse(page);
    const service = new AuthSessionService(mockHttpClient as any, 'test');

    await expect(service.listSessionsRev2('access-token', {
      pageSize: 25,
      continuationToken: 'first-page'
    })).resolves.toEqual(page);
    expect(mockHttpClient.getLastRequest()).toEqual({
      method: 'GET',
      url: 'https://api-test.ksef.mf.gov.pl/v2/auth/sessions/rev2?pageSize=25',
      headers: { Authorization: 'Bearer access-token', 'x-continuation-token': 'first-page' },
      skipAuthRetry: true
    });
  });

  describe('listSessions', () => {
    it('calls GET /auth/sessions', async () => {
      mockHttpClient.mockResponse({
        items: [],
        continuationToken: null
      });

      const service = new AuthSessionService(mockHttpClient as any, 'test');

      await service.listSessions('access-token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/auth/sessions');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
    });

    it('includes pageSize query param', async () => {
      mockHttpClient.mockResponse({ items: [] });

      const service = new AuthSessionService(mockHttpClient as any, 'test');

      await service.listSessions('token', { pageSize: 50 });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageSize=50');
    });

    it('includes continuation token header', async () => {
      mockHttpClient.mockResponse({ items: [] });

      const service = new AuthSessionService(mockHttpClient as any, 'test');

      await service.listSessions('token', { continuationToken: 'cont-123' });

      const request = mockHttpClient.getLastRequest();
      expect(request?.headers?.['x-continuation-token']).toBe('cont-123');
    });

    it('returns sessions list', async () => {
      mockHttpClient.mockResponse({
        items: [
          {
            referenceNumber: 'sess-1',
            startDate: '2024-01-01T00:00:00Z',
            authenticationMethod: 'Token',
            status: 'Active'
          },
          {
            referenceNumber: 'sess-2',
            startDate: '2024-01-02T00:00:00Z',
            authenticationMethod: 'XAdES',
            status: 'Active',
            isCurrent: true
          }
        ],
        continuationToken: 'next-page'
      });

      const service = new AuthSessionService(mockHttpClient as any, 'test');

      const result = await service.listSessions('token');

      expect(result.items).toHaveLength(2);
      expect(result.items[0].referenceNumber).toBe('sess-1');
      expect(result.items[1].isCurrent).toBe(true);
      expect(result.continuationToken).toBe('next-page');
    });
  });

  describe('revokeCurrentSession', () => {
    it('calls DELETE /auth/sessions/current', async () => {
      mockHttpClient.mockResponse({});

      const service = new AuthSessionService(mockHttpClient as any, 'test');

      await service.revokeCurrentSession('access-token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('DELETE');
      expect(request?.url).toContain('/auth/sessions/current');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
    });
  });

  describe('revokeSession', () => {
    it('calls DELETE /auth/sessions/{ref}', async () => {
      mockHttpClient.mockResponse({});

      const service = new AuthSessionService(mockHttpClient as any, 'test');

      await service.revokeSession('access-token', 'session-ref-to-revoke');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('DELETE');
      expect(request?.url).toContain('/auth/sessions/session-ref-to-revoke');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      mockHttpClient.mockResponse({ items: [] });

      const service = new AuthSessionService(mockHttpClient as any, 'test');
      await service.listSessions('token');

      expect(mockHttpClient.getLastRequest()?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses demo environment URL', async () => {
      mockHttpClient.mockResponse({ items: [] });

      const service = new AuthSessionService(mockHttpClient as any, 'demo');
      await service.listSessions('token');

      expect(mockHttpClient.getLastRequest()?.url).toBe('https://api-demo.ksef.mf.gov.pl/v2/auth/sessions');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({ items: [] });

      const service = new AuthSessionService(mockHttpClient as any, 'prod');
      await service.listSessions('token');

      expect(mockHttpClient.getLastRequest()?.url).toBe('https://api.ksef.mf.gov.pl/v2/auth/sessions');
    });
  });
});

