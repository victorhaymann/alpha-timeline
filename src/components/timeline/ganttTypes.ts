import { Task, Phase, TaskSegment, SegmentType } from '@/types/database';

// View mode types
export type ViewMode = 'week' | 'month' | 'project';

// Column representation for the timeline
export interface Column {
  key: string;
  label: string;
  subLabel: string;
  days: Date[];
  startDate: Date;
  endDate: Date;
  weekNumber: number;
}

// Month grouping for header
export interface MonthGroup {
  monthDate: Date;
  monthLabel: string;
  startIndex: number;
  count: number;
}

// Week grouping for header
export interface WeekGroup {
  weekLabel: string;
  startIndex: number;
  count: number;
  weekNumber: number;
}

// Section types for organizing the Gantt chart
export type Section = { 
  type: 'phase'; 
  phase: Phase; 
  tasks: Task[];
} | { type: 'weekly-call'; task: Task };

// Layout constants
export const ROW_HEIGHT = 40;
export const MONTH_ROW_HEIGHT = 24;
export const WEEK_ROW_HEIGHT = 24;
export const DAY_ROW_HEIGHT = 36;
export const HEADER_HEIGHT = MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT + DAY_ROW_HEIGHT; // 84
export const PHASE_HEADER_HEIGHT = 36;
export const PHASE_SEPARATOR_HEIGHT = 24;
export const TASK_COLUMN_WIDTH_DESKTOP = 340;
export const TASK_COLUMN_WIDTH_MOBILE = 160;
export const MIN_COLUMN_WIDTH = 36;
export const MIN_COLUMN_WIDTH_MOBILE = 28;
export const REVIEW_SUB_ROW_HEIGHT = 28;

// Reasonable date boundaries to prevent crashes from corrupted data
export const MIN_REASONABLE_YEAR = 1950;
export const MAX_REASONABLE_YEAR = 2125;
