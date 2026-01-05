import { describe, it, expect, beforeEach } from 'vitest';
import { CertificateService } from '../../src/api2/services/certificates.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

describe('CertificateService', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  describe('getLimits', () => {
    it('calls GET /certificates/limits', async () => {
      mockHttpClient.mockResponse({
        canRequest: true,
        enrollment: { limit: 6, remaining: 3 },
        certificate: { limit: 2, remaining: 1 }
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const result = await service.getLimits('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/certificates/limits');
      expect(request?.headers?.['Authorization']).toBe('Bearer token');
      expect(result.canRequest).toBe(true);
      expect(result.enrollment.limit).toBe(6);
      expect(result.certificate.remaining).toBe(1);
    });
  });

  describe('getEnrollmentData', () => {
    it('calls GET /certificates/enrollments/data', async () => {
      mockHttpClient.mockResponse({
        commonName: 'Test Certificate',
        countryName: 'PL',
        organizationName: 'Test Org',
        organizationIdentifier: '1234567890'
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const result = await service.getEnrollmentData('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/certificates/enrollments/data');
      expect(result.commonName).toBe('Test Certificate');
      expect(result.countryName).toBe('PL');
    });
  });

  describe('submitEnrollment', () => {
    it('calls POST /certificates/enrollments', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: '20251010-EH-1B6C9EB000-4B15D3AEB9-89',
        timestamp: '2025-10-11T12:23:56.0154302+00:00'
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const request = {
        certificateName: 'Test Cert',
        certificateType: 'Authentication' as const,
        csr: 'MIIDJjCCAd4CAQAwgbAxIjAgBgNVBAMMGUZpcm1hIEtvd2Fsc2tpIENlcnR5ZmlrYXQ...'
      };

      const result = await service.submitEnrollment('token', request);

      const lastRequest = mockHttpClient.getLastRequest();
      expect(lastRequest?.method).toBe('POST');
      expect(lastRequest?.url).toContain('/certificates/enrollments');
      expect(lastRequest?.headers?.['Authorization']).toBe('Bearer token');
      
      const body = JSON.parse(lastRequest?.body!);
      expect(body.certificateName).toBe('Test Cert');
      expect(body.certificateType).toBe('Authentication');
      expect(body.csr).toBeDefined();
      
      expect(result.referenceNumber).toBe('20251010-EH-1B6C9EB000-4B15D3AEB9-89');
    });

    it('includes validFrom when provided', async () => {
      mockHttpClient.mockResponse({
        referenceNumber: 'ref-123',
        timestamp: '2025-10-11T12:23:56+00:00'
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      await service.submitEnrollment('token', {
        certificateName: 'Cert',
        certificateType: 'Offline',
        csr: 'csr-data',
        validFrom: '2025-08-28T09:22:13.388+00:00'
      });

      const body = JSON.parse(mockHttpClient.getLastRequest()?.body!);
      expect(body.validFrom).toBe('2025-08-28T09:22:13.388+00:00');
    });
  });

  describe('getEnrollmentStatus', () => {
    it('calls GET /certificates/enrollments/{referenceNumber}', async () => {
      mockHttpClient.mockResponse({
        requestDate: '2025-10-11T12:23:56.0154302+00:00',
        status: {
          code: 100,
          description: 'Wniosek przyjęty do realizacji'
        },
        certificateSerialNumber: null
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const result = await service.getEnrollmentStatus('token', '20251010-EH-1B6C9EB000-4B15D3AEB9-89');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('GET');
      expect(request?.url).toContain('/certificates/enrollments/20251010-EH-1B6C9EB000-4B15D3AEB9-89');
      expect(result.status.code).toBe(100);
    });

    it('handles completed enrollment with serial number', async () => {
      mockHttpClient.mockResponse({
        requestDate: '2025-10-11T12:23:56+00:00',
        status: {
          code: 200,
          description: 'Wniosek obsłużony'
        },
        certificateSerialNumber: '0321C82DA41B4362'
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const result = await service.getEnrollmentStatus('token', 'ref-123');
      expect(result.certificateSerialNumber).toBe('0321C82DA41B4362');
    });
  });

  describe('retrieveCertificates', () => {
    it('calls POST /certificates/retrieve', async () => {
      mockHttpClient.mockResponse({
        certificates: [
          {
            certificate: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==',
            certificateName: 'Cert 00023',
            certificateSerialNumber: '0321C82DA41B4362',
            certificateType: 'Authentication'
          }
        ]
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const result = await service.retrieveCertificates('token', {
        certificateSerialNumbers: ['0321C82DA41B4362', '0321F21DA462A362']
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/certificates/retrieve');
      
      const body = JSON.parse(request?.body!);
      expect(body.certificateSerialNumbers).toEqual(['0321C82DA41B4362', '0321F21DA462A362']);
      
      expect(result.certificates).toHaveLength(1);
      expect(result.certificates[0]?.certificateSerialNumber).toBe('0321C82DA41B4362');
    });
  });

  describe('revokeCertificate', () => {
    it('calls POST /certificates/{serialNumber}/revoke without reason', async () => {
      mockHttpClient.mockResponse({}, { status: 204 });

      const service = new CertificateService(mockHttpClient as any, 'test');

      await service.revokeCertificate('token', '0321C82DA41B4362');

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/certificates/0321C82DA41B4362/revoke');
      expect(request?.body).toBeUndefined();
    });

    it('calls POST /certificates/{serialNumber}/revoke with revocation reason', async () => {
      mockHttpClient.mockResponse({}, { status: 204 });

      const service = new CertificateService(mockHttpClient as any, 'test');

      await service.revokeCertificate('token', '0321C82DA41B4362', {
        revocationReason: 'KeyCompromise'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/certificates/0321C82DA41B4362/revoke');
      
      const body = JSON.parse(request?.body!);
      expect(body.revocationReason).toBe('KeyCompromise');
    });
  });

  describe('queryCertificates', () => {
    it('calls POST /certificates/query', async () => {
      mockHttpClient.mockResponse({
        certificates: [
          {
            certificateSerialNumber: '018209160C631F1E',
            name: 'Certyfikat 1',
            type: 'Authentication',
            commonName: 'Jan Kowalski',
            status: 'Active',
            subjectIdentifier: {
              type: 'Nip',
              value: '1234445678'
            },
            validFrom: '2025-08-24T14:15:22+00:00',
            validTo: '2027-08-24T14:15:22+00:00',
            requestDate: '2025-08-24T14:15:22+00:00'
          }
        ],
        hasMore: false
      });

      const service = new CertificateService(mockHttpClient as any, 'test');

      const result = await service.queryCertificates('token', {
        type: 'Authentication',
        status: 'Active'
      });

      const request = mockHttpClient.getLastRequest();
      expect(request?.method).toBe('POST');
      expect(request?.url).toContain('/certificates/query');
      
      const body = JSON.parse(request?.body!);
      expect(body.type).toBe('Authentication');
      expect(body.status).toBe('Active');
      
      expect(result.certificates).toHaveLength(1);
      expect(result.hasMore).toBe(false);
    });

    it('includes pagination params in query string', async () => {
      mockHttpClient.mockResponse({ certificates: [], hasMore: false });

      const service = new CertificateService(mockHttpClient as any, 'test');

      await service.queryCertificates(
        'token',
        { type: 'Offline' },
        { pageOffset: 5, pageSize: 20 }
      );

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('pageOffset=5');
      expect(request?.url).toContain('pageSize=20');
    });

    it('supports filtering by certificate serial number', async () => {
      mockHttpClient.mockResponse({ certificates: [], hasMore: false });

      const service = new CertificateService(mockHttpClient as any, 'test');

      await service.queryCertificates('token', {
        certificateSerialNumber: '018209160C631F1E'
      });

      const body = JSON.parse(mockHttpClient.getLastRequest()?.body!);
      expect(body.certificateSerialNumber).toBe('018209160C631F1E');
    });

    it('supports filtering by expiresAfter', async () => {
      mockHttpClient.mockResponse({ certificates: [], hasMore: false });

      const service = new CertificateService(mockHttpClient as any, 'test');

      await service.queryCertificates('token', {
        expiresAfter: '2026-01-01T00:00:00+00:00'
      });

      const body = JSON.parse(mockHttpClient.getLastRequest()?.body!);
      expect(body.expiresAfter).toBe('2026-01-01T00:00:00+00:00');
    });
  });

  describe('environment URLs', () => {
    it('uses test environment URL', async () => {
      mockHttpClient.mockResponse({ canRequest: true, enrollment: { limit: 1, remaining: 1 }, certificate: { limit: 1, remaining: 1 } });

      const service = new CertificateService(mockHttpClient as any, 'test');
      await service.getLimits('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api-test.ksef.mf.gov.pl');
    });

    it('uses prod environment URL', async () => {
      mockHttpClient.mockResponse({ canRequest: true, enrollment: { limit: 1, remaining: 1 }, certificate: { limit: 1, remaining: 1 } });

      const service = new CertificateService(mockHttpClient as any, 'prod');
      await service.getLimits('token');

      const request = mockHttpClient.getLastRequest();
      expect(request?.url).toContain('api.ksef.mf.gov.pl');
    });
  });
});
