import { useMemo, useCallback } from 'react';
import { 
  format, 
  startOfDay,
  eachDayOfInterval,
  isSameDay,
  getWeek,
  differenceInDays,
  addDays
} from 'date-fns';
import { 
  ViewMode, 
  Column, 
  MonthGroup, 
  WeekGroup,
  MIN_REASONABLE_YEAR,
  MAX_REASONABLE_YEAR,
  MIN_COLUMN_WIDTH,
} from './ganttTypes';

interface UseGanttCalculationsOptions {
  viewStart: Date;
  viewEnd: Date;
  workingDaysMask: number;
  viewMode: ViewMode;
  containerWidth: number;
  projectStartDate: Date;
  isMobile?: boolean;
}

// Validate date is a valid Date object
export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

// Check if a date is within reasonable bounds
export function isReasonableDate(date: Date | null | undefined): boolean {
  if (!date || !isValidDate(date)) return false;
  const year = date.getFullYear();
  return year >= MIN_REASONABLE_YEAR && year <= MAX_REASONABLE_YEAR;
}

// Safely parse a date string or Date, returning null if invalid or unreasonable
export function safeParseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (!isValidDate(value)) return null;
    if (!isReasonableDate(value)) {
      console.warn('GanttChart: Date outside reasonable range:', value);
      return null;
    }
    return value;
  }
  try {
    const parsed = new Date(value);
    if (!isValidDate(parsed)) return null;
    if (!isReasonableDate(parsed)) {
      console.warn('GanttChart: Parsed date outside reasonable range:', value, '->', parsed);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// Safe format with fallback
export function safeFormat(date: Date | null | undefined, formatStr: string, fallback = '—'): string {
  if (!date || !isValidDate(date)) return fallback;
  try {
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}

// Safe differenceInDays
export function safeDifferenceInDays(end: Date | null | undefined, start: Date | null | undefined): number | null {
  if (!end || !start || !isValidDate(end) || !isValidDate(start)) return null;
  try {
    return differenceInDays(end, start);
  } catch {
    return null;
  }
}

// Safe isSameDay
export function safeIsSameDay(date1: Date | null | undefined, date2: Date | null | undefined): boolean {
  if (!date1 || !date2 || !isValidDate(date1) || !isValidDate(date2)) return false;
  try {
    return isSameDay(date1, date2);
  } catch {
    return false;
  }
}

export function useGanttCalculations({
  viewStart,
  viewEnd,
  workingDaysMask,
  viewMode,
  containerWidth,
  projectStartDate,
  isMobile = false,
}: UseGanttCalculationsOptions) {
  // Check if day is a working day
  const isWorkingDay = useCallback((date: Date) => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    // Map JS day (0-6) to the old mask bit position
    const dayBit = dayOfWeek === 0 ? 64 : (1 << (dayOfWeek - 1));
    return (workingDaysMask & dayBit) !== 0;
  }, [workingDaysMask]);

  // Generate working days only within the view range
  const workingDays = useMemo(() => {
    try {
      if (!isValidDate(viewStart) || !isValidDate(viewEnd)) {
        console.warn('GanttChart: Invalid viewStart or viewEnd dates');
        return [];
      }
      if (viewStart > viewEnd) {
        console.warn('GanttChart: viewStart is after viewEnd');
        return [];
      }
      const allDays = eachDayOfInterval({ start: viewStart, end: viewEnd });
      return allDays.filter(day => isWorkingDay(day));
    } catch (error) {
      console.error('GanttChart: Error generating date interval:', error);
      return [];
    }
  }, [viewStart, viewEnd, isWorkingDay]);

  // Generate columns based on view mode
  const groupedColumns = useMemo((): Column[] => {
    if (viewMode === 'project') {
      // Project view: group by weeks, showing W1, W2, W3...
      const weekGroups: Map<number, { days: Date[]; weekIndex: number }> = new Map();
      let weekCounter = 1;
      
      workingDays.forEach(day => {
        const weekNum = getWeek(day);
        if (!weekGroups.has(weekNum)) {
          weekGroups.set(weekNum, { days: [], weekIndex: weekCounter++ });
        }
        weekGroups.get(weekNum)!.days.push(day);
      });
      
      return Array.from(weekGroups.entries()).map(([weekNum, { days, weekIndex }]) => ({
        key: `week-${weekNum}`,
        label: `W${weekIndex}`,
        subLabel: format(days[0], 'MMM d'),
        days,
        startDate: days[0],
        endDate: days[days.length - 1],
        weekNumber: weekNum,
      }));
    }
    
    // Weekly/Monthly views: show individual working days
    return workingDays.map(day => ({
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'd'),
      subLabel: format(day, 'EEE'),
      days: [day],
      startDate: day,
      endDate: day,
      weekNumber: getWeek(day),
    }));
  }, [workingDays, viewMode]);

  // Calculate columnWidth based on actual column count
  const columnWidth = useMemo(() => {
    const columnCount = groupedColumns.length || 1;
    const calculatedWidth = containerWidth / columnCount;
    
    // Set minimum widths based on view mode - smaller on mobile
    const minWidths = isMobile 
      ? { week: 28, month: 40, project: 12 }
      : { week: MIN_COLUMN_WIDTH, month: 60, project: 16 };
    return Math.max(calculatedWidth, minWidths[viewMode]);
  }, [containerWidth, groupedColumns.length, viewMode, isMobile]);

  // Create a map of unique week numbers to determine alternating pattern
  const weekAlternatingMap = useMemo(() => {
    const uniqueWeeks = [...new Set(groupedColumns.map(col => col.weekNumber))];
    const map: Record<number, boolean> = {};
    uniqueWeeks.forEach((week, index) => {
      map[week] = index % 2 === 1; // Odd index weeks get shaded
    });
    return map;
  }, [groupedColumns]);

  // Group columns by month for the month header row
  const monthGroups = useMemo((): MonthGroup[] => {
    const groups: MonthGroup[] = [];
    let currentMonthKey = '';
    let startIndex = 0;
    let count = 0;
    let currentMonthDate: Date | null = null;

    groupedColumns.forEach((col, index) => {
      const monthKey = safeFormat(col.startDate, 'yyyy-MM', 'unknown');
      if (monthKey !== currentMonthKey) {
        if (currentMonthKey && currentMonthDate) {
          groups.push({ 
            monthDate: currentMonthDate, 
            monthLabel: safeFormat(currentMonthDate, 'MMMM', 'Unknown'),
            startIndex, 
            count 
          });
        }
        currentMonthKey = monthKey;
        currentMonthDate = col.startDate;
        startIndex = index;
        count = 1;
      } else {
        count++;
      }
    });

    if (currentMonthKey && currentMonthDate) {
      groups.push({ 
        monthDate: currentMonthDate, 
        monthLabel: safeFormat(currentMonthDate, 'MMMM', 'Unknown'),
        startIndex, 
        count 
      });
    }

    return groups;
  }, [groupedColumns]);

  // Group columns by week for the week header row (W1, W2, etc. starting from project start)
  const weekGroups = useMemo((): WeekGroup[] => {
    const groups: WeekGroup[] = [];
    let currentWeekNum = -1;
    let startIndex = 0;
    let count = 0;
    let weekCounter = 0;

    groupedColumns.forEach((col, index) => {
      const weekNum = col.weekNumber;
      if (weekNum !== currentWeekNum) {
        if (currentWeekNum !== -1) {
          weekCounter++;
          groups.push({ weekLabel: `W${weekCounter}`, startIndex, count, weekNumber: currentWeekNum });
        }
        currentWeekNum = weekNum;
        startIndex = index;
        count = 1;
      } else {
        count++;
      }
    });

    if (currentWeekNum !== -1) {
      weekCounter++;
      groups.push({ weekLabel: `W${weekCounter}`, startIndex, count, weekNumber: currentWeekNum });
    }

    return groups;
  }, [groupedColumns]);

  // Calculate position from date (accounting for working days only)
  const dateToX = useCallback((date: Date) => {
    const targetDay = startOfDay(date);
    
    // If no columns, return 0
    if (groupedColumns.length === 0) return 0;
    
    const firstColStart = startOfDay(groupedColumns[0].startDate);
    const lastColEnd = startOfDay(groupedColumns[groupedColumns.length - 1].endDate);
    
    // If before first column, clamp to 0
    if (targetDay < firstColStart) {
      return 0;
    }
    
    // If after last column, clamp to end
    if (targetDay > lastColEnd) {
      return groupedColumns.length * columnWidth;
    }
    
    // Find which column this date falls into
    for (let i = 0; i < groupedColumns.length; i++) {
      const col = groupedColumns[i];
      const colStart = startOfDay(col.startDate);
      const colEnd = startOfDay(col.endDate);
      
      // Check if target falls within this column's date range
      if (targetDay >= colStart && targetDay <= colEnd) {
        // In project view with week columns, calculate position within the week
        if (viewMode === 'project' && col.days.length > 1) {
          const dayIndex = col.days.findIndex(d => isSameDay(startOfDay(d), targetDay));
          if (dayIndex >= 0) {
            const dayFraction = dayIndex / col.days.length;
            return i * columnWidth + dayFraction * columnWidth;
          }
        }
        return i * columnWidth;
      }
    }
    
    // If date is not a working day, find the next working day column
    for (let i = 0; i < groupedColumns.length; i++) {
      const colStart = startOfDay(groupedColumns[i].startDate);
      if (colStart > targetDay) {
        return i * columnWidth;
      }
    }
    
    return (groupedColumns.length - 1) * columnWidth;
  }, [groupedColumns, columnWidth, viewMode]);

  // Calculate date from position
  const xToDate = useCallback((x: number) => {
    const colIndex = Math.floor(x / columnWidth);
    const col = groupedColumns[Math.min(Math.max(0, colIndex), groupedColumns.length - 1)];
    
    // In project view with week columns, calculate which day within the week
    if (viewMode === 'project' && col && col.days.length > 1) {
      const withinColX = x - colIndex * columnWidth;
      const dayFraction = withinColX / columnWidth;
      const dayIndex = Math.min(Math.floor(dayFraction * col.days.length), col.days.length - 1);
      return col.days[dayIndex] || col.days[0];
    }
    
    return col?.days[0] || projectStartDate;
  }, [groupedColumns, columnWidth, projectStartDate, viewMode]);

  // Calculate task width (counting working days only, clamped to visible range)
  const getTaskWidth = useCallback((start: Date, end: Date) => {
    if (groupedColumns.length === 0) return columnWidth;
    
    const startDay = startOfDay(start);
    const endDay = startOfDay(end);
    
    const firstColStart = startOfDay(groupedColumns[0].startDate);
    const lastColEnd = startOfDay(groupedColumns[groupedColumns.length - 1].endDate);
    
    // Check if task overlaps with visible range at all
    if (endDay < firstColStart || startDay > lastColEnd) {
      return 0; // Task is completely outside visible range
    }
    
    // In project view with week columns, calculate precise width based on days
    if (viewMode === 'project') {
      let totalDays = 0;
      let taskDays = 0;
      
      for (const col of groupedColumns) {
        for (const day of col.days) {
          const d = startOfDay(day);
          totalDays++;
          if (d >= startDay && d <= endDay) {
            taskDays++;
          }
        }
      }
      
      if (taskDays === 0) return columnWidth;
      
      // Calculate width proportionally
      const totalWidth = groupedColumns.length * columnWidth;
      const widthPerDay = totalWidth / totalDays;
      return Math.max(widthPerDay, taskDays * widthPerDay);
    }
    
    // Weekly/Monthly views: count columns
    let startColIndex = 0;
    for (let i = 0; i < groupedColumns.length; i++) {
      const colStart = startOfDay(groupedColumns[i].startDate);
      if (isSameDay(colStart, startDay)) {
        startColIndex = i;
        break;
      } else if (colStart > startDay) {
        startColIndex = i;
        break;
      }
    }
    
    let endColIndex = groupedColumns.length - 1;
    for (let i = 0; i < groupedColumns.length; i++) {
      const colStart = startOfDay(groupedColumns[i].startDate);
      if (isSameDay(colStart, endDay)) {
        endColIndex = i;
        break;
      } else if (colStart > endDay) {
        endColIndex = Math.max(0, i - 1);
        break;
      }
    }
    
    return Math.max(columnWidth, (endColIndex - startColIndex + 1) * columnWidth);
  }, [groupedColumns, columnWidth, viewMode]);

  // Count working days between two dates (inclusive)
  const getWorkingDaysDuration = useCallback((start: Date, end: Date): number => {
    let count = 0;
    let current = startOfDay(start);
    const endDay = startOfDay(end);
    
    while (current <= endDay) {
      if (isWorkingDay(current)) {
        count++;
      }
      current = addDays(current, 1);
    }
    
    return count;
  }, [isWorkingDay]);

  return {
    workingDays,
    groupedColumns,
    columnWidth,
    weekAlternatingMap,
    monthGroups,
    weekGroups,
    dateToX,
    xToDate,
    getTaskWidth,
    isWorkingDay,
    getWorkingDaysDuration,
  };
}
