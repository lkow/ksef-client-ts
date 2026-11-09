import { isIPv4 } from 'node:net';
import type { AuthorizationPolicy } from '../types/common.js';

/** Reject malformed restrictions rather than silently weakening the requested policy. */
export function validateAuthorizationPolicy(policy: AuthorizationPolicy): void {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new Error('Invalid IPv4 authorization policy');
  }
  const allowed = policy.allowedIps;
  if (allowed == null) throw new Error('Invalid IPv4 authorization policy: allowedIps requires at least one rule');
  if (typeof allowed !== 'object' || Array.isArray(allowed)) {
    throw new Error('Invalid IPv4 authorization policy: allowedIps');
  }
  const validators = {
    ip4Addresses: (value: string) => isIPv4(value),
    ip4Ranges: (value: string) => {
      const parts = value.split('-');
      return parts.length === 2 && parts.every(isIPv4)
        && ipv4Number(parts[0]!) <= ipv4Number(parts[1]!);
    },
    ip4Masks: (value: string) => {
      const [ip, mask, extra] = value.split('/');
      return extra === undefined && isIPv4(ip ?? '') && /^(?:[0-9]|[12][0-9]|3[0-2])$/.test(mask ?? '');
    }
  };
  let ruleCount = 0;
  for (const key of Object.keys(validators) as (keyof typeof validators)[]) {
    const values = allowed[key];
    if (values == null) continue;
    if (!Array.isArray(values) || values.length > 10
      || values.some(value => typeof value !== 'string' || !validators[key](value))) {
      throw new Error(`Invalid IPv4 authorization policy: ${key}`);
    }
    ruleCount += values.length;
  }
  if (ruleCount === 0) throw new Error('Invalid IPv4 authorization policy: at least one rule is required');
}

function ipv4Number(value: string): number {
  return value.split('.').reduce((result, part) => result * 256 + Number(part), 0);
}

export function authorizationPolicyXml(policy: AuthorizationPolicy): string {
  validateAuthorizationPolicy(policy);
  const allowed = policy.allowedIps;
  const addresses = (allowed?.ip4Addresses ?? []).map(value => `<Ip4Address>${value}</Ip4Address>`).join('');
  const ranges = (allowed?.ip4Ranges ?? []).map(value => `<Ip4Range>${value}</Ip4Range>`).join('');
  const masks = (allowed?.ip4Masks ?? []).map(value => `<Ip4Mask>${value}</Ip4Mask>`).join('');
  return `<AuthorizationPolicy><AllowedIps>${addresses}${ranges}${masks}</AllowedIps></AuthorizationPolicy>`;
}
