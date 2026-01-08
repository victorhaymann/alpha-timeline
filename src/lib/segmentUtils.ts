import { format } from 'date-fns';
import { clampToProjectBounds } from './dateValidation';
import { snapTaskToWorkingDays, convertLegacyMaskToLibFormat } from './workingDays';

interface NormalizeOptions {
  projectStartDate: Date;
  projectEndDate: Date;
  workingDaysMask: number; // Legacy format (Mon=1, Tue=2, etc.)
}

/**
 * Central utility for normalizing segment dates.
 * Applies consistent rules across all segment manipulation paths:
 * 1. Clamps to project boundaries
 * 2. Snaps to working days (preserves duration)
 * 3. Re-clamps after snapping
 * 
 * Use this for ALL segment date updates: drag, resize, inline edit, dialog edit.
 */
export function normalizeSegmentDates(
  startDate: Date,
  endDate: Date,
  options: NormalizeOptions
): { start_date: string; end_date: string } {
  const { projectStartDate, projectEndDate, workingDaysMask } = options;
  const libMask = convertLegacyMaskToLibFormat(workingDaysMask);
  
  // 1. Clamp to project boundaries first
  let clampedStart = clampToProjectBounds(startDate, projectStartDate, projectEndDate);
  let clampedEnd = clampToProjectBounds(endDate, projectStartDate, projectEndDate);
  
  // Ensure start <= end after clamping
  if (clampedStart > clampedEnd) {
    clampedStart = clampedEnd;
  }
  
  // 2. Snap to working days (preserves working-day duration)
  const snapped = snapTaskToWorkingDays(clampedStart, clampedEnd, libMask);
  
  // 3. Re-clamp after snapping (in case snapping pushed beyond bounds)
  const finalStart = clampToProjectBounds(snapped.start, projectStartDate, projectEndDate);
  const finalEnd = clampToProjectBounds(snapped.end, projectStartDate, projectEndDate);
  
  return {
    start_date: format(finalStart, 'yyyy-MM-dd'),
    end_date: format(finalEnd, 'yyyy-MM-dd'),
  };
}

/**
 * Creates normalized dates for a new segment, clamping to project bounds
 * and snapping to working days.
 */
export function createNormalizedSegmentDates(
  startDate: Date,
  endDate: Date,
  options: NormalizeOptions
): { start_date: string; end_date: string } {
  // Reuse the same normalization logic
  return normalizeSegmentDates(startDate, endDate, options);
}
