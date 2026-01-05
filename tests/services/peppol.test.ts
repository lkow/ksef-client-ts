import { describe, it, expect, beforeEach } from 'vitest';
import { PeppolService } from '../../src/api2/services/peppol.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

describe('PeppolService', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  describe('queryProviders', () => {
    it('calls GET /peppol/query', async () => {
      mockHttpClient.mockResponse({
        peppolProviders: [
          {
            id: 'P123456789',
            name: 'Dostawca usług Peppol',
            dateCreated: '2025-07-11T12:23:56.0154302+00:00'
          }
        ],
        hasMore: false
      });

      const service = new PeppolService(mockHttpClient as any, 'test');

      const result = await service.queryProviders('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/peppol/query');
      expect(request?.headers?.['Authorization']).toBe('Bearer token');
      
      expect(result.peppolProviders).toHaveLength(1);
      expect(result.peppolProviders[0]?.id).toBe('P123456789');
      expect(result.peppolProviders[0]?.name).toBe('Dostawca usług Peppol');
      expect(result.hasMore).toBe(false);
    });

    it('includes default pagination params', async () => {
      mockHttpClient.mockResponse({
        peppolProviders: [],
        hasMore: false
      });

      const service = new PeppolService(mockHttpClient as any, 'test');

      await service.queryProviders('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageOffset=0');
      expect(request?.url).toContain('pageSize=10');
    });

    it('includes custom pagination params', async () => {
      mockHttpClient.mockResponse({
        peppolProviders: [],
        hasMore: true
      });

      const service = new PeppolService(mockHttpClient as any, 'test');

      await service.queryProviders('token', {
        pageOffset: 5,
        pageSize: 25
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageOffset=5');
      expect(request?.url).toContain('pageSize=25');
    });

    it('returns multiple providers', async () => {
      mockHttpClient.mockResponse({
        peppolProviders: [
          {
            id: 'P111111111',
            name: 'Provider 1',
            dateCreated: '2025-01-01T00:00:00+00:00'
          },
          {
            id: 'P222222222',
            name: 'Provider 2',
            dateCreated: '2025-01-02T00:00:00+00:00'
          },
          {
            id: 'P333333333',
            name: 'Provider 3',
            dateCreated: '2025-01-03T00:00:00+00:00'
          }
        ],
        hasMore: true
      });

      const service = new PeppolService(mockHttpClient as any, 'test');

      const result = await service.queryProviders('token');

      expect(result.peppolProviders).toHaveLength(3);
      expect(result.peppolProviders[0]?.id).toBe('P111111111');
      expect(result.peppolProviders[1]?.id).toBe('P222222222');
      expect(result.peppolProviders[2]?.id).toBe('P333333333');
      expect(result.hasMore).toBe(true);
    });

    it('handles empty provider list', async () => {
      mockHttpClient.mockResponse({
        peppolProviders: [],
        hasMore: false
      });

      const service = new PeppolService(mockHttpClient as any, 'test');

      const result = await service.queryProviders('token');

      expect(result.peppolProviders).toHaveLength(0);
      expect(result.hasMore).toBe(false);
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      mockHttpClient.mockResponse({ peppolProviders: [], hasMore: false });

      const service = new PeppolService(mockHttpClient as any, 'test');
      await service.queryProviders('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses demo environment URL', async () => {
      mockHttpClient.mockResponse({ peppolProviders: [], hasMore: false });

      const service = new PeppolService(mockHttpClient as any, 'demo');
      await service.queryProviders('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api-demo.ksef.mf.gov.pl');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({ peppolProviders: [], hasMore: false });

      const service = new PeppolService(mockHttpClient as any, 'prod');
      await service.queryProviders('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});

