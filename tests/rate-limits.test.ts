import { describe, it, expect } from 'vitest';
import { DEFAULT_RATE_LIMITS } from '../src/types/limits.js';
import {
  mapEndpointToRateLimitCategory,
  getRateLimitConfigForEndpoint,
  buildRateLimitConfigFromCategory
} from '../src/api2/rate-limits.js';
import type { EffectiveApiRateLimits } from '../src/api2/types/rate-limits.js';

const EFFECTIVE_LIMITS: EffectiveApiRateLimits = {
  onlineSession: { perSecond: 11, perMinute: 31, perHour: 121 },
  batchSession: { perSecond: 12, perMinute: 22, perHour: 122 },
  invoiceSend: { perSecond: 13, perMinute: 33, perHour: 133 },
  invoiceStatus: { perSecond: 14, perMinute: 34, perHour: 134 },
  sessionList: { perSecond: 15, perMinute: 35, perHour: 135 },
  sessionInvoiceList: { perSecond: 16, perMinute: 36, perHour: 136 },
  sessionMisc: { perSecond: 17, perMinute: 37, perHour: 137 },
  invoiceMetadata: { perSecond: 18, perMinute: 38, perHour: 138 },
  invoiceExport: { perSecond: 19, perMinute: 39, perHour: 139 },
  invoiceExportStatus: { perSecond: 20, perMinute: 40, perHour: 140 },
  invoiceDownload: { perSecond: 21, perMinute: 41, perHour: 141 },
  other: { perSecond: 22, perMinute: 42, perHour: 142 }
};

describe('rate limit helpers', () => {
  it('maps endpoints to categories', () => {
    expect(mapEndpointToRateLimitCategory('POST', '/sessions/online')).toBe('onlineSession');
    expect(mapEndpointToRateLimitCategory('POST', '/sessions/online/5F3/close')).toBe('onlineSession');
    expect(mapEndpointToRateLimitCategory('GET', '/sessions/123/invoices/456')).toBe('invoiceStatus');
    expect(mapEndpointToRateLimitCategory('GET', '/unknown/endpoint')).toBeUndefined();
  });

  it('builds config overrides for categories', () => {
    const config = buildRateLimitConfigFromCategory('invoiceSend', EFFECTIVE_LIMITS, {
      ...DEFAULT_RATE_LIMITS,
      enabled: true
    });
    expect(config.requestsPerSecond).toBe(13);
    expect(config.requestsPerMinute).toBe(33);
    expect(config.requestsPerHour).toBe(133);
    expect(config.enabled).toBe(true);
  });

  it('overrides endpoint configs with effective limits', () => {
    const config = getRateLimitConfigForEndpoint('POST', '/sessions/online/XYZ/invoices', {
      baseConfig: { ...DEFAULT_RATE_LIMITS, enabled: true },
      effectiveLimits: EFFECTIVE_LIMITS
    });

    expect(config.requestsPerSecond).toBe(13);
    expect(config.requestsPerMinute).toBe(33);
    expect(config.requestsPerHour).toBe(133);
    expect(config.enabled).toBe(true);
  });

  it('falls back to other category when mapping missing', () => {
    const config = getRateLimitConfigForEndpoint('DELETE', '/not-documented', {
      baseConfig: { ...DEFAULT_RATE_LIMITS, enabled: true },
      effectiveLimits: EFFECTIVE_LIMITS
    });

    expect(config.requestsPerSecond).toBe(EFFECTIVE_LIMITS.other.perSecond);
  });
});
