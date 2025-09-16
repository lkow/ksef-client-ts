/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateNIP,
  validatePESEL,
  validateContextIdentifier,
  validateInvoiceXML,
  validateDateFormat,
  validateDateRange,
  formatNIP,
  formatPESEL
} from '../src/utils/validation.js';
import { ValidationError } from '../src/types/common.js';

describe('Validation Utils', () => {
  describe('validateNIP', () => {
    it('should validate correct NIP', () => {
      // Test with a valid NIP (5260001246 is a commonly used test NIP)
      expect(validateNIP('5260001246')).toBe(true);
      expect(validateNIP('526-000-12-46')).toBe(true); // with formatting
    });

    it('should reject invalid NIP', () => {
      expect(validateNIP('1234567890')).toBe(false);
      expect(validateNIP('123456789')).toBe(false); // too short
      expect(validateNIP('12345678901')).toBe(false); // too long
      expect(validateNIP('')).toBe(false);
    });
  });

  describe('validatePESEL', () => {
    it('should validate correct PESEL', () => {
      // Test with a valid PESEL (44051401359 is a commonly used test PESEL)
      expect(validatePESEL('44051401359')).toBe(true);
      expect(validatePESEL('440514-01359')).toBe(true); // with formatting
    });

    it('should reject invalid PESEL', () => {
      expect(validatePESEL('12345678901')).toBe(false);
      expect(validatePESEL('1234567890')).toBe(false); // too short
      expect(validatePESEL('123456789012')).toBe(false); // too long
      expect(validatePESEL('')).toBe(false);
    });
  });

  describe('validateContextIdentifier', () => {
    it('should validate correct context identifiers', () => {
      expect(() => validateContextIdentifier({
        type: 'onip',
        value: '5260001246'
      })).not.toThrow();

      expect(() => validateContextIdentifier({
        type: 'pesel',
        value: '44051401359'
      })).not.toThrow();
    });

    it('should reject invalid context identifiers', () => {
      expect(() => validateContextIdentifier({
        type: 'onip',
        value: '1234567890'
      })).toThrow(ValidationError);

      expect(() => validateContextIdentifier({
        type: 'unknown' as any,
        value: '1234567890'
      })).toThrow(ValidationError);

      expect(() => validateContextIdentifier({} as any)).toThrow(ValidationError);
    });
  });

  describe('validateInvoiceXML', () => {
    it('should validate basic XML structure', () => {
      const validXML = `<?xml version="1.0" encoding="UTF-8"?>
<Fa>
  <Naglowek>
    <KodFormularza>FA(3)</KodFormularza>
  </Naglowek>
  <Podmiot1>
    <DaneIdentyfikacyjne>
      <NIP>5260001246</NIP>
    </DaneIdentyfikacyjne>
  </Podmiot1>
  <Fa1>
    <P_1>2024-01-15</P_1>
  </Fa1>
</Fa>`;

      expect(() => validateInvoiceXML(validXML)).not.toThrow();
    });

    it('should reject invalid XML', () => {
      expect(() => validateInvoiceXML('')).toThrow(ValidationError);
      expect(() => validateInvoiceXML('not xml')).toThrow(ValidationError);
      expect(() => validateInvoiceXML('<incomplete')).toThrow(ValidationError);
    });
  });

  describe('validateDateFormat', () => {
    it('should validate ISO 8601 dates', () => {
      expect(validateDateFormat('2024-01-15T10:30:00Z')).toBe(true);
      expect(validateDateFormat('2024-01-15T10:30:00.123Z')).toBe(true);
      expect(validateDateFormat('2024-01-15T10:30:00')).toBe(true);
    });

    it('should reject invalid date formats', () => {
      expect(validateDateFormat('2024-01-15')).toBe(false);
      expect(validateDateFormat('15/01/2024')).toBe(false);
      expect(validateDateFormat('invalid')).toBe(false);
    });
  });

  describe('validateDateRange', () => {
    it('should validate correct date ranges', () => {
      expect(() => validateDateRange(
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      )).not.toThrow();
    });

    it('should reject invalid date ranges', () => {
      expect(() => validateDateRange(
        '2024-01-31T23:59:59Z',
        '2024-01-01T00:00:00Z'
      )).toThrow(ValidationError);

      expect(() => validateDateRange(
        '2024-01-01T00:00:00Z',
        '2025-01-02T00:00:00Z'
      )).toThrow(ValidationError); // More than 1 year
    });
  });

  describe('formatNIP', () => {
    it('should format NIP correctly', () => {
      expect(formatNIP('5260001246')).toBe('526-000-12-46');
      expect(formatNIP('526-000-12-46')).toBe('526-000-12-46');
    });
  });

  describe('formatPESEL', () => {
    it('should format PESEL correctly', () => {
      expect(formatPESEL('44051401359')).toBe('440514-01359');
      expect(formatPESEL('440514-01359')).toBe('440514-01359');
    });
  });
}); 