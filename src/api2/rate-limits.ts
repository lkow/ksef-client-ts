import type { RateLimitConfig } from '@/types/limits.js';
import { getRateLimitsForEndpoint, matchEndpointKey } from '@/types/limits.js';
import type { EffectiveApiRateLimits, RateLimitCategory, EffectiveApiRateLimitValues } from './types/rate-limits.js';

const ENDPOINT_CATEGORY_MAP: Record<string, RateLimitCategory> = {
  'POST /sessions/online': 'onlineSession',
  'POST /sessions/online/*/close': 'onlineSessionClose',
  'POST /sessions/batch': 'batchSession',
  'POST /sessions/batch/*/close': 'batchSessionClose',
  'POST /sessions/online/*/invoices': 'invoiceSend',
  'GET /sessions/*/invoices/*': 'invoiceStatus',
  'GET /sessions': 'sessionList',
  'GET /sessions/*/invoices': 'sessionInvoiceList',
  'GET /sessions/*/invoices/failed': 'sessionInvoiceList',
  'GET /sessions/*': 'sessionMisc',
  'POST /invoices/query/metadata': 'invoiceMetadata',
  'POST /invoices/exports': 'invoiceExport',
  'GET /invoices/exports/*': 'invoiceExportStatus',
  'GET /invoices/ksef/*': 'invoiceDownload',
  'POST /collective-identifiers': 'collectiveIdentifier',
  'POST /collective-identifiers/query': 'collectiveIdentifier',
  'POST /collective-identifiers/invoices': 'collectiveIdentifier',
  'GET /collective-identifiers/ksef/*': 'collectiveIdentifier',
  'GET /security/public-key-certificates': 'anonymous',
  'GET /peppol/query': 'anonymous',
  'POST /auth/challenge': 'anonymous',
  'POST /auth/xades-signature': 'anonymous',
  'POST /auth/ksef-token': 'anonymous'
};

export function mapEndpointToRateLimitCategory(
  method: string,
  path: string
): RateLimitCategory | undefined {
  const key = matchEndpointKey(method, path, Object.keys(ENDPOINT_CATEGORY_MAP));
  return key ? ENDPOINT_CATEGORY_MAP[key] : undefined;
}

export function buildRateLimitConfigFromCategory(
  category: RateLimitCategory,
  effectiveLimits: EffectiveApiRateLimits,
  baseConfig: RateLimitConfig
): RateLimitConfig {
  // Before API 2.8.0, opening and closing sessions shared a category.
  const values = effectiveLimits[category]
    ?? (category === 'onlineSessionClose' ? effectiveLimits.onlineSession : undefined)
    ?? (category === 'batchSessionClose' ? effectiveLimits.batchSession : undefined)
    ?? (category === 'anonymous' || category === 'collectiveIdentifier' ? effectiveLimits.other : undefined);
  if (!values) {
    return baseConfig;
  }
  return applyValuesToConfig(values, baseConfig);
}

export function getRateLimitConfigForEndpoint(
  method: string,
  path: string,
  options: {
    baseConfig?: RateLimitConfig;
    effectiveLimits?: EffectiveApiRateLimits;
  } = {}
): RateLimitConfig {
  const fallback = getRateLimitsForEndpoint(method, path, options.baseConfig);
  if (!options.effectiveLimits) {
    return fallback;
  }
  const category = mapEndpointToRateLimitCategory(method, path);
  return buildRateLimitConfigFromCategory(category ?? 'other', options.effectiveLimits, fallback);
}

function applyValuesToConfig(
  values: EffectiveApiRateLimitValues,
  baseConfig: RateLimitConfig
): RateLimitConfig {
  return {
    ...baseConfig,
    requestsPerSecond: values.perSecond === -1 ? Infinity : values.perSecond,
    requestsPerMinute: values.perMinute === -1 ? Infinity : values.perMinute,
    requestsPerHour: values.perHour === -1 ? Infinity : values.perHour
  };
}
