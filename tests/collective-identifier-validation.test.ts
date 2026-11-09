import { describe, it, expect } from 'vitest';
import { validateCollectiveIdentifier } from '../src/index.js';

const official = '1111111111-IZ202607-65ED02180000-E7';
describe('collective identifier format and CRC-8', () => {
  it.each([
    official,
    '1111111111-IZ202601-000000000000-DD',
    '1111111111-IZ202612-FFFFFFFFFFFF-5D',
    '1111111111-IZ202607-000000000098-08'
  ])('accepts format and independent checksum vector: %s', (value) => {
    expect(validateCollectiveIdentifier(value)).toBe(true);
  });
  it.each([
    '', '1111111111-IZ202607-000000000098-08\n',
    '1111111111-IZ202600-65ED02180000-52',
    '1111111111-IZ202613-65ED02180000-CF',
    '1111111111-IZ000007-65ED02180000-5C',
    official + ' ', ' ' + official, official.toLowerCase(), official.slice(1),
    official.replace('202607', '202600'), official.replace('202607', '202613'),
    official.replace('202607', '000007'), official.replace('IZ', 'IX'),
    official.replace('E7', 'E6'), official.replace('65ED', 'G5ED')
  ])('rejects malformed or corrupted identifiers: %s', (value) => {
    expect(validateCollectiveIdentifier(value)).toBe(false);
  });
  it('rejects a single changed digit in each data segment', () => {
    for (const index of [0, 5, 14, 16, 20, 29]) {
      const chars = official.split(''); chars[index] = chars[index] === '1' ? '2' : '1';
      expect(validateCollectiveIdentifier(chars.join(''))).toBe(false);
    }
  });
  it('returns false for non-string runtime inputs', () => {
    expect(validateCollectiveIdentifier(null as any)).toBe(false);
    expect(validateCollectiveIdentifier(123 as any)).toBe(false);
  });
});
