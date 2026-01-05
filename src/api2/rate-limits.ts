import type { RateLimitConfig } from '@/types/limits.js';
import { getRateLimitsForEndpoint, matchEndpointKey } from '@/types/limits.js';
import type { EffectiveApiRateLimits, RateLimitCategory, EffectiveApiRateLimitValues } from './types/rate-limits.js';

const ENDPOINT_CATEGORY_MAP: Record<string, RateLimitCategory> = {
  'POST /sessions/online': 'onlineSession',
  'POST /sessions/online/*/close': 'onlineSession',
  'POST /sessions/batch': 'batchSession',
  'POST /sessions/batch/*/close': 'batchSession',
  'POST /sessions/online/*/invoices': 'invoiceSend',
  'GET /sessions/*/invoices/*': 'invoiceStatus',
  'GET /sessions': 'sessionList',
  'GET /sessions/*/invoices': 'sessionInvoiceList',
  'GET /sessions/*/invoices/failed': 'sessionInvoiceList',
  'GET /sessions/*': 'sessionMisc',
  'POST /invoices/query/metadata': 'invoiceMetadata',
  'POST /invoices/exports': 'invoiceExport',
  'GET /invoices/exports/*': 'invoiceExportStatus',
  'GET /invoices/ksef/*': 'invoiceDownload'
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
  const values = effectiveLimits[category];
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
  if (!category) {
    const otherValues = options.effectiveLimits.other;
    return otherValues ? applyValuesToConfig(otherValues, fallback) : fallback;
  }
  const categoryValues = options.effectiveLimits[category];
  return categoryValues ? applyValuesToConfig(categoryValues, fallback) : fallback;
}

function applyValuesToConfig(
  values: EffectiveApiRateLimitValues,
  baseConfig: RateLimitConfig
): RateLimitConfig {
  return {
    ...baseConfig,
    requestsPerSecond: values.perSecond,
    requestsPerMinute: values.perMinute,
    requestsPerHour: values.perHour
  };
}
