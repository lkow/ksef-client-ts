import type { MaintenanceWindow, OfflineMode } from './types.js';

const warsawDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit', day: '2-digit'
});

/**
 * Use the invoice's issue date (P_1), not the time the SDK received it.
 * Returns the end of the due business day in Poland, or null for total failure.
 * An outage with an unknown end has no calculable deadline yet and throws.
 */
export function calculateOfflineDeadline(
  mode: OfflineMode,
  generatedAt: Date = new Date(),
  maintenanceWindow?: MaintenanceWindow
): Date | null {
  if (mode === 'awaria_calkowita') return null;
  if (!Number.isFinite(generatedAt.getTime())) throw new Error('Invalid issue date');
  if (mode === 'offline24') {
    const deadline = businessDayDeadline(generatedAt, 1);
    return maintenanceWindow ? extendDeadlineForMaintenance(deadline, maintenanceWindow, generatedAt) : deadline;
  }
  if (mode !== 'offline' && mode !== 'awaryjny') throw new Error(`Unknown offline mode: ${mode}`);
  if (maintenanceWindow?.endTime && calendarDay(new Date(maintenanceWindow.endTime)) < calendarDay(generatedAt)) {
    throw new Error('The outage ended before the invoice issue date');
  }
  const announcementMode = maintenanceWindow?.mode ?? mode;
  if (announcementMode === 'awaria_calkowita') return null;
  if (!maintenanceWindow?.endTime) throw new Error('A known outage end time is required to calculate the deadline');
  return businessDayDeadline(new Date(maintenanceWindow.endTime), announcementMode === 'awaryjny' ? 7 : 1);
}

/** Apply a failure announcement overlapping the submission period. Never restore a removed obligation. */
export function extendDeadlineForMaintenance(
  currentDeadline: Date | null,
  maintenanceWindow: MaintenanceWindow,
  periodStart?: Date
): Date | null {
  if (currentDeadline === null) return null;
  if (!Number.isFinite(currentDeadline.getTime())) throw new Error('Invalid deadline date');
  const start = new Date(maintenanceWindow.startTime);
  if (!Number.isFinite(start.getTime())) throw new Error('Invalid maintenance start date');
  if (start > currentDeadline) return currentDeadline;
  if (periodStart) {
    if (!Number.isFinite(periodStart.getTime())) throw new Error('Invalid period start date');
    if (maintenanceWindow.endTime && calendarDay(new Date(maintenanceWindow.endTime)) < calendarDay(periodStart)) return currentDeadline;
  }
  const mode = maintenanceWindow.mode ?? (maintenanceWindow.planned ? 'offline' : 'awaryjny');
  if (mode === 'awaria_calkowita') return null;
  if (mode === 'offline') return currentDeadline; // Scheduled maintenance does not extend offline24.
  if (!maintenanceWindow.endTime) throw new Error('A known outage end time is required to extend the deadline');
  const extended = calculateOfflineDeadline(mode, start, maintenanceWindow)!;
  return extended > currentDeadline ? extended : currentDeadline;
}

function calendarDay(anchor: Date): Date {
  if (!Number.isFinite(anchor.getTime())) throw new Error('Invalid anchor date');
  const parts = warsawDate.formatToParts(anchor);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)!.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

function businessDayDeadline(anchor: Date, days: number): Date {
  const day = calendarDay(anchor);
  while (days > 0) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (isBusinessDay(day)) days--;
  }
  // Convert the next Warsaw midnight to UTC. Noon is unambiguous on DST change days.
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', timeZoneName: 'longOffset' })
    .formatToParts(new Date(day.getTime() + 12 * 60 * 60 * 1000))
    .find(p => p.type === 'timeZoneName')!.value;
  const midnight = new Date(`${day.toISOString().slice(0, 10)}T00:00:00${offset.replace('GMT', '')}`);
  return new Date(midnight.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function isBusinessDay(day: Date): boolean {
  if (day.getUTCDay() === 0 || day.getUTCDay() === 6) return false;
  const year = day.getUTCFullYear();
  const date = day.toISOString().slice(5, 10);
  // Polish statutory holidays; Christmas Eve has been a holiday since 2025.
  if (['01-01', '01-06', '05-01', '05-03', '08-15', '11-01', '11-11', '12-25', '12-26'].includes(date)
    || (year >= 2025 && date === '12-24')) return false;
  const easter = easterSunday(year);
  const daysFromEaster = Math.round((day.getTime() - easter.getTime()) / 86_400_000);
  return daysFromEaster !== 1 && daysFromEaster !== 60; // Easter Monday and Corpus Christi.
}

/** Gregorian computus, used only for Poland's movable statutory holidays. */
function easterSunday(year: number): Date {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(Date.UTC(year, month - 1, (h + l - 7 * m + 114) % 31 + 1));
}
