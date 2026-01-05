import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimitsService } from '../../src/api2/services/rate-limits.js';
import { createMockHttpClient } from '../helpers/mock-http-client.js';

describe('RateLimitsService', () => {
  const mockHttpClient = createMockHttpClient();

  beforeEach(() => {
    mockHttpClient.reset();
  });

  it('calls GET /rate-limits', async () => {
    mockHttpClient.mockResponse({
      onlineSession: { perSecond: 10, perMinute: 20, perHour: 30 },
      batchSession: { perSecond: 10, perMinute: 20, perHour: 30 },
      invoiceSend: { perSecond: 10, perMinute: 20, perHour: 30 },
      invoiceStatus: { perSecond: 10, perMinute: 20, perHour: 30 },
      sessionList: { perSecond: 10, perMinute: 20, perHour: 30 },
      sessionInvoiceList: { perSecond: 10, perMinute: 20, perHour: 30 },
      sessionMisc: { perSecond: 10, perMinute: 20, perHour: 30 },
      invoiceMetadata: { perSecond: 10, perMinute: 20, perHour: 30 },
      invoiceExport: { perSecond: 10, perMinute: 20, perHour: 30 },
      invoiceExportStatus: { perSecond: 10, perMinute: 20, perHour: 30 },
      invoiceDownload: { perSecond: 10, perMinute: 20, perHour: 30 },
      other: { perSecond: 10, perMinute: 20, perHour: 30 }
    });

    const service = new RateLimitsService(mockHttpClient as any, 'test');

    await service.getEffectiveLimits('token');

    const request = mockHttpClient.getLastRequest();
    expect(request?.method).toBe('GET');
    expect(request?.url).toContain('/rate-limits');
    expect(request?.headers?.['Authorization']).toBe('Bearer token');
  });

  it('calls GET /limits/context', async () => {
    mockHttpClient.mockResponse({
      onlineSession: {
        maxInvoiceSizeInMB: 50,
        maxInvoiceWithAttachmentSizeInMB: 100,
        maxInvoices: 500
      },
      batchSession: {
        maxInvoiceSizeInMB: 50,
        maxInvoiceWithAttachmentSizeInMB: 100,
        maxInvoices: 500
      }
    });

    const service = new RateLimitsService(mockHttpClient as any, 'test');

    await service.getContextLimits('token');

    const request = mockHttpClient.getLastRequest();
    expect(request?.method).toBe('GET');
    expect(request?.url).toContain('/limits/context');
  });

  it('calls GET /limits/subject', async () => {
    mockHttpClient.mockResponse({
      enrollment: { maxEnrollments: 3 },
      certificate: { maxCertificates: 2 }
    });

    const service = new RateLimitsService(mockHttpClient as any, 'test');

    await service.getSubjectLimits('token');

    const request = mockHttpClient.getLastRequest();
    expect(request?.method).toBe('GET');
    expect(request?.url).toContain('/limits/subject');
  });

  it('uses correct base URL for environment', async () => {
    mockHttpClient.mockResponse({
      onlineSession: { perSecond: 1, perMinute: 1, perHour: 1 },
      batchSession: { perSecond: 1, perMinute: 1, perHour: 1 },
      invoiceSend: { perSecond: 1, perMinute: 1, perHour: 1 },
      invoiceStatus: { perSecond: 1, perMinute: 1, perHour: 1 },
      sessionList: { perSecond: 1, perMinute: 1, perHour: 1 },
      sessionInvoiceList: { perSecond: 1, perMinute: 1, perHour: 1 },
      sessionMisc: { perSecond: 1, perMinute: 1, perHour: 1 },
      invoiceMetadata: { perSecond: 1, perMinute: 1, perHour: 1 },
      invoiceExport: { perSecond: 1, perMinute: 1, perHour: 1 },
      invoiceExportStatus: { perSecond: 1, perMinute: 1, perHour: 1 },
      invoiceDownload: { perSecond: 1, perMinute: 1, perHour: 1 },
      other: { perSecond: 1, perMinute: 1, perHour: 1 }
    });

    const service = new RateLimitsService(mockHttpClient as any, 'prod');
    await service.getEffectiveLimits('token');

    const request = mockHttpClient.getLastRequest();
    expect(request?.url).toContain('api.ksef.mf.gov.pl');
  });
});
