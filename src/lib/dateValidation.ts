import { format, isAfter, isBefore, startOfDay } from 'date-fns';

/**
 * Clamps a date to be within project boundaries.
 * Returns the clamped date.
 */
export function clampToProjectBounds(
  date: Date,
  projectStart: Date,
  projectEnd: Date
): Date {
  const d = startOfDay(date);
  const start = startOfDay(projectStart);
  const end = startOfDay(projectEnd);

  if (isBefore(d, start)) return start;
  if (isAfter(d, end)) return end;
  return d;
}

/**
 * Validates and clamps a date range to project boundaries.
 * Ensures start <= end after clamping.
 */
export function clampDateRangeToProject(
  startDate: Date,
  endDate: Date,
  projectStart: Date,
  projectEnd: Date
): { start: Date; end: Date } {
  let start = clampToProjectBounds(startDate, projectStart, projectEnd);
  let end = clampToProjectBounds(endDate, projectStart, projectEnd);

  // Ensure start <= end
  if (isAfter(start, end)) {
    // If start is after end after clamping, set them equal
    start = end;
  }

  return { start, end };
}

/**
 * Formats dates for database storage after clamping to project bounds.
 */
export function clampAndFormatDates(
  startDate: Date | string,
  endDate: Date | string,
  projectStart: Date | string,
  projectEnd: Date | string
): { start_date: string; end_date: string } {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  const pStart = typeof projectStart === 'string' ? new Date(projectStart) : projectStart;
  const pEnd = typeof projectEnd === 'string' ? new Date(projectEnd) : projectEnd;

  const clamped = clampDateRangeToProject(start, end, pStart, pEnd);

  return {
    start_date: format(clamped.start, 'yyyy-MM-dd'),
    end_date: format(clamped.end, 'yyyy-MM-dd'),
  };
}
