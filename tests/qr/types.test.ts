import { describe, it, expect } from 'vitest';
import {
  formatDateForQR,
  toBase64URL,
  fromBase64URL,
  QR_BASE_URLS,
  CertificateType
} from '../../src/api2/qr/types.js';

describe('QR Types', () => {
  describe('formatDateForQR', () => {
    it('formats ISO date (YYYY-MM-DD) to DD-MM-YYYY', () => {
      expect(formatDateForQR('2024-01-15')).toBe('15-01-2024');
    });

    it('formats ISO date with time component', () => {
      expect(formatDateForQR('2024-12-25T10:30:00Z')).toBe('25-12-2024');
    });

    it('handles single digit day and month', () => {
      expect(formatDateForQR('2024-03-05')).toBe('05-03-2024');
    });

    it('throws for invalid date format', () => {
      expect(() => formatDateForQR('invalid-date')).toThrow('Invalid date format');
    });

    it('throws for empty string', () => {
      expect(() => formatDateForQR('')).toThrow('Invalid date format');
    });
  });

  describe('toBase64URL', () => {
    it('replaces + with -', () => {
      expect(toBase64URL('abc+def')).toBe('abc-def');
    });

    it('replaces / with _', () => {
      expect(toBase64URL('abc/def')).toBe('abc_def');
    });

    it('removes trailing = padding', () => {
      expect(toBase64URL('YWJj==')).toBe('YWJj');
    });

    it('handles all replacements together', () => {
      expect(toBase64URL('a+b/c==')).toBe('a-b_c');
    });

    it('returns unchanged string without special chars', () => {
      expect(toBase64URL('abcdef123')).toBe('abcdef123');
    });
  });

  describe('fromBase64URL', () => {
    it('replaces - with + and adds padding', () => {
      // 7 chars needs 1 padding char to make length divisible by 4
      expect(fromBase64URL('abc-def')).toBe('abc+def=');
    });

    it('replaces _ with / and adds padding', () => {
      // 7 chars needs 1 padding char to make length divisible by 4
      expect(fromBase64URL('abc_def')).toBe('abc/def=');
    });

    it('adds padding to make length divisible by 4', () => {
      const result = fromBase64URL('YWJj');
      expect(result.length % 4).toBe(0);
      expect(result).toBe('YWJj');
    });

    it('adds correct padding for length 2 mod 4', () => {
      const result = fromBase64URL('ab');
      expect(result).toBe('ab==');
    });

    it('adds correct padding for length 3 mod 4', () => {
      const result = fromBase64URL('abc');
      expect(result).toBe('abc=');
    });

    it('roundtrips with toBase64URL', () => {
      const original = 'a+b/c==';
      const encoded = toBase64URL(original);
      const decoded = fromBase64URL(encoded);
      // Note: padding may differ but encoded content is same
      expect(decoded.replace(/=+$/, '')).toBe(original.replace(/=+$/, ''));
    });
  });

  describe('QR_BASE_URLS', () => {
    it('has test environment URL', () => {
      expect(QR_BASE_URLS.test).toBe('https://qr-test.ksef.mf.gov.pl');
    });

    it('has demo environment URL', () => {
      expect(QR_BASE_URLS.demo).toBe('https://qr-demo.ksef.mf.gov.pl');
    });

    it('has prod environment URL', () => {
      expect(QR_BASE_URLS.prod).toBe('https://qr.ksef.mf.gov.pl');
    });
  });

  describe('CertificateType enum', () => {
    it('has AUTHENTICATION value', () => {
      expect(CertificateType.AUTHENTICATION).toBe('Authentication');
    });

    it('has OFFLINE value', () => {
      expect(CertificateType.OFFLINE).toBe('Offline');
    });
  });
});

