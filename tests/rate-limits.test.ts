import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_RATE_LIMITS } from '../src/types/limits.js';
import { RateLimiter } from '../src/utils/rate-limiter.js';
import openApi from '../docs/reference/ksef-api-v2-openapi.json';
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
    expect(mapEndpointToRateLimitCategory('POST', '/sessions/online/5F3/close')).toBe('onlineSessionClose');
    expect(mapEndpointToRateLimitCategory('GET', '/sessions/123/invoices/456')).toBe('invoiceStatus');
    expect(mapEndpointToRateLimitCategory('GET', '/unknown/endpoint')).toBeUndefined();
  });

  it.each([
    ['POST', '/sessions/online/REF/close', 'onlineSessionClose'],
    ['POST', '/sessions/batch/REF/close', 'batchSessionClose'],
    ['POST', '/auth/challenge', 'anonymous'],
    ['POST', '/auth/xades-signature', 'anonymous'],
    ['POST', '/auth/ksef-token', 'anonymous'],
    ['GET', '/security/public-key-certificates', 'anonymous'],
    ['GET', '/peppol/query', 'anonymous'],
    ['POST', '/collective-identifiers', 'collectiveIdentifier'],
    ['POST', '/collective-identifiers/query', 'collectiveIdentifier'],
    ['POST', '/collective-identifiers/invoices', 'collectiveIdentifier'],
    ['GET', '/collective-identifiers/ksef/NUMBER', 'collectiveIdentifier']
  ] as const)('uses the official category for %s %s', (method, path, category) => {
    const limits = openApi.paths['/rate-limits'].get.responses['200'].content['application/json'].example;
    const config = getRateLimitConfigForEndpoint(method, path, { effectiveLimits: limits });

    expect(mapEndpointToRateLimitCategory(method, path)).toBe(category);
    expect(config.requestsPerSecond).toBe(limits[category].perSecond);
    expect(config.requestsPerMinute).toBe(limits[category].perMinute === -1 ? Infinity : limits[category].perMinute);
    expect(config.requestsPerHour).toBe(limits[category].perHour === -1 ? Infinity : limits[category].perHour);
  });

  it.each([
    ['/sessions/online/REF/close', 'onlineSession'],
    ['/sessions/batch/REF/close', 'batchSession']
  ] as const)('keeps legacy limits for %s when close categories are absent', (path, category) => {
    const config = getRateLimitConfigForEndpoint('POST', path, { effectiveLimits: EFFECTIVE_LIMITS });
    expect(config.requestsPerSecond).toBe(EFFECTIVE_LIMITS[category].perSecond);
    expect(config.requestsPerMinute).toBe(EFFECTIVE_LIMITS[category].perMinute);
    expect(config.requestsPerHour).toBe(EFFECTIVE_LIMITS[category].perHour);
  });

  it('allows anonymous requests with unlimited minute/hour windows while enforcing the second limit', async () => {
    vi.useFakeTimers();
    try {
      const limits = openApi.paths['/rate-limits'].get.responses['200'].content['application/json'].example;
      const config = getRateLimitConfigForEndpoint('POST', '/auth/challenge', {
        baseConfig: { ...DEFAULT_RATE_LIMITS, enabled: true },
        effectiveLimits: limits
      });
      const limiter = new RateLimiter(config);
      for (let i = 0; i < limits.anonymous.perSecond; i++) {
        await expect(limiter.acquireToken()).resolves.toBeUndefined();
      }
      await expect(limiter.acquireToken()).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
      vi.advanceTimersByTime(1000);
      await expect(limiter.acquireToken()).resolves.toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  it.each(['/auth/challenge', '/collective-identifiers'])('keeps the legacy other limits for %s', (path) => {
    const config = getRateLimitConfigForEndpoint('POST', path, { effectiveLimits: EFFECTIVE_LIMITS });
    expect(config).toMatchObject({
      requestsPerSecond: EFFECTIVE_LIMITS.other.perSecond,
      requestsPerMinute: EFFECTIVE_LIMITS.other.perMinute,
      requestsPerHour: EFFECTIVE_LIMITS.other.perHour
    });
  });

  it('represents disabled global limits without applying them to an endpoint category', () => {
    const limits = openApi.paths['/rate-limits'].get.responses['200'].content['application/json'].example;
    const config = buildRateLimitConfigFromCategory('global', limits, DEFAULT_RATE_LIMITS);
    expect(config).toMatchObject({ requestsPerSecond: Infinity, requestsPerMinute: Infinity, requestsPerHour: Infinity });
    expect(getRateLimitConfigForEndpoint('POST', '/invoices/exports', { effectiveLimits: limits }).requestsPerSecond)
      .toBe(limits.invoiceExport.perSecond);
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
