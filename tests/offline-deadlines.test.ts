import { describe, it, expect } from 'vitest';
import { calculateOfflineDeadline, extendDeadlineForMaintenance, isOfflineInvoiceExpired, getTimeUntilDeadline } from '../src/index.js';

const window = { id: 'fixture', startTime: '2026-11-06T00:00:00Z', endTime: '2026-11-06T12:00:00Z', planned: false, active: false };

describe('KSeF offline submission dates in Europe/Warsaw', () => {
  it.each([
    ['2026-11-06T12:00:00Z', '2026-11-09T22:59:59.999Z'],
    ['2026-11-10T12:00:00Z', '2026-11-12T22:59:59.999Z'],
    ['2026-12-23T12:00:00Z', '2026-12-28T22:59:59.999Z'],
    ['2026-04-03T12:00:00Z', '2026-04-07T21:59:59.999Z'],
    ['2026-06-03T12:00:00Z', '2026-06-05T21:59:59.999Z'],
    ['2026-03-27T12:00:00Z', '2026-03-30T21:59:59.999Z'],
    ['2026-10-23T12:00:00Z', '2026-10-26T22:59:59.999Z'],
    ['2026-11-08T23:30:00Z', '2026-11-10T22:59:59.999Z']
  ])('uses the next business day for issue time %s', (issuedAt, expected) => {
    expect(calculateOfflineDeadline('offline24', new Date(issuedAt))?.toISOString()).toBe(expected);
  });

  it('uses the next business day after scheduled unavailability ends', () => {
    expect(calculateOfflineDeadline('offline', new Date('2026-11-01T00:00:00Z'), window)?.toISOString()).toBe('2026-11-09T22:59:59.999Z');
  });

  it('counts seven business days from the end of an outage', () => {
    expect(calculateOfflineDeadline('awaryjny', new Date('2026-11-01T00:00:00Z'), window)?.toISOString()).toBe('2026-11-18T22:59:59.999Z');
  });

  it.each(['offline', 'awaryjny'] as const)('requires a known end for %s rather than guessing a deadline', (mode) => {
    expect(() => calculateOfflineDeadline(mode)).toThrow(/end/);
  });

  it('does not require submission following total failure', () => {
    expect(calculateOfflineDeadline('awaria_calkowita')).toBeNull();
    expect(isOfflineInvoiceExpired(null)).toBe(false);
    expect(getTimeUntilDeadline(null)).toBe(Infinity);
  });

  it('extends offline24 after an unplanned outage without shortening an existing deadline', () => {
    expect(extendDeadlineForMaintenance(new Date('2026-11-09T22:59:59.999Z'), window)?.toISOString()).toBe('2026-11-18T22:59:59.999Z');
    const later = new Date('2026-12-01T00:00:00Z');
    expect(extendDeadlineForMaintenance(later, window)).toEqual(later);
    expect(extendDeadlineForMaintenance(null, window)).toBeNull();
  });

  it('rejects an invalid date', () => {
    expect(() => calculateOfflineDeadline('offline24', new Date('invalid'))).toThrow(/date/i);
  });
  it('removes the submission obligation when a total failure is announced', () => {
    expect(extendDeadlineForMaintenance(new Date('2026-11-09T22:59:59.999Z'), { ...window, mode: 'awaria_calkowita' })).toBeNull();
  });

  it('does not revive an expired deadline with a later announcement', () => {
    const due = new Date('2026-11-05T22:59:59.999Z');
    expect(extendDeadlineForMaintenance(due, window)).toEqual(due);
  });

  it('requires the actual end of an outage when extending a deadline', () => {
    const { endTime: _endTime, ...ongoing } = window;
    expect(() => extendDeadlineForMaintenance(new Date('2026-11-09T22:59:59.999Z'), ongoing)).toThrow(/end/);
  });

  it('applies a later announcement type when calculating an outage deadline', () => {
    expect(calculateOfflineDeadline('offline', new Date('2026-11-01T00:00:00Z'), { ...window, mode: 'awaryjny' })?.toISOString()).toBe('2026-11-18T22:59:59.999Z');
    expect(calculateOfflineDeadline('offline', new Date('2026-11-01T00:00:00Z'), { ...window, mode: 'awaria_calkowita' })).toBeNull();
  });

  it('ignores an outage that finished before an offline24 invoice was issued', () => {
    expect(calculateOfflineDeadline('offline24', new Date('2026-11-09T10:00:00Z'), window)?.toISOString()).toBe('2026-11-10T22:59:59.999Z');
  });

  it.each(['offline', 'awaryjny'] as const)('rejects a stale %s window that would predate invoice issuance', (mode) => {
    expect(() => calculateOfflineDeadline(mode, new Date('2026-11-09T10:00:00Z'), window)).toThrow(/before/);
  });

  it('does not extend offline24 for scheduled maintenance', () => {
    expect(calculateOfflineDeadline('offline24', new Date('2026-11-06T01:00:00Z'), {
      ...window, planned: true, endTime: '2026-11-17T12:00:00Z'
    })?.toISOString()).toBe('2026-11-09T22:59:59.999Z');
  });

  it('compares P_1 as a Warsaw calendar day when an outage ends just after local midnight', () => {
    const overnight = { ...window, startTime: '2026-11-08T22:00:00Z', endTime: '2026-11-08T23:30:00Z' };
    expect(calculateOfflineDeadline('awaryjny', new Date('2026-11-09'), overnight)?.toISOString()).toBe('2026-11-19T22:59:59.999Z');
    expect(calculateOfflineDeadline('offline24', new Date('2026-11-09'), overnight)?.toISOString()).toBe('2026-11-19T22:59:59.999Z');
  });

});
