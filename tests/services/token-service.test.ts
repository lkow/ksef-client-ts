import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../../src/api2/services/token.js';
import type { GenerateTokenRequestRev2, TokenStatusResponseRev2 } from '../../src/api2/types/token.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

describe('TokenService', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  describe('generateToken', () => {
    it('calls POST /tokens with permissions and description', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'token-ref-123',
        token: 'generated-ksef-token'
      });

      const service = new TokenService(mockHttpClient as any, 'test');

      await service.generateToken('access-token', {
        permissions: ['InvoiceRead', 'InvoiceWrite', 'Introspection', 'CollectiveIdentifierManage'],
        description: 'Test token for API access'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toBe('https://api-test.ksef.mf.gov.pl/v2/tokens');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');

      const body = JSON.parse(request?.body!);
      expect(body.permissions).toEqual(['InvoiceRead', 'InvoiceWrite', 'Introspection', 'CollectiveIdentifierManage']);
      expect(body.description).toBe('Test token for API access');
    });

    it('returns generated token response', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'gen-ref',
        token: 'the-new-token-value'
      });

      const service = new TokenService(mockHttpClient as any, 'test');

      const result = await service.generateToken('token', {
        permissions: ['InvoiceRead'],
        description: 'desc'
      });

      expect(result.referenceNumber).toBe('gen-ref');
      expect(result.token).toBe('the-new-token-value');
    });
  });

  describe('queryTokens', () => {
    it('calls GET /tokens with filter params', async () => {
      mockHttpClient.mockResponse({
        tokens: [],
        continuationToken: null
      });

      const service = new TokenService(mockHttpClient as any, 'test');

      await service.queryTokens('access-token', {
        status: ['Active', 'Pending'],
        description: 'test',
        pageSize: 25
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/tokens');
      expect(request?.url).toContain('status=Active');
      expect(request?.url).toContain('status=Pending');
      expect(request?.url).toContain('description=test');
      expect(request?.url).toContain('pageSize=25');
    });

    it('includes continuation token header', async () => {
      mockHttpClient.mockResponse({ tokens: [] });

      const service = new TokenService(mockHttpClient as any, 'test');

      await service.queryTokens('token', {
        continuationToken: 'cont-token-xyz'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.headers?.['x-continuation-token']).toBe('cont-token-xyz');
    });

    it('works with no filter options', async () => {
      mockHttpClient.mockResponse({
        tokens: [
          { referenceNumber: 'tok-1', status: 'Active' },
          { referenceNumber: 'tok-2', status: 'Pending' }
        ]
      });

      const service = new TokenService(mockHttpClient as any, 'test');

      const result = await service.queryTokens('token');

      expect(result.tokens).toHaveLength(2);
    });
  });

  describe('getToken', () => {
    it('calls GET /tokens/{ref}', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'token-ref-456',
        status: 'Active',
        requestedPermissions: ['InvoiceRead']
      });

      const service = new TokenService(mockHttpClient as any, 'test');

      const result = await service.getToken('access-token', 'token-ref-456');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/tokens/token-ref-456');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
      expect(result.status).toBe('Active');
    });
  });

  describe('revokeToken', () => {
    it('calls DELETE /tokens/{ref}', async () => {
      mockHttpClient.mockResponse({});

      const service = new TokenService(mockHttpClient as any, 'test');

      await service.revokeToken('access-token', 'token-to-revoke');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('DELETE');
      expect(request?.url).toContain('/tokens/token-to-revoke');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');
    });
  });

  describe('rev2', () => {
    const tokenStatus: TokenStatusResponseRev2 = {
      referenceNumber: 'token-ref',
      authorIdentifier: {
        type: { code: 'FutureValue', rawCode: 'NewAuthorType', displayName: 'New author type' },
        value: 'test-author'
      },
      contextIdentifier: {
        type: { code: 'InternalId', rawCode: 'InternalId', displayName: 'Internal ID' },
        value: 'test-context'
      },
      description: 'Test integration',
      requestedPermissions: [{ code: 'InvoiceRead', rawCode: 'InvoiceRead', displayName: 'Read invoices' }],
      dateCreated: '2026-11-24T08:00:00Z',
      validFrom: '2026-12-01T09:00:00+01:00',
      validTo: '2027-03-01T09:00:00+01:00',
      status: { code: 'AwaitingApproval', rawCode: 'AwaitingApproval', displayName: 'Awaiting approval' }
    };

    it('issues a token with the requested validity dates and without transport retries', async () => {
      const issued = { referenceNumber: 'token-ref', token: 'synthetic-token' };
      mockHttpClient.mockResponse(issued, { status: 202 });
      const service = new TokenService(mockHttpClient as any, 'test');
      const requestBody: GenerateTokenRequestRev2 = {
        permissions: ['InvoiceRead'],
        description: 'Test integration',
        validFrom: tokenStatus.validFrom,
        validTo: null
      };

      await expect(service.generateTokenRev2('access-token', requestBody)).resolves.toEqual(issued);
      expect(mockHttpClient.getLastRequest()).toEqual({
        method: 'POST',
        url: 'https://api-test.ksef.mf.gov.pl/v2/tokens/rev2',
        headers: { Authorization: 'Bearer access-token' },
        body: JSON.stringify(requestBody),
        maxRetries: 0,
        skipAuthRetry: true
      });
    });

    it('lists tokens with rev2 filters and a continuation header', async () => {
      const page = { tokens: [tokenStatus], continuationToken: 'next-page' };
      mockHttpClient.mockResponse(page);
      const service = new TokenService(mockHttpClient as any, 'test');

      await expect(service.queryTokensRev2('access-token', {
        status: ['AwaitingApproval', 'NotYetActive'],
        description: 'Test integration',
        authorIdentifier: 'test-author',
        authorIdentifierType: 'Nip',
        validFrom: tokenStatus.validFrom,
        validTo: tokenStatus.validTo,
        pageSize: 25,
        continuationToken: 'first-page'
      })).resolves.toEqual(page);
      const request = mockHttpClient.getLastRequest()!;
      const url = new URL(request.url);
      expect(request.method).toBe('GET');
      expect(url.origin + url.pathname).toBe('https://api-test.ksef.mf.gov.pl/v2/tokens/rev2');
      expect(url.searchParams.getAll('status')).toEqual(['AwaitingApproval', 'NotYetActive']);
      expect(url.searchParams.get('description')).toBe('Test integration');
      expect(url.searchParams.get('authorIdentifier')).toBe('test-author');
      expect(url.searchParams.get('authorIdentifierType')).toBe('Nip');
      expect(url.searchParams.get('validFrom')).toBe(tokenStatus.validFrom);
      expect(url.searchParams.get('validTo')).toBe(tokenStatus.validTo);
      expect(url.searchParams.get('pageSize')).toBe('25');
      expect(url.searchParams.has('continuationToken')).toBe(false);
      expect(request.headers).toEqual({
        Authorization: 'Bearer access-token',
        'x-continuation-token': 'first-page'
      });
      expect(request.skipAuthRetry).toBe(true);
    });

    it('returns token status with failure details and an encoded reference', async () => {
      const failedToken: TokenStatusResponseRev2 = {
        ...tokenStatus,
        status: { code: 'Failed', rawCode: 'Failed', displayName: 'Failed' },
        failure: { code: 'TestFailure', description: 'Token activation failed', details: null }
      };
      mockHttpClient.mockResponse(failedToken);
      const service = new TokenService(mockHttpClient as any, 'test');

      await expect(service.getTokenRev2('access-token', 'token/ref')).resolves.toEqual(failedToken);
      expect(mockHttpClient.getLastRequest()).toEqual({
        method: 'GET',
        url: 'https://api-test.ksef.mf.gov.pl/v2/tokens/rev2/token%2Fref',
        headers: { Authorization: 'Bearer access-token' },
        skipAuthRetry: true
      });
    });

    it('approves a token with the supplied credential and an empty request body', async () => {
      mockHttpClient.mockResponse(undefined, { status: 204 });
      const service = new TokenService(mockHttpClient as any, 'test');

      await expect(service.approveToken('xades-access-token', 'token/ref')).resolves.toBeUndefined();
      expect(mockHttpClient.getLastRequest()).toEqual({
        method: 'POST',
        url: 'https://api-test.ksef.mf.gov.pl/v2/tokens/token%2Fref/approve',
        headers: { Authorization: 'Bearer xades-access-token' },
        maxRetries: 0,
        skipAuthRetry: true
      });
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      mockHttpClient.mockResponse({ tokens: [] });

      const service = new TokenService(mockHttpClient as any, 'test');
      await service.queryTokens('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses demo environment URL', async () => {
      mockHttpClient.mockResponse({ tokens: [] });

      const service = new TokenService(mockHttpClient as any, 'demo');
      await service.queryTokens('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toBe('https://api-demo.ksef.mf.gov.pl/v2/tokens');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({ tokens: [] });

      const service = new TokenService(mockHttpClient as any, 'prod');
      await service.queryTokens('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toBe('https://api.ksef.mf.gov.pl/v2/tokens');
    });
  });
});
