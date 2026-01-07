import { addDays, differenceInCalendarDays, getDay } from 'date-fns';

/**
 * Default working days mask: Monday-Friday (bits 1-5 set)
 * Bit 0 = Sunday, Bit 1 = Monday, ..., Bit 6 = Saturday
 */
export const DEFAULT_WORKING_DAYS_MASK = 0b0111110; // Mon-Fri

/**
 * Check if a date is a working day based on the mask
 */
export function isWorkingDay(date: Date, mask: number = DEFAULT_WORKING_DAYS_MASK): boolean {
  const dayOfWeek = getDay(date); // 0 = Sunday, 6 = Saturday
  return (mask & (1 << dayOfWeek)) !== 0;
}

/**
 * Find the next working day on or after the given date
 */
export function nextWorkingDay(date: Date, mask: number = DEFAULT_WORKING_DAYS_MASK): Date {
  let current = date;
  // Safety: max 7 iterations
  for (let i = 0; i < 7; i++) {
    if (isWorkingDay(current, mask)) {
      return current;
    }
    current = addDays(current, 1);
  }
  // Fallback: if mask is 0 (no working days), return original
  return date;
}

/**
 * Find the previous working day on or before the given date
 */
export function prevWorkingDay(date: Date, mask: number = DEFAULT_WORKING_DAYS_MASK): Date {
  let current = date;
  for (let i = 0; i < 7; i++) {
    if (isWorkingDay(current, mask)) {
      return current;
    }
    current = addDays(current, -1);
  }
  return date;
}

/**
 * Add N working days to a date (skipping non-working days)
 */
export function addWorkingDays(
  startDate: Date,
  days: number,
  mask: number = DEFAULT_WORKING_DAYS_MASK
): Date {
  if (days === 0) {
    return nextWorkingDay(startDate, mask);
  }

  let current = nextWorkingDay(startDate, mask);
  let remaining = Math.abs(days);
  const direction = days > 0 ? 1 : -1;

  while (remaining > 0) {
    current = addDays(current, direction);
    if (isWorkingDay(current, mask)) {
      remaining--;
    }
  }

  return current;
}

/**
 * Count working days between two dates (inclusive of both start and end)
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  mask: number = DEFAULT_WORKING_DAYS_MASK
): number {
  let count = 0;
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    if (isWorkingDay(current, mask)) {
      count++;
    }
    current = addDays(current, 1);
  }

  return count;
}

/**
 * Normalize a task's dates to ensure no weekends are included.
 * Preserves the calendar length as working-day length.
 * 
 * Example: Thu→Sun (4 calendar days) becomes Thu→Tue (4 working days)
 */
export function normalizeTaskDates(
  startDate: Date,
  endDate: Date,
  mask: number = DEFAULT_WORKING_DAYS_MASK
): { start: Date; end: Date; changed: boolean } {
  const originalStart = new Date(startDate);
  const originalEnd = new Date(endDate);
  
  // Calculate intended length in calendar days
  const intendedLength = differenceInCalendarDays(originalEnd, originalStart) + 1;
  
  // Snap start to next working day if needed
  const normalizedStart = nextWorkingDay(originalStart, mask);
  
  // For single-day tasks (milestones), end = start
  if (intendedLength <= 1) {
    const changed = normalizedStart.getTime() !== originalStart.getTime();
    return { start: normalizedStart, end: normalizedStart, changed };
  }
  
  // Add (intendedLength - 1) working days to get the end date
  const normalizedEnd = addWorkingDays(normalizedStart, intendedLength - 1, mask);
  
  const changed =
    normalizedStart.getTime() !== originalStart.getTime() ||
    normalizedEnd.getTime() !== originalEnd.getTime();

  return { start: normalizedStart, end: normalizedEnd, changed };
}

/**
 * Snap task dates to working days while preserving the working-day duration.
 * Use this for move/resize operations where the task was already correctly sized.
 * 
 * Example: A 3-working-day task moved to start on Saturday becomes Mon→Wed
 */
export function snapTaskToWorkingDays(
  startDate: Date,
  endDate: Date,
  mask: number = DEFAULT_WORKING_DAYS_MASK
): { start: Date; end: Date; changed: boolean } {
  const originalStart = new Date(startDate);
  const originalEnd = new Date(endDate);
  
  // Count the current working-day duration (what we want to preserve)
  const workingDayDuration = countWorkingDays(originalStart, originalEnd, mask);
  
  // Snap start to a working day
  const normalizedStart = nextWorkingDay(originalStart, mask);
  
  // If it's a single-day task or zero duration
  if (workingDayDuration <= 1) {
    const changed = normalizedStart.getTime() !== originalStart.getTime();
    return { start: normalizedStart, end: normalizedStart, changed };
  }
  
  // Calculate end by adding (workingDayDuration - 1) working days
  const normalizedEnd = addWorkingDays(normalizedStart, workingDayDuration - 1, mask);
  
  const changed =
    normalizedStart.getTime() !== originalStart.getTime() ||
    normalizedEnd.getTime() !== originalEnd.getTime();

  return { start: normalizedStart, end: normalizedEnd, changed };
}

/**
 * Check if a date range contains any non-working days
 */
export function hasNonWorkingDays(
  startDate: Date,
  endDate: Date,
  mask: number = DEFAULT_WORKING_DAYS_MASK
): boolean {
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    if (!isWorkingDay(current, mask)) {
      return true;
    }
    current = addDays(current, 1);
  }

  return false;
}
