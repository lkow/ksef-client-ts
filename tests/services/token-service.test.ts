import { describe, it, expect, beforeEach } from 'vitest';
import { TokenService } from '../../src/api2/services/token.js';
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
        permissions: ['InvoiceRead', 'InvoiceWrite'],
        description: 'Test token for API access'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/tokens');
      expect(request?.headers?.['Authorization']).toBe('Bearer access-token');

      const body = JSON.parse(request?.body!);
      expect(body.permissions).toEqual(['InvoiceRead', 'InvoiceWrite']);
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
      expect(request?.url).toContain('api-demo.ksef.mf.gov.pl');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({ tokens: [] });

      const service = new TokenService(mockHttpClient as any, 'prod');
      await service.queryTokens('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});

