import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthenticationV2Service } from '../../src/api2/services/authentication.js';
import { createMockHttpClient, createMockSecurityService } from '../helpers/mock-http-client.js';

describe('AuthenticationV2Service', () => {
  const mockHttpClient = createMockHttpClient();
  const mockSecurityService = createMockSecurityService();

  beforeEach(() => {
    mockHttpClient.reset();
    vi.clearAllMocks();
  });

  describe('requestChallenge', () => {
    it('calls POST /auth/challenge', async () => {
      const challengeResponse = {
        challenge: 'challenge-value',
        timestamp: '2024-01-01T00:00:00.000Z',
        timestampMs: 1704067200000
      };
      mockHttpClient.mockResponse(challengeResponse);

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );
      await service.requestChallenge();

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/auth/challenge');
    });

    it('returns challenge and timestamp', async () => {
      const challengeResponse = {
        challenge: 'test-challenge-123',
        timestamp: '2024-01-01T00:00:00.000Z',
        timestampMs: 1704067200000
      };
      mockHttpClient.mockResponse(challengeResponse);

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );
      const result = await service.requestChallenge();

      expect(result.challenge).toBe('test-challenge-123');
      expect(result.timestampMs).toBe(1704067200000);
    });
  });

  describe('initiateTokenAuthentication', () => {
    it('encrypts token with challenge timestamp and calls /auth/ksef-token', async () => {
      // Mock challenge response first
      mockHttpClient.mockResponseOnce({
        challenge: 'test-challenge',
        timestamp: '2024-01-01T00:00:00.000Z',
        timestampMs: 1704067200000
      });
      
      // Mock token auth response
      mockHttpClient.mockResponseOnce({
        referenceNumber: 'ref-123',
        authenticationToken: { token: 'auth-token' }
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.initiateTokenAuthentication(
        { type: 'Nip', value: '1234567890' },
        'test-ksef-token'
      );

      const requests = mockHttpClient.getRequests();
      expect(requests).toHaveLength(2);
      
      // Second request should be to /auth/ksef-token
      const tokenRequest = requests[1];
      expect(tokenRequest.method).toBe('POST');
      expect(tokenRequest.url).toContain('/auth/ksef-token');
      
      // Body should contain encrypted token and context
      const body = JSON.parse(tokenRequest.body!);
      expect(body.challenge).toBe('test-challenge');
      expect(body.contextIdentifier).toEqual({ type: 'Nip', value: '1234567890' });
      expect(body.encryptedToken).toBeDefined();
    });

    it('includes ipAddressPolicy when specified', async () => {
      mockHttpClient.mockResponseOnce({
        challenge: 'test-challenge',
        timestampMs: 1704067200000
      });
      mockHttpClient.mockResponseOnce({
        referenceNumber: 'ref-123',
        authenticationToken: { token: 'auth-token' }
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.initiateTokenAuthentication(
        { type: 'Nip', value: '1234567890' },
        'test-token',
        { ipAddressPolicy: 'STRICT' }
      );

      const tokenRequest = mockHttpClient.getRequests()[1];
      const body = JSON.parse(tokenRequest.body!);
      expect(body.ipAddressPolicy).toBe('STRICT');
    });
  });

  describe('initiateXadesAuthentication', () => {
    it('calls POST /auth/xades-signature with XML body', async () => {
      const authResponse = {
        referenceNumber: 'ref-456',
        authenticationToken: { token: 'xades-auth-token' }
      };
      mockHttpClient.mockResponse(authResponse);

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      const signedXml = '<AuthTokenRequest>...</AuthTokenRequest>';
      await service.initiateXadesAuthentication(signedXml);

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/auth/xades-signature');
      expect(request?.headers?.['Content-Type']).toBe('application/xml');
      expect(request?.body).toBe(signedXml);
    });

    it('adds verifyCertificateChain query param when true', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'ref-789'
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.initiateXadesAuthentication(
        '<AuthTokenRequest/>',
        undefined,
        { verifyCertificateChain: true }
      );

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('verifyCertificateChain=true');
    });

    it('includes authorization header when provided', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'ref-abc'
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.initiateXadesAuthentication('<AuthTokenRequest/>', 'existing-auth-token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.headers?.['Authorization']).toBe('Bearer existing-auth-token');
    });
  });

  describe('getAuthenticationStatus', () => {
    it('calls GET /auth/{referenceNumber}', async () => {
      mockHttpClient.mockResponse({
        status: 'Active'
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.getAuthenticationStatus('ref-123', 'auth-token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/auth/ref-123');
      expect(request?.headers?.['Authorization']).toBe('Bearer auth-token');
    });
  });

  describe('redeemTokens', () => {
    it('calls POST /auth/token/redeem', async () => {
      mockHttpClient.mockResponse({
        accessToken: { token: 'access-token' },
        refreshToken: { token: 'refresh-token' }
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.redeemTokens('auth-token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/auth/token/redeem');
      expect(request?.headers?.['Authorization']).toBe('Bearer auth-token');
    });
  });

  describe('refreshAccessToken', () => {
    it('calls POST /auth/token/refresh', async () => {
      mockHttpClient.mockResponse({
        accessToken: { token: 'new-access-token' }
      });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );

      await service.refreshAccessToken('refresh-token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/auth/token/refresh');
      expect(request?.headers?.['Authorization']).toBe('Bearer refresh-token');
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      mockHttpClient.mockResponse({ challenge: 'test' });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'test',
        mockSecurityService as any
      );
      await service.requestChallenge();

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({ challenge: 'test' });

      const service = new AuthenticationV2Service(
        mockHttpClient as any,
        'prod',
        mockSecurityService as any
      );
      await service.requestChallenge();

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});

