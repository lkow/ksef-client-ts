import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecurityService } from '../src/api2/security.js';
import { createMockHttpClient } from './helpers/mock-http-client.js';

describe('SecurityService', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const mockCertificates = [
    {
      certificate: 'MIIB...base64cert1',
      validFrom: '2024-01-01T00:00:00Z',
      validTo: '2025-01-01T00:00:00Z',
      usage: ['KsefTokenEncryption']
    },
    {
      certificate: 'MIIC...base64cert2',
      validFrom: '2024-01-01T00:00:00Z',
      validTo: '2025-01-01T00:00:00Z',
      usage: ['SymmetricKeyEncryption']
    }
  ];

  describe('getPublicKey', () => {
    it('fetches certificates from /security/public-key-certificates', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'test');
      await service.getPublicKey('KsefTokenEncryption');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/security/public-key-certificates');
    });

    it('returns PEM-formatted certificate', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'test');
      const pem = await service.getPublicKey('KsefTokenEncryption');

      expect(pem).toContain('-----BEGIN CERTIFICATE-----');
      expect(pem).toContain('-----END CERTIFICATE-----');
    });

    it('caches certificates by usage type', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'test');
      
      // First call should fetch
      await service.getPublicKey('KsefTokenEncryption');
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await service.getPublicKey('KsefTokenEncryption');
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    });

    it('fetches separately for different usage types', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'test');
      
      await service.getPublicKey('KsefTokenEncryption');
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

      // Different usage type triggers new fetch
      await service.getPublicKey('SymmetricKeyEncryption');
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it('refetches when cached certificate expires', async () => {
      // Start before expiry
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'test');
      
      await service.getPublicKey('KsefTokenEncryption');
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);

      // Advance past expiry date
      vi.setSystemTime(new Date('2025-01-02T00:00:00Z'));
      
      // Update mock to return new certificates
      mockHttpClient.mockResponse([
        {
          certificate: 'MIID...newcert',
          validFrom: '2025-01-01T00:00:00Z',
          validTo: '2026-01-01T00:00:00Z',
          usage: ['KsefTokenEncryption']
        }
      ]);

      await service.getPublicKey('KsefTokenEncryption');
      expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    });

    it('throws when no matching certificate found', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse([
        {
          certificate: 'cert',
          validFrom: '2024-01-01T00:00:00Z',
          validTo: '2025-01-01T00:00:00Z',
          usage: ['SomeOtherUsage']
        }
      ]);

      const service = new SecurityService(mockHttpClient as any, 'test');

      await expect(service.getPublicKey('KsefTokenEncryption')).rejects.toThrow(
        /No public key certificate found for usage KsefTokenEncryption/
      );
    });

    it('handles certificate with multiple usages', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse([
        {
          certificate: 'MIIE...multicert',
          validFrom: '2024-01-01T00:00:00Z',
          validTo: '2025-01-01T00:00:00Z',
          usage: ['KsefTokenEncryption', 'SymmetricKeyEncryption']
        }
      ]);

      const service = new SecurityService(mockHttpClient as any, 'test');
      
      const pem1 = await service.getPublicKey('KsefTokenEncryption');
      const pem2 = await service.getPublicKey('SymmetricKeyEncryption');

      expect(pem1).toContain('-----BEGIN CERTIFICATE-----');
      expect(pem2).toContain('-----BEGIN CERTIFICATE-----');
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'test');
      await service.getPublicKey('KsefTokenEncryption');

      expect(mockHttpClient.getLastRequest()?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses prod environment URL', async () => {
      vi.setSystemTime(new Date('2024-06-01T00:00:00Z'));
      mockHttpClient.mockResponse(mockCertificates);

      const service = new SecurityService(mockHttpClient as any, 'prod');
      await service.getPublicKey('KsefTokenEncryption');

      expect(mockHttpClient.getLastRequest()?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});

