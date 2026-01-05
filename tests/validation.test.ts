import { describe, expect, it } from 'vitest';
import {
  validateApiV2ContextIdentifier,
  validateApiV2IndirectTargetIdentifier,
  validateApiV2SubjectIdentifier,
  validateFingerprint,
  validateIdDocument,
  validateInternalId,
  validateIsoCountryCode,
  validateNIP,
  validateNipVatUe,
  validatePESEL,
  validatePeppolId
} from '../src/utils/validation.js';

describe('validation utilities', () => {
  it('validates NIP strictly', () => {
    expect(validateNIP('9876543210')).toBe(true);
    expect(validateNIP('9876543211')).toBe(false);
    expect(validateNIP('123-456-78-90')).toBe(false);
  });

  it('validates PESEL strictly', () => {
    expect(validatePESEL('99010112342')).toBe(true);
    expect(validatePESEL('9901011234')).toBe(false);
    expect(validatePESEL('99130112345')).toBe(false);
  });

  it('validates InternalId', () => {
    expect(validateInternalId('9876543210-12345')).toBe(true);
    expect(validateInternalId('9876543211-12345')).toBe(false);
    expect(validateInternalId('9876543210-1234')).toBe(false);
  });

  it('validates NipVatUe', () => {
    expect(validateNipVatUe('9876543210-DE123456789')).toBe(true);
    expect(validateNipVatUe('9876543210-PL')).toBe(false);
  });

  it('validates PeppolId', () => {
    expect(validatePeppolId('PPL123456')).toBe(true);
    expect(validatePeppolId('APL123456')).toBe(false);
  });

  it('validates fingerprints', () => {
    expect(validateFingerprint('A'.repeat(64))).toBe(true);
    expect(validateFingerprint('a'.repeat(64))).toBe(false);
  });

  it('validates ISO 3166-1 alpha-2 country codes', () => {
    expect(validateIsoCountryCode('PL')).toBe(true);
    expect(validateIsoCountryCode('ZZ')).toBe(false);
    expect(validateIsoCountryCode('pl')).toBe(false);
  });

  it('validates id documents', () => {
    expect(() => validateIdDocument({ type: 'ID', number: 'ABC123', country: 'PL' })).not.toThrow();
    expect(() => validateIdDocument({ type: 'ID', number: 'ABC123', country: 'ZZ' })).toThrow();
  });

  it('validates API v2 context identifiers', () => {
    expect(() => validateApiV2ContextIdentifier({ type: 'Nip', value: '9876543210' })).not.toThrow();
    expect(() => validateApiV2ContextIdentifier({ type: 'InternalId', value: '9876543210-12345' })).not.toThrow();
    expect(() => validateApiV2ContextIdentifier({ type: 'NipVatUe', value: '9876543210-DE123456789' })).not.toThrow();
    expect(() => validateApiV2ContextIdentifier({ type: 'PeppolId', value: 'PPL123456' })).not.toThrow();
    expect(() => validateApiV2ContextIdentifier({ type: 'Nip', value: '9876543211' })).toThrow();
  });

  it('validates API v2 subject identifiers', () => {
    expect(() => validateApiV2SubjectIdentifier({ type: 'Fingerprint', value: 'A'.repeat(64) })).not.toThrow();
    expect(() => validateApiV2SubjectIdentifier({ type: 'Fingerprint', value: 'a'.repeat(64) })).toThrow();
  });

  it('validates API v2 indirect target identifiers', () => {
    expect(() => validateApiV2IndirectTargetIdentifier({ type: 'AllPartners' })).not.toThrow();
    expect(() => validateApiV2IndirectTargetIdentifier({ type: 'AllPartners', value: '9876543210' })).toThrow();
    expect(() => validateApiV2IndirectTargetIdentifier({ type: 'Nip', value: '9876543210' })).not.toThrow();
    expect(() => validateApiV2IndirectTargetIdentifier({ type: 'InternalId', value: '9876543210-12345' })).not.toThrow();
  });
});
