import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Task, Phase, PhaseCategory, PHASE_CATEGORY_COLORS } from '@/types/database';
import { useDragAndResize } from '@/hooks/useDragAndResize';
import { useVerticalReorder } from '@/hooks/useVerticalReorder';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MeetingHoverCard } from './MeetingHoverCard';
import { 
  Flag, 
  Users, 
  GripVertical,
  Plus,
  RotateCcw,
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  HelpCircle
} from 'lucide-react';
import { 
  format, 
  differenceInDays, 
  addDays, 
  addMonths,
  subMonths,
  startOfDay,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  isSameDay,
  getWeek
} from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface GanttChartProps {
  projectId: string;
  projectStartDate: Date;
  projectEndDate: Date;
  phases: Phase[];
  tasks: Task[];
  workingDaysMask: number;
  checkinTime?: string | null;
  checkinDuration?: number | null;
  checkinTimezone?: string | null;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskReorder: (sourcePhaseId: string, targetPhaseId: string, taskId: string, newIndex: number) => void;
  onAddTask: (phaseId: string) => void;
  onAddReviewRound: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddMeeting?: () => void;
  onDeleteMeeting?: (taskId: string) => void;
  readOnly?: boolean;
}

type ViewMode = 'week' | 'month' | 'project';

// Responsive constants
const TASK_COLUMN_WIDTH_DESKTOP = 340;
const TASK_COLUMN_WIDTH_MOBILE = 160;
const ROW_HEIGHT = 40;
const MONTH_ROW_HEIGHT = 24;
const WEEK_ROW_HEIGHT = 24;
const DAY_ROW_HEIGHT = 36;
const HEADER_HEIGHT = MONTH_ROW_HEIGHT + WEEK_ROW_HEIGHT + DAY_ROW_HEIGHT; // 84
const PHASE_HEADER_HEIGHT = 36;
const MIN_COLUMN_WIDTH = 36;
const MIN_COLUMN_WIDTH_MOBILE = 28;

// Validate date is a valid Date object
function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}

// Safely parse a date string or Date, returning null if invalid
function safeParseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isValidDate(value) ? value : null;
  }
  try {
    const parsed = new Date(value);
    return isValidDate(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Safe format with fallback
function safeFormat(date: Date | null | undefined, formatStr: string, fallback = '—'): string {
  if (!date || !isValidDate(date)) return fallback;
  try {
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}

// Safe differenceInDays
function safeDifferenceInDays(end: Date | null | undefined, start: Date | null | undefined): number | null {
  if (!end || !start || !isValidDate(end) || !isValidDate(start)) return null;
  try {
    return differenceInDays(end, start);
  } catch {
    return null;
  }
}

// Safe isSameDay
function safeIsSameDay(date1: Date | null | undefined, date2: Date | null | undefined): boolean {
  if (!date1 || !date2 || !isValidDate(date1) || !isValidDate(date2)) return false;
  try {
    return isSameDay(date1, date2);
  } catch {
    return false;
  }
}

export function GanttChart({
  projectId,
  projectStartDate,
  projectEndDate,
  phases,
  tasks,
  workingDaysMask,
  checkinTime,
  checkinDuration,
  checkinTimezone,
  onTaskUpdate,
  onTaskReorder,
  onAddTask,
  onAddReviewRound,
  onDeleteTask,
  onAddMeeting,
  onDeleteMeeting,
  readOnly = false,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const leftBodyRef = useRef<HTMLDivElement>(null);
  const rightBodyRef = useRef<HTMLDivElement>(null);
  const rightHeaderRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Validate and fallback dates to prevent crashes
  const validStartDate = isValidDate(projectStartDate) ? projectStartDate : new Date();
  const validEndDate = isValidDate(projectEndDate) ? projectEndDate : addDays(validStartDate, 30);
  
  // Responsive task column width
  const taskColumnWidth = isMobile ? TASK_COLUMN_WIDTH_MOBILE : TASK_COLUMN_WIDTH_DESKTOP;
  
  // Default view: show entire project range for full scrolling
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: validStartDate,
    to: validEndDate,
  });
  const [containerWidth, setContainerWidth] = useState(800);
  
  // Track collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Slide animation state
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  
  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Handle starting task name edit
  const handleStartEdit = useCallback((taskId: string, currentName: string) => {
    if (readOnly) return;
    setEditingTaskId(taskId);
    setEditingTaskName(currentName);
  }, [readOnly]);

  // Handle saving task name edit
  const handleSaveEdit = useCallback(() => {
    if (editingTaskId && editingTaskName.trim()) {
      onTaskUpdate(editingTaskId, { name: editingTaskName.trim() });
    }
    setEditingTaskId(null);
    setEditingTaskName('');
  }, [editingTaskId, editingTaskName, onTaskUpdate]);

  // Handle cancelling task name edit
  const handleCancelEdit = useCallback(() => {
    setEditingTaskId(null);
    setEditingTaskName('');
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTaskId]);

  const toggleSectionCollapse = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  }, []);

  // View date range (use custom range or project range)
  const viewStart = dateRange?.from || validStartDate;
  const viewEnd = dateRange?.to || validEndDate;

  // Check if day is a working day
  const isWorkingDay = useCallback((date: Date) => {
    const dayOfWeek = date.getDay();
    const dayBit = dayOfWeek === 0 ? 64 : (1 << (dayOfWeek - 1));
    return (workingDaysMask & dayBit) !== 0;
  }, [workingDaysMask]);

  // Generate working days only within the view range (with try-catch for safety)
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
  const groupedColumns = useMemo(() => {
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
  // Store actual Date objects to avoid parsing formatted strings later
  const monthGroups = useMemo(() => {
    const groups: { monthDate: Date; monthLabel: string; startIndex: number; count: number }[] = [];
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
  const weekGroups = useMemo(() => {
    const groups: { weekLabel: string; startIndex: number; count: number; weekNumber: number }[] = [];
    let currentWeekNum = -1;
    let startIndex = 0;
    let count = 0;
    let weekCounter = 0;

    // Use validated date
    const firstMonday = startOfWeek(validStartDate, { weekStartsOn: 1 });

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
  }, [groupedColumns, validStartDate]);

  // Observe container width for responsive columns
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - taskColumnWidth;
        // Lower minimum on mobile to prevent negative/zero widths
        const minAvailable = isMobile ? 150 : 400;
        setContainerWidth(Math.max(availableWidth, minAvailable));
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, [taskColumnWidth, isMobile]);

  // Scroll synchronization handlers
  const handleLeftBodyScroll = useCallback(() => {
    if (isSyncingScroll.current || !leftBodyRef.current || !rightBodyRef.current) return;
    isSyncingScroll.current = true;
    rightBodyRef.current.scrollTop = leftBodyRef.current.scrollTop;
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  }, []);

  const handleRightBodyScroll = useCallback(() => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    
    if (leftBodyRef.current && rightBodyRef.current) {
      leftBodyRef.current.scrollTop = rightBodyRef.current.scrollTop;
    }
    if (rightHeaderRef.current && rightBodyRef.current) {
      rightHeaderRef.current.scrollLeft = rightBodyRef.current.scrollLeft;
    }
    
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  }, []);

  // Calculate responsive column width - fills available space
  const columnWidth = useMemo(() => {
    const columnCount = groupedColumns.length || 1;
    const calculatedWidth = containerWidth / columnCount;
    
    // Set minimum widths based on view mode - smaller on mobile
    const minWidths = isMobile 
      ? { week: MIN_COLUMN_WIDTH_MOBILE, month: 40, project: 12 }
      : { week: MIN_COLUMN_WIDTH, month: 60, project: 16 };
    return Math.max(calculatedWidth, minWidths[viewMode]);
  }, [containerWidth, groupedColumns.length, viewMode, isMobile]);

  const chartWidth = groupedColumns.length * columnWidth;

  // Drag and drop hook
  const {
    dragging,
    dragPreview,
    justDropped,
    isDraggingAny,
    handleDragStart,
    getDragClasses,
    getDragStyles,
    getDurationChange,
    getResizeHandleClasses,
    getGhostPosition,
    getDynamicTooltipInfo,
  } = useDragAndResize({
    columnWidth,
    onTaskUpdate,
    readOnly,
  });

  // Vertical reorder hook
  const {
    verticalDrag,
    isVerticalDragging,
    handleVerticalDragStart,
    handlePhaseHover,
    getVerticalDragClasses,
    getVerticalDragStyles,
    getSwapTargetClasses,
    getDropTargetPhaseClasses,
    getDropIndicatorStyle,
    getGhostInfo,
    getDragPreviewStyle,
    shouldShowInsertionGap,
  } = useVerticalReorder({
    rowHeight: ROW_HEIGHT,
    onReorder: onTaskReorder,
    readOnly,
  });

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    // All views show full project range - difference is in column display (days vs weeks)
    setDateRange({ from: validStartDate, to: validEndDate });
  }, [validStartDate, validEndDate]);

  // Navigate to previous/next period based on view mode
  const navigatePeriod = useCallback((direction: 'prev' | 'next') => {
    if (!dateRange?.from || !dateRange?.to) return;
    
    setSlideDirection(direction === 'prev' ? 'right' : 'left');
    
    // Clear slide direction after animation
    setTimeout(() => setSlideDirection(null), 350);
    
    let newFrom: Date;
    let newTo: Date;
    
    if (viewMode === 'week') {
      // Move by 1 week
      const shift = direction === 'prev' ? -7 : 7;
      newFrom = addDays(dateRange.from, shift);
      newTo = addDays(dateRange.to, shift);
    } else if (viewMode === 'month') {
      // Move by 1 month
      if (direction === 'prev') {
        newFrom = subMonths(dateRange.from, 1);
        newTo = subMonths(dateRange.to, 1);
      } else {
        newFrom = addMonths(dateRange.from, 1);
        newTo = addMonths(dateRange.to, 1);
      }
    } else {
      // Project view: no navigation needed, but allow scrolling if date range is custom
      return;
    }
    
    setDateRange({ from: newFrom, to: newTo });
  }, [dateRange, viewMode]);

  // Keyboard navigation for horizontal scrolling and period navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if Gantt chart is focused or no other input is focused
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                            activeElement?.tagName === 'TEXTAREA' ||
                            activeElement?.getAttribute('contenteditable') === 'true';
      
      if (isInputFocused) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigatePeriod('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigatePeriod('next');
      } else if (e.key === 'Home') {
        e.preventDefault();
        setSlideDirection('right');
        setTimeout(() => setSlideDirection(null), 350);
        setDateRange({ from: projectStartDate, to: projectEndDate });
      } else if (e.key === 'End') {
        e.preventDefault();
        if (containerRef.current) {
          containerRef.current.scrollTo({ left: containerRef.current.scrollWidth, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigatePeriod, projectStartDate, projectEndDate]);

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

  // Helper to check if a task is a client check-in (legacy) or consolidated call
  const isClientCheckin = useCallback((task: Task) => {
    const n = task.name.toLowerCase();
    return n.includes('client check-in') || n.includes('client checkin') || n.includes('weekly call') || n.includes('bi-weekly call');
  }, []);

  // Helper to check if a task is a feedback/review meeting (should have dashed border)
  const isFeedbackTask = useCallback((task: Task) => {
    const n = task.name.toLowerCase();
    return task.is_feedback_meeting || 
      (task.task_type === 'meeting' && n.includes('review')) ||
      n.endsWith(' review');
  }, []);

  // Helper to check if a task is a rework task
  const isReworkTask = useCallback((task: Task) => {
    const n = task.name.toLowerCase();
    return n.endsWith(' rework');
  }, []);

  // Extract base name from task name (removes " Review" or " Rework" suffix)
  const getBaseTaskName = useCallback((taskName: string) => {
    const n = taskName.toLowerCase();
    if (n.endsWith(' review')) return taskName.slice(0, -7);
    if (n.endsWith(' rework')) return taskName.slice(0, -7);
    return taskName;
  }, []);

  // Group related tasks into review cycles (Base Task, Review, Rework)
  interface ReviewCycle {
    id: string;
    baseName: string;
    baseTask: Task;
    reviewTask: Task | null;
    reworkTask: Task | null;
  }

  const groupTasksIntoReviewCycles = useCallback((phaseTasks: Task[]): { cycles: ReviewCycle[], ungrouped: Task[] } => {
    const cycles: ReviewCycle[] = [];
    const usedTaskIds = new Set<string>();
    
    // Find all potential base tasks (tasks that are not reviews or reworks)
    const baseTasks = phaseTasks.filter(t => !isFeedbackTask(t) && !isReworkTask(t));
    
    for (const baseTask of baseTasks) {
      const baseName = baseTask.name;
      
      // Find matching review and rework tasks
      const reviewTask = phaseTasks.find(t => 
        t.name.toLowerCase() === `${baseName.toLowerCase()} review` && 
        !usedTaskIds.has(t.id)
      );
      const reworkTask = phaseTasks.find(t => 
        t.name.toLowerCase() === `${baseName.toLowerCase()} rework` && 
        !usedTaskIds.has(t.id)
      );
      
      // Only create a cycle if we have at least a review task
      if (reviewTask) {
        usedTaskIds.add(baseTask.id);
        usedTaskIds.add(reviewTask.id);
        if (reworkTask) usedTaskIds.add(reworkTask.id);
        
        cycles.push({
          id: `cycle-${baseTask.id}`,
          baseName,
          baseTask,
          reviewTask,
          reworkTask: reworkTask || null,
        });
      }
    }
    
    // Remaining tasks that are not part of any cycle
    const ungrouped = phaseTasks.filter(t => !usedTaskIds.has(t.id));
    
    return { cycles, ungrouped };
  }, [isFeedbackTask, isReworkTask]);

  // Collect all check-in tasks that exist in the project (usually many single-day meetings)
  const checkinTasks = useMemo(() => {
    return tasks
      .filter(t => isClientCheckin(t))
      .filter(t => !!t.start_date)
      .sort((a, b) => new Date(a.start_date!).getTime() - new Date(b.start_date!).getTime());
  }, [tasks, isClientCheckin]);

  // Map of date string -> task ID for quick lookup when deleting
  const checkinTasksByDate = useMemo(() => {
    const map = new Map<string, string>();
    checkinTasks.forEach(t => {
      if (t.start_date) {
        map.set(t.start_date, t.id);
      }
    });
    return map;
  }, [checkinTasks]);

  // Build a single, consolidated "Weekly Call" task for display
  const consolidatedWeeklyCall = useMemo(() => {
    if (checkinTasks.length === 0) return null;

    const first = checkinTasks[0];
    const last = checkinTasks[checkinTasks.length - 1];

    let recurring_dates = checkinTasks
      .map(t => t.start_date!)
      // de-dupe (just in case)
      .filter((d, i, arr) => arr.indexOf(d) === i);

    // If the database has only a single "Weekly Call" record (no recurring dates persisted),
    // synthesize the weekly/bi-weekly occurrences for display.
    if (checkinTasks.length === 1 && recurring_dates.length === 1) {
      const n = (first.name || '').toLowerCase();
      const isWeekly = n.includes('weekly');
      const isBiWeekly = n.includes('bi-weekly') || n.includes('biweekly');
      const intervalDays = isBiWeekly ? 14 : isWeekly ? 7 : null;

      if (intervalDays) {
        const start = new Date(first.start_date!);
        const generated: string[] = [first.start_date!];

        let current = addDays(start, intervalDays);
        while (current <= projectEndDate) {
          if (isWorkingDay(current)) {
            generated.push(format(current, 'yyyy-MM-dd'));
          }
          current = addDays(current, intervalDays);
        }

        recurring_dates = generated;
      }
    }

    return {
      ...first,
      id: 'consolidated-weekly-call',
      name: 'Weekly Call',
      start_date: first.start_date,
      end_date: last.end_date || last.start_date,
      recurring_dates,
    } satisfies Task;
  }, [checkinTasks, projectEndDate, isWorkingDay]);

  // Group tasks by phase (excluding check-ins)
  const tasksByPhase = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    phases.forEach(phase => {
      grouped.set(
        phase.id,
        tasks
          .filter(t => t.phase_id === phase.id && !isClientCheckin(t))
          .sort((a, b) => a.order_index - b.order_index)
      );
    });
    return grouped;
  }, [phases, tasks, isClientCheckin]);

  // Create ordered sections: Consolidated Client Check-ins first (single row), then phases (excluding Discovery)
  type Section = { 
    type: 'phase'; 
    phase: Phase; 
    tasks: Task[];
    cycles: ReviewCycle[];
    ungroupedTasks: Task[];
  } | { type: 'weekly-call'; task: Task };

  const orderedSections = useMemo((): Section[] => {
    const sections: Section[] = [];

    if (consolidatedWeeklyCall) {
      sections.push({ type: 'weekly-call', task: consolidatedWeeklyCall });
    }

    phases
      .filter(phase => phase.name !== 'Discovery' && phase.name !== 'Client Check-ins')
      .forEach(phase => {
        const phaseTasks = tasksByPhase.get(phase.id) || [];
        const { cycles, ungrouped } = groupTasksIntoReviewCycles(phaseTasks);
        sections.push({ type: 'phase', phase, tasks: phaseTasks, cycles, ungroupedTasks: ungrouped });
      });

    return sections;
  }, [phases, tasksByPhase, consolidatedWeeklyCall, groupTasksIntoReviewCycles]);


  // Calculate total chart height based on sections (accounting for collapsed state and review cycles)
  let totalHeight = HEADER_HEIGHT;
  orderedSections.forEach(section => {
    const sectionKey = section.type === 'phase' ? section.phase.id : 'weekly-call';
    const isCollapsed = collapsedSections.has(sectionKey);
    const isWeeklyCall = section.type === 'weekly-call';
    const hasNoMeetings =
      isWeeklyCall && (!section.task?.recurring_dates || section.task.recurring_dates.length === 0);

    // Skip sections that won't be rendered
    if (hasNoMeetings) return;

    totalHeight += PHASE_HEADER_HEIGHT;
    if (!isCollapsed) {
      if (section.type === 'weekly-call') {
        totalHeight += ROW_HEIGHT; // Single row for weekly call
      } else {
        // Each cycle takes 2 rows (base+rework on top, review on bottom)
        // Plus ungrouped tasks take 1 row each
        const cycleRows = section.cycles.length * 2;
        const ungroupedRows = section.ungroupedTasks.length;
        totalHeight += (cycleRows + ungroupedRows) * ROW_HEIGHT;
      }
    }
  });

  return (
    <TooltipProvider delayDuration={200}>
    <div className="flex flex-col gap-2 md:gap-4">
      {/* Controls - Light Header */}
      <div className="flex flex-wrap items-center gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded-xl bg-card border border-border">
        {/* Breadcrumb placeholder - hidden on mobile */}
        <div className="hidden md:flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Projects</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">Timeline</span>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-1 md:gap-2 mx-auto">
          {/* Navigation arrows */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 md:h-9 md:w-9 p-0 hover:bg-accent text-foreground"
            onClick={() => navigatePeriod('prev')}
            title="Previous period (← Arrow)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* View mode toggle - Segmented control */}
          <div className="flex items-center rounded-lg p-0.5 md:p-1 bg-muted border border-border">
            {(['week', 'month', 'project'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-7 md:h-8 px-2 md:px-4 text-[10px] md:text-xs font-semibold tracking-wide capitalize transition-all duration-200",
                  viewMode === mode 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleViewModeChange(mode)}
              >
                {isMobile 
                  ? (mode === 'week' ? 'W' : mode === 'month' ? 'M' : 'P')
                  : (mode === 'week' ? 'Weekly' : mode === 'month' ? 'Monthly' : 'Project')
                }
              </Button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 md:h-9 md:w-9 p-0 hover:bg-accent text-foreground"
            onClick={() => navigatePeriod('next')}
            title="Next period (→ Arrow)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Date range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 md:h-9 gap-1 md:gap-2 px-2 md:px-4 hover:bg-accent text-foreground border border-border rounded-lg"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] md:text-xs font-medium tracking-wide hidden sm:inline">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d')
                    )
                  ) : (
                    'Dates'
                  )}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={isMobile ? 1 : 2}
                className="pointer-events-auto"
              />
              <div className="flex items-center justify-between p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ from: projectStartDate, to: projectEndDate })}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Reset to project dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right side info */}
        <div className="hidden md:flex items-center gap-4 ml-auto">
          {/* Working days badge */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
            {workingDays.length} working days left
          </span>

          {/* Legend tooltip */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-9 w-9 p-0 hover:bg-accent text-muted-foreground hover:text-foreground"
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="w-64 p-3 bg-card border-border text-foreground">
              <div className="space-y-2.5 text-xs">
                <div className="font-semibold text-sm mb-2 tracking-wide">Chart Legend</div>
                
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-foreground/80 rotate-45 rounded-sm shrink-0 diamond-shimmer" />
                  <span><strong>Diamond</strong> — Recurring meeting</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" strokeWidth={1.5} />
                  <span><strong>Flag</strong> — Milestone (end of phase)</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-8 h-3 gantt-task-bar rounded-sm shrink-0" />
                  <span><strong>Bar</strong> — Task duration</span>
                </div>
                
                <div className="border-t border-border pt-2 mt-2 text-muted-foreground">
                  <p><strong>Weekly view:</strong> 7 days per period</p>
                  <p className="mt-1"><strong>Monthly view:</strong> Full month view</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Gantt Chart - Split Pane Layout for frozen tasks column */}
      <div className="rounded-xl bg-muted border border-border shadow-sm overflow-x-auto" ref={containerRef}>
        <div className="flex" style={{ height: totalHeight, minWidth: isMobile ? taskColumnWidth + 200 : undefined }}>
          {/* Left Pane - Fixed Tasks Column (no horizontal scroll) */}
          <div className="flex flex-col shrink-0 bg-muted border-r border-border z-20 sticky left-0" style={{ width: taskColumnWidth }}>
            {/* Tasks Header - Fixed */}
            <div 
              className="flex items-center px-2 md:px-4 border-b border-border bg-muted/50 font-semibold text-xs md:text-sm tracking-wide uppercase shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="text-foreground">Tasks</span>
            </div>

            {/* Tasks Body - Vertical scroll only, synced with right pane */}
            <div 
              ref={leftBodyRef}
              className="flex-1 overflow-y-auto overflow-x-hidden gantt-left-body-scroll"
              onScroll={handleLeftBodyScroll}
            >
            {orderedSections.map((section, sectionIndex) => {
              const sectionKey = section.type === 'phase' ? section.phase.id : 'weekly-call';
              const sectionName = section.type === 'phase' ? section.phase.name : 'Client Check-ins';
              const sectionColor = PHASE_CATEGORY_COLORS[sectionName as PhaseCategory] || '#9CA3AF';
              const isCollapsed = collapsedSections.has(sectionKey);
              const isWeeklyCall = section.type === 'weekly-call';
              
              // Hide Client Check-ins section when it has no meetings
              const hasNoMeetings = isWeeklyCall && (!section.task.recurring_dates || section.task.recurring_dates.length === 0);
              if (hasNoMeetings) return null;

              const ghostInfo = section.type === 'phase' ? getGhostInfo() : null;
              const dropIndicatorStyle = section.type === 'phase' ? getDropIndicatorStyle(section.phase.id) : null;

              return (
                <div 
                  key={sectionKey}
                  className={cn(
                    section.type === 'phase' && getDropTargetPhaseClasses(section.phase.id),
                    "rounded-lg transition-all relative"
                  )}
                  onMouseEnter={() => {
                    if (isVerticalDragging && section.type === 'phase') {
                      // Calculate the target index (insert at end of phase)
                      const phaseTaskCount = section.cycles.length + section.ungroupedTasks.length;
                      handlePhaseHover(section.phase.id, phaseTaskCount);
                    }
                  }}
                >
                  {/* Drop indicator line - shows exactly where task will land */}
                  {dropIndicatorStyle && (
                    <div 
                      className="gantt-drop-indicator"
                      style={dropIndicatorStyle}
                    />
                  )}

                  {/* Ghost element at original position */}
                  {ghostInfo && ghostInfo.phaseId === (section.type === 'phase' ? section.phase.id : '') && (
                    <div 
                      className="gantt-vertical-ghost absolute left-2 right-2"
                      style={{ 
                        height: ROW_HEIGHT * 2, // Account for review cycle rows
                        top: PHASE_HEADER_HEIGHT + ghostInfo.originalIndex * ROW_HEIGHT * 2,
                        zIndex: 1,
                      }}
                    />
                  )}
                  {/* Section header */}
                  <div 
                    className="flex items-center gap-3 px-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                    style={{ height: PHASE_HEADER_HEIGHT }}
                    onClick={() => toggleSectionCollapse(sectionKey)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 shrink-0" style={{ color: sectionColor }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" style={{ color: sectionColor }} />
                    )}
                    <div 
                      className="w-2 md:w-2.5 h-2 md:h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: sectionColor }}
                    />
                    <span className="font-semibold text-xs md:text-sm tracking-wide text-foreground truncate">{sectionName}</span>
                    <div className="ml-auto flex items-center gap-2 md:gap-3">
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
                        {section.type === 'weekly-call' 
                          ? `${section.task.recurring_dates?.length || 0} mtgs`
                          : section.tasks.length}
                      </span>
                      {section.type === 'phase' && !readOnly && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddTask(section.phase.id);
                          }}
                          className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Add task"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isWeeklyCall && !readOnly && onAddMeeting && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddMeeting();
                          }}
                          className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Add meeting"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Weekly call row - single row with meeting count */}
                  {isWeeklyCall && !isCollapsed && (
                    <div 
                      className="flex items-center gap-2 md:gap-3 px-2 md:px-4 group"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="w-3 md:w-4 shrink-0" />
                      <Users className="w-3.5 md:w-4 h-3.5 md:h-4 text-amber-500 shrink-0" />
                      <span className="text-xs md:text-sm font-medium text-foreground truncate flex-1 min-w-0">{section.task.name}</span>
                      
                      <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
                        {section.task.recurring_dates?.length || 0} meetings
                      </span>
                    </div>
                  )}

                  {/* Review cycles - 2 rows each (base+rework on top, review below) */}
                  {!isCollapsed && section.type === 'phase' && section.cycles.map((cycle, cycleIndex) => {
                    // Row 1: Base Task + Rework (on same line)
                    const baseStartDate = safeParseDate(cycle.baseTask.start_date);
                    const baseEndDate = safeParseDate(cycle.baseTask.end_date);
                    const baseDaysDiff = safeDifferenceInDays(baseEndDate, baseStartDate);
                    const baseDuration = baseDaysDiff !== null ? baseDaysDiff + 1 : null;
                    
                    const reworkStartDate = safeParseDate(cycle.reworkTask?.start_date);
                    const reworkEndDate = safeParseDate(cycle.reworkTask?.end_date);
                    const reworkDaysDiff = safeDifferenceInDays(reworkEndDate, reworkStartDate);
                    const reworkDuration = reworkDaysDiff !== null ? reworkDaysDiff + 1 : null;

                    const isBeingDragged = verticalDrag?.taskId === cycle.baseTask.id;
                    const showInsertionGap = shouldShowInsertionGap(cycleIndex, section.phase.id);

                    return (
                      <div key={cycle.id}>
                        {/* Insertion gap - visible empty slot where task will land */}
                        {showInsertionGap && (
                          <div 
                            className="gantt-insertion-gap"
                            style={{ height: ROW_HEIGHT * 2 }}
                          />
                        )}
                        <div 
                          className={cn(
                            getVerticalDragClasses(cycle.baseTask.id),
                            getSwapTargetClasses(cycle.baseTask.id, cycleIndex, section.phase.id)
                          )}
                          style={getVerticalDragStyles(cycle.baseTask.id, cycleIndex, section.phase.id)}
                          onMouseEnter={() => {
                            if (isVerticalDragging && verticalDrag?.taskId !== cycle.baseTask.id) {
                              handlePhaseHover(section.phase.id, cycleIndex);
                            }
                          }}
                        >
                        {/* Row 1: Base task + Rework */}
                        <div 
                          className={cn(
                            "flex items-center gap-1.5 md:gap-2 px-2 md:px-3 group hover:bg-muted/30 transition-colors",
                            isBeingDragged && "bg-card"
                          )}
                          style={{ height: ROW_HEIGHT }}
                        >
                        {!readOnly && (
                          <div 
                            className="flex items-center gap-0.5 shrink-0"
                            onMouseDown={(e) => handleVerticalDragStart(e, cycle.baseTask.id, cycle.baseName, section.phase.id, cycleIndex)}
                          >
                            <GripVertical className="w-3.5 md:w-4 h-3.5 md:h-4 text-muted-foreground opacity-0 group-hover:opacity-100 gantt-grip-handle transition-opacity" />
                          </div>
                        )}
                          <div className="w-2.5 md:w-3.5 shrink-0" />
                          {editingTaskId === cycle.baseTask.id ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingTaskName}
                              onChange={(e) => setEditingTaskName(e.target.value)}
                              onBlur={handleSaveEdit}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              className="text-[10px] md:text-xs font-medium text-foreground bg-background border border-primary rounded px-1 py-0.5 min-w-0 flex-1 outline-none"
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span 
                              className="text-[10px] md:text-xs font-medium text-foreground truncate min-w-0 cursor-pointer hover:text-primary transition-colors"
                              onClick={() => handleStartEdit(cycle.baseTask.id, cycle.baseName)}
                              title="Click to edit"
                            >
                              {cycle.baseName}
                              {cycle.reworkTask && <span className="text-muted-foreground ml-1 hidden sm:inline">+ Rework</span>}
                            </span>
                          )}
                          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 ml-auto">
                            {baseDuration !== null && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted">
                                {baseDuration}d
                              </span>
                            )}
                            {cycle.reworkTask && reworkDuration !== null && (
                              <>
                                <span className="opacity-50">+</span>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted">
                                  {reworkDuration}d
                                </span>
                              </>
                            )}
                          </div>
                          <button
                            onClick={() => onAddReviewRound(cycle.baseTask.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded shrink-0 transition-all"
                            title="Add review round"
                          >
                            <RotateCcw className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>

                        {/* Row 2: Review meeting */}
                        {cycle.reviewTask && (
                          <div 
                            className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 pl-6 md:pl-8 group hover:bg-muted/30 transition-colors border-l-2 border-dashed ml-3 md:ml-4"
                            style={{ height: ROW_HEIGHT, borderColor: sectionColor }}
                          >
                            <Users className="w-3 md:w-3.5 h-3 md:h-3.5 text-amber-500 shrink-0" />
                            <span className="text-[10px] md:text-xs font-medium text-muted-foreground truncate flex-1 min-w-0">
                              ↳ {cycle.reviewTask.name}
                            </span>
                            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 ml-auto">
                              {cycle.reviewTask.start_date && (() => {
                                const reviewDate = safeParseDate(cycle.reviewTask.start_date);
                                return reviewDate ? (
                                  <span className="font-medium">
                                    {safeFormat(reviewDate, 'MMM d')}
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Ungrouped tasks (not part of any cycle) */}
                  {!isCollapsed && section.type === 'phase' && section.ungroupedTasks.map((task, taskIndex) => {
                    const startDate = safeParseDate(task.start_date);
                    const endDate = safeParseDate(task.end_date);
                    const daysDiff = safeDifferenceInDays(endDate, startDate);
                    const duration = daysDiff !== null ? daysDiff + 1 : null;

                    // Calculate overall index (cycles count + taskIndex)
                    const overallIndex = section.cycles.length + taskIndex;
                    const isBeingDragged = verticalDrag?.taskId === task.id;

                    return (
                      <div 
                        key={task.id}
                        className={cn(
                          "flex items-center gap-1.5 md:gap-2 px-2 md:px-3 group hover:bg-muted/30 transition-colors",
                          getVerticalDragClasses(task.id),
                          getSwapTargetClasses(task.id, overallIndex, section.phase.id),
                          isBeingDragged && "bg-card"
                        )}
                        style={{ 
                          height: ROW_HEIGHT,
                          ...getVerticalDragStyles(task.id, overallIndex, section.phase.id)
                        }}
                        onMouseEnter={() => {
                          if (isVerticalDragging && verticalDrag?.taskId !== task.id) {
                            handlePhaseHover(section.phase.id, overallIndex);
                          }
                        }}
                      >
                        {!readOnly && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <div onMouseDown={(e) => handleVerticalDragStart(e, task.id, task.name, section.phase.id, overallIndex)}>
                              <GripVertical className="w-3.5 md:w-4 h-3.5 md:h-4 text-muted-foreground opacity-0 group-hover:opacity-100 gantt-grip-handle transition-opacity" />
                            </div>
                            {onDeleteTask && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTask(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                                title="Delete task"
                              >
                                <Trash2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-destructive" />
                              </button>
                            )}
                          </div>
                        )}
                        
                        {task.task_type === 'milestone' && <Flag className="w-3 md:w-3.5 h-3 md:h-3.5 text-amber-500 shrink-0" />}
                        {task.task_type === 'meeting' && <Users className="w-3 md:w-3.5 h-3 md:h-3.5 text-amber-500 shrink-0" />}
                        {task.task_type === 'task' && <div className="w-3 md:w-3.5 shrink-0" />}
                        
                        {editingTaskId === task.id ? (
                          <input
                            ref={editInputRef}
                            type="text"
                            value={editingTaskName}
                            onChange={(e) => setEditingTaskName(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                            className="text-[10px] md:text-xs font-medium text-foreground bg-background border border-primary rounded px-1 py-0.5 min-w-0 flex-1 outline-none"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span 
                            className="text-[10px] md:text-xs font-medium text-foreground truncate flex-1 min-w-0 cursor-pointer hover:text-primary transition-colors"
                            onClick={() => handleStartEdit(task.id, task.name)}
                            title="Click to edit"
                          >
                            {task.name}
                          </span>
                        )}
                        
                        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 ml-auto">
                          {duration !== null && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted">
                              {duration}d
                            </span>
                          )}
                          {startDate && (
                            <span className="font-medium">
                              {safeFormat(startDate, 'MMM d')}
                            </span>
                          )}
                          {startDate && endDate && (
                            <span className="opacity-50">→</span>
                          )}
                          {endDate && (
                            <span className="font-medium">
                              {safeFormat(endDate, 'MMM d')}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => onAddReviewRound(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded shrink-0 transition-all"
                          title="Add review round"
                        >
                          <RotateCcw className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </div>
                    );
                  })}

                </div>
              );
            })}
            </div>
          </div>

          {/* Right Pane - Timeline (horizontal + vertical scroll) */}
          <div className="flex flex-col flex-1 min-w-0">
            {/* Timeline Header - Fixed horizontally synced with 3 rows: Month, Week, Day */}
            <div 
              ref={rightHeaderRef}
              className="overflow-x-hidden shrink-0 border-b border-border bg-muted/50"
              style={{ height: HEADER_HEIGHT }}
            >
              {/* Month Row */}
              <div className="flex border-b border-border/60" style={{ height: MONTH_ROW_HEIGHT, width: chartWidth }}>
                {monthGroups.map((group, idx) => (
                  <div
                    key={`month-${group.monthLabel}-${idx}`}
                    className="flex items-center justify-center text-xs font-bold uppercase tracking-wider text-foreground border-r border-border/60 shrink-0"
                    style={{ width: group.count * columnWidth }}
                  >
                    {group.monthLabel}
                  </div>
                ))}
              </div>

              {/* Week Row */}
              <div className="flex border-b border-border/60" style={{ height: WEEK_ROW_HEIGHT, width: chartWidth }}>
                {weekGroups.map((group, idx) => {
                  const isAlternateWeek = idx % 2 === 1;
                  return (
                    <div
                      key={`week-${group.weekLabel}-${idx}`}
                      className={cn(
                        "flex items-center justify-center text-xs font-bold uppercase tracking-wider text-foreground border-r border-border/60 shrink-0",
                        isAlternateWeek && "bg-black/[0.04]"
                      )}
                      style={{ width: group.count * columnWidth }}
                    >
                      {group.weekLabel}
                    </div>
                  );
                })}
              </div>

              {/* Day Row */}
              <div className="flex" style={{ height: DAY_ROW_HEIGHT, width: chartWidth }}>
                {groupedColumns.map((col) => {
                  const isToday = col.days.some(d => isSameDay(d, new Date()));
                  const isAlternateWeek = weekAlternatingMap[col.weekNumber];

                  return (
                    <div
                      key={col.key}
                      className={cn(
                        "flex flex-col items-center justify-center text-xs shrink-0 border-r border-border/60",
                        isToday && "bg-destructive/10",
                        !isToday && isAlternateWeek && "bg-black/[0.04]"
                      )}
                      style={{ width: columnWidth }}
                    >
                      <span className="font-bold text-foreground tracking-wide">{col.label}</span>
                      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">{col.subLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Timeline Body - Both scrolls, synced with left pane */}
            <div 
              ref={rightBodyRef}
              className={cn(
                "flex-1 overflow-auto relative",
                slideDirection === 'left' && "animate-slide-left",
                slideDirection === 'right' && "animate-slide-right",
                isDraggingAny && "select-none"
              )}
              onScroll={handleRightBodyScroll}
            >
              <div className="relative" style={{ width: chartWidth }}>
                {/* Section rows with task bars */}
                {orderedSections.map((section, sectionIndex) => {
                  const sectionKey = section.type === 'phase' ? section.phase.id : 'weekly-call';
                  const sectionName = section.type === 'phase' ? section.phase.name : 'Client Check-ins';
                  const sectionColor = PHASE_CATEGORY_COLORS[sectionName as PhaseCategory] || '#9CA3AF';
                  const isCollapsed = collapsedSections.has(sectionKey);
                  const isWeeklyCall = section.type === 'weekly-call';
                  
                  // Hide Client Check-ins section when it has no meetings
                  const hasNoMeetings = isWeeklyCall && (!section.task.recurring_dates || section.task.recurring_dates.length === 0);
                  if (hasNoMeetings) return null;

                  return (
                    <div key={sectionKey}>
                      {/* Section header row */}
                      <div 
                        className="cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
                        style={{ height: PHASE_HEADER_HEIGHT }}
                        onClick={() => toggleSectionCollapse(sectionKey)}
                      >
                        <div className="flex h-full">
                          {groupedColumns.map((col) => {
                            const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                            return (
                              <div
                                key={col.key}
                                className={cn("shrink-0 border-r border-border/60", isAlternateWeek && "bg-black/[0.04]")}
                                style={{ width: columnWidth }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Weekly call row with diamond markers */}
                      {isWeeklyCall && !isCollapsed && (
                        <div className="relative" style={{ height: ROW_HEIGHT }}>
                          {/* Grid background */}
                          <div className="absolute inset-0 flex">
                            {groupedColumns.map((col) => {
                              const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                              return (
                                <div
                                  key={col.key}
                                  className={cn("shrink-0 border-r border-border/60", isAlternateWeek && "bg-black/[0.04]")}
                                  style={{ width: columnWidth }}
                                />
                              );
                            })}
                          </div>

                          {/* Diamond markers for each recurring date with hover card */}
                          {section.task.recurring_dates?.map((dateStr, idx) => {
                            const meetingDate = safeParseDate(dateStr);
                            if (!meetingDate) return null; // Skip invalid dates
                            
                            const left = dateToX(meetingDate);
                            
                            // Check if this date is visible in current view
                            const colIndex = groupedColumns.findIndex(col => 
                              safeIsSameDay(col.startDate, meetingDate)
                            );
                            if (colIndex === -1) return null;

                            // Find the actual task ID for this meeting date
                            const taskId = checkinTasksByDate.get(dateStr);
                            
                            return (
                              <MeetingHoverCard
                                key={dateStr}
                                meetingDate={meetingDate}
                                meetingName={section.task.name}
                                checkinTime={checkinTime ?? null}
                                checkinDuration={checkinDuration ?? null}
                                checkinTimezone={checkinTimezone ?? null}
                                tasks={tasks}
                                left={left}
                                columnWidth={columnWidth}
                                allMeetingDates={section.task.recurring_dates || []}
                                meetingIndex={idx}
                                projectId={projectId}
                                readOnly={readOnly}
                                onDelete={taskId && onDeleteMeeting ? () => onDeleteMeeting(taskId) : undefined}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* Review cycles - 2 rows each with connected flow visualization */}
                      {!isCollapsed && section.type === 'phase' && section.cycles.map((cycle) => {
                        // Check dragging states first
                        const isBaseDragging = dragging?.taskId === cycle.baseTask.id;
                        const isReviewDragging = cycle.reviewTask && dragging?.taskId === cycle.reviewTask.id;
                        const isReworkDragging = cycle.reworkTask && dragging?.taskId === cycle.reworkTask.id;
                        const isBaseJustDropped = justDropped === cycle.baseTask.id;
                        const isReviewJustDropped = cycle.reviewTask && justDropped === cycle.reviewTask.id;
                        const isReworkJustDropped = cycle.reworkTask && justDropped === cycle.reworkTask.id;

                        // Get positions for all tasks in the cycle - USE DRAG PREVIEW when dragging
                        const baseStart = isBaseDragging && dragPreview 
                          ? dragPreview.start 
                          : safeParseDate(cycle.baseTask.start_date);
                        const baseEnd = isBaseDragging && dragPreview 
                          ? dragPreview.end 
                          : safeParseDate(cycle.baseTask.end_date);
                        const reviewStart = isReviewDragging && dragPreview 
                          ? dragPreview.start 
                          : safeParseDate(cycle.reviewTask?.start_date);
                        const reviewEnd = isReviewDragging && dragPreview 
                          ? dragPreview.end 
                          : safeParseDate(cycle.reviewTask?.end_date);
                        const reworkStart = isReworkDragging && dragPreview 
                          ? dragPreview.start 
                          : safeParseDate(cycle.reworkTask?.start_date);
                        const reworkEnd = isReworkDragging && dragPreview 
                          ? dragPreview.end 
                          : safeParseDate(cycle.reworkTask?.end_date);

                        const baseLeft = baseStart ? dateToX(baseStart) : 0;
                        const baseWidth = baseStart && baseEnd ? getTaskWidth(baseStart, baseEnd) : 0;
                        const reviewLeft = reviewStart ? dateToX(reviewStart) : 0;
                        const reviewWidth = reviewStart && reviewEnd ? getTaskWidth(reviewStart, reviewEnd) : columnWidth;
                        const reworkLeft = reworkStart ? dateToX(reworkStart) : 0;
                        const reworkWidth = reworkStart && reworkEnd ? getTaskWidth(reworkStart, reworkEnd) : 0;

                        return (
                          <div key={cycle.id}>
                            {/* Row 1: Base Task + Rework bars + connecting lines */}
                            <div className="relative" style={{ height: ROW_HEIGHT }}>
                              {/* Grid background */}
                              <div className="absolute inset-0 flex">
                                {groupedColumns.map((col) => {
                                  const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                                  return (
                                    <div
                                      key={col.key}
                                      className={cn("shrink-0 border-r border-border/60", isAlternateWeek && "bg-black/[0.04]")}
                                      style={{ width: columnWidth }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Ghost element at original position during drag */}
                              {isBaseDragging && (() => {
                                const ghost = getGhostPosition();
                                if (!ghost) return null;
                                const ghostLeft = dateToX(ghost.start);
                                const ghostWidth = getTaskWidth(ghost.start, ghost.end);
                                return (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md gantt-task-ghost"
                                    style={{
                                      left: ghostLeft + 2,
                                      width: ghostWidth - 4,
                                      background: `linear-gradient(135deg, ${sectionColor}40 0%, ${sectionColor}30 100%)`,
                                    }}
                                  />
                                );
                              })()}

                              {/* Base Task bar */}
                              {baseStart && baseEnd && baseWidth > 0 && (() => {
                                const baseDuration = differenceInDays(baseEnd, baseStart) + 1;
                                const isBaseResizing = isBaseDragging && (dragging?.type === 'resize-start' || dragging?.type === 'resize-end');
                                const baseDurationChanged = isBaseResizing && dragging?.originalDuration && baseDuration !== dragging.originalDuration;
                                const tooltipInfo = isBaseDragging ? getDynamicTooltipInfo() : null;
                                
                                return (
                                <>
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move",
                                        "gantt-task-bar-base",
                                        "hover:shadow-xl hover:ring-2 hover:ring-white/40",
                                        getDragClasses(cycle.baseTask.id)
                                      )}
                                      style={{
                                        left: baseLeft + 2,
                                        width: baseWidth - 4,
                                        background: `linear-gradient(135deg, ${sectionColor} 0%, ${sectionColor}dd 100%)`,
                                        boxShadow: `0 4px 12px ${sectionColor}66`,
                                        ...getDragStyles(cycle.baseTask.id),
                                      }}
                                      onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, cycle.baseTask, 'move')}
                                    >
                                      {!readOnly && (
                                        <>
                                          <div
                                            className={cn("gantt-resize-handle gantt-resize-handle-start", isBaseDragging && dragging?.type === 'resize-start' && "gantt-resize-handle-active")}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              handleDragStart(e, cycle.baseTask, 'resize-start');
                                            }}
                                          />
                                          <div
                                            className={cn("gantt-resize-handle gantt-resize-handle-end", isBaseDragging && dragging?.type === 'resize-end' && "gantt-resize-handle-active")}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              handleDragStart(e, cycle.baseTask, 'resize-end');
                                            }}
                                          />
                                        </>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center px-3 overflow-hidden">
                                        <span className="text-xs font-semibold text-white truncate drop-shadow-md tracking-wide">
                                          {baseWidth > 60 ? cycle.baseName : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  {!isBaseDragging && (
                                    <TooltipContent side="top" className="font-semibold">
                                      <p>{cycle.baseTask.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {safeFormat(baseStart, 'MMM d')} → {safeFormat(baseEnd, 'MMM d')}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                
                                {/* Dynamic tooltip during drag - fixed position above bar */}
                                {isBaseDragging && tooltipInfo && (
                                  <div 
                                    className="gantt-dynamic-tooltip"
                                    style={{ 
                                      left: baseLeft + baseWidth / 2,
                                      top: '50%',
                                      transform: 'translate(-50%, -200%)',
                                    }}
                                  >
                                    <div className="gantt-dynamic-tooltip-arrow" />
                                    {tooltipInfo.type === 'move' ? (
                                      <span>
                                        <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.start, 'MMM d')}</span>
                                        <span className="gantt-tooltip-separator">→</span>
                                        <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.end, 'MMM d')}</span>
                                      </span>
                                    ) : (
                                      <span>
                                        <span className="gantt-tooltip-date">
                                          {safeFormat(tooltipInfo.type === 'resize-start' ? tooltipInfo.start : tooltipInfo.end, 'MMM d')}
                                        </span>
                                        {(() => {
                                          const durationChange = getDurationChange();
                                          if (durationChange && durationChange.delta !== 0) {
                                            return (
                                              <span className={cn("gantt-tooltip-delta", durationChange.delta > 0 ? "positive" : "negative")}>
                                                {durationChange.delta > 0 ? '+' : ''}{durationChange.delta}d
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                )}
                                </>
                              );
                              })()}

                              {/* Ghost element for rework during drag */}
                              {isReworkDragging && cycle.reworkTask && (() => {
                                const ghost = getGhostPosition();
                                if (!ghost) return null;
                                const ghostLeft = dateToX(ghost.start);
                                const ghostWidth = getTaskWidth(ghost.start, ghost.end);
                                return (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md gantt-task-ghost"
                                    style={{
                                      left: ghostLeft + 2,
                                      width: ghostWidth - 4,
                                      background: `linear-gradient(135deg, ${sectionColor}40 0%, ${sectionColor}30 100%)`,
                                    }}
                                  />
                                );
                              })()}

                              {/* Rework Task bar (on same row) */}
                              {cycle.reworkTask && reworkStart && reworkEnd && reworkWidth > 0 && (() => {
                                const reworkDaysDiff = safeDifferenceInDays(reworkEnd, reworkStart);
                                const reworkDuration = reworkDaysDiff !== null ? reworkDaysDiff + 1 : 0;
                                const tooltipInfo = isReworkDragging ? getDynamicTooltipInfo() : null;
                                
                                return (
                                <>
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move",
                                        "gantt-task-bar-base",
                                        "hover:shadow-xl hover:ring-2 hover:ring-white/40",
                                        getDragClasses(cycle.reworkTask.id)
                                      )}
                                      style={{
                                        left: reworkLeft + 2,
                                        width: reworkWidth - 4,
                                        background: `linear-gradient(135deg, ${sectionColor} 0%, ${sectionColor}dd 100%)`,
                                        boxShadow: `0 4px 12px ${sectionColor}66`,
                                        ...getDragStyles(cycle.reworkTask.id),
                                      }}
                                      onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, cycle.reworkTask!, 'move')}
                                    >
                                      {!readOnly && (
                                        <>
                                          <div
                                            className={cn("gantt-resize-handle gantt-resize-handle-start", isReworkDragging && dragging?.type === 'resize-start' && "gantt-resize-handle-active")}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              handleDragStart(e, cycle.reworkTask!, 'resize-start');
                                            }}
                                          />
                                          <div
                                            className={cn("gantt-resize-handle gantt-resize-handle-end", isReworkDragging && dragging?.type === 'resize-end' && "gantt-resize-handle-active")}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              handleDragStart(e, cycle.reworkTask!, 'resize-end');
                                            }}
                                          />
                                        </>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center px-3 overflow-hidden">
                                        <span className="text-xs font-semibold text-white truncate drop-shadow-md tracking-wide">
                                          {reworkWidth > 50 ? 'Rework' : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  {!isReworkDragging && (
                                    <TooltipContent side="top" className="font-semibold">
                                      <p>{cycle.reworkTask.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {safeFormat(reworkStart, 'MMM d')} → {safeFormat(reworkEnd, 'MMM d')}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                
                                {/* Dynamic tooltip during drag */}
                                {isReworkDragging && tooltipInfo && (
                                  <div 
                                    className="gantt-dynamic-tooltip"
                                    style={{ 
                                      left: reworkLeft + reworkWidth / 2,
                                      top: '50%',
                                      transform: 'translate(-50%, -200%)',
                                    }}
                                  >
                                    <div className="gantt-dynamic-tooltip-arrow" />
                                    {tooltipInfo.type === 'move' ? (
                                      <span>
                                        <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.start, 'MMM d')}</span>
                                        <span className="gantt-tooltip-separator">→</span>
                                        <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.end, 'MMM d')}</span>
                                      </span>
                                    ) : (
                                      <span>
                                        <span className="gantt-tooltip-date">
                                          {safeFormat(tooltipInfo.type === 'resize-start' ? tooltipInfo.start : tooltipInfo.end, 'MMM d')}
                                        </span>
                                        {(() => {
                                          const durationChange = getDurationChange();
                                          if (durationChange && durationChange.delta !== 0) {
                                            return (
                                              <span className={cn("gantt-tooltip-delta", durationChange.delta > 0 ? "positive" : "negative")}>
                                                {durationChange.delta > 0 ? '+' : ''}{durationChange.delta}d
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                )}
                                </>
                              );
                              })()}

                              {/* SVG Connecting lines with arrowheads */}
                              {(cycle.reviewTask && baseEnd && reviewStart) || (cycle.reviewTask && cycle.reworkTask && reviewEnd && reworkStart) ? (
                                <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ width: chartWidth, height: ROW_HEIGHT * 2 }}>
                                  {/* Arrowhead marker definition */}
                                  <defs>
                                    <marker
                                      id={`arrowhead-${cycle.baseTask.id}`}
                                      markerWidth="8"
                                      markerHeight="6"
                                      refX="7"
                                      refY="3"
                                      orient="auto"
                                      markerUnits="strokeWidth"
                                    >
                                      <path
                                        d="M0,0 L0,6 L8,3 z"
                                        fill={sectionColor}
                                        className="opacity-70"
                                      />
                                    </marker>
                                  </defs>

                                  {/* S-Curve: Base Task end → down to Review bar start */}
                                  {cycle.reviewTask && baseEnd && reviewStart && (() => {
                                    const x1 = baseLeft + baseWidth - 2;
                                    const y1 = ROW_HEIGHT / 2;
                                    const x2 = reviewLeft + 2;
                                    const y2 = ROW_HEIGHT + ROW_HEIGHT / 2;
                                    const midX = (x1 + x2) / 2;
                                    const isAnimating = isBaseDragging || isReviewDragging;
                                    return (
                                      <path
                                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                                        stroke={sectionColor}
                                        strokeWidth="2"
                                        strokeDasharray="4 2"
                                        fill="none"
                                        className={cn("opacity-60", isAnimating && "gantt-connection-animating")}
                                        style={{ transition: isAnimating ? 'd 0.15s ease-out' : 'none' }}
                                        markerEnd={`url(#arrowhead-${cycle.baseTask.id})`}
                                      />
                                    );
                                  })()}

                                  {/* S-Curve: Review bar end → up to Rework start */}
                                  {cycle.reviewTask && cycle.reworkTask && reviewEnd && reworkStart && (() => {
                                    const x1 = reviewLeft + reviewWidth - 2;
                                    const y1 = ROW_HEIGHT + ROW_HEIGHT / 2;
                                    const x2 = reworkLeft + 2;
                                    const y2 = ROW_HEIGHT / 2;
                                    const midX = (x1 + x2) / 2;
                                    const isAnimating = isReviewDragging || isReworkDragging;
                                    return (
                                      <path
                                        d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                                        stroke={sectionColor}
                                        strokeWidth="2"
                                        strokeDasharray="4 2"
                                        fill="none"
                                        className={cn("opacity-60", isAnimating && "gantt-connection-animating")}
                                        style={{ transition: isAnimating ? 'd 0.15s ease-out' : 'none' }}
                                        markerEnd={`url(#arrowhead-${cycle.baseTask.id})`}
                                      />
                                    );
                                  })()}
                                </svg>
                              ) : null}
                            </div>

                            {/* Row 2: Review meeting bar (dashed border, draggable) */}
                            <div className="relative" style={{ height: ROW_HEIGHT }}>
                              {/* Grid background */}
                              <div className="absolute inset-0 flex">
                                {groupedColumns.map((col) => {
                                  const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                                  return (
                                    <div
                                      key={col.key}
                                      className={cn("shrink-0 border-r border-border/60", isAlternateWeek && "bg-black/[0.04]")}
                                      style={{ width: columnWidth }}
                                    />
                                  );
                                })}
                              </div>

                              {/* Ghost element for review during drag */}
                              {isReviewDragging && cycle.reviewTask && (() => {
                                const ghost = getGhostPosition();
                                if (!ghost) return null;
                                const ghostLeft = dateToX(ghost.start);
                                const ghostWidth = getTaskWidth(ghost.start, ghost.end);
                                return (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md gantt-task-ghost"
                                    style={{
                                      left: ghostLeft + 2,
                                      width: ghostWidth - 4,
                                      background: `${sectionColor}20`,
                                    }}
                                  />
                                );
                              })()}

                              {/* Review task bar with dashed border (draggable) */}
                              {cycle.reviewTask && reviewStart && reviewEnd && reviewWidth > 0 && (() => {
                                const reviewDaysDiff = safeDifferenceInDays(reviewEnd, reviewStart);
                                const reviewDuration = reviewDaysDiff !== null ? reviewDaysDiff + 1 : 0;
                                const tooltipInfo = isReviewDragging ? getDynamicTooltipInfo() : null;
                                
                                return (
                                <>
                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move",
                                        "gantt-review-bar",
                                        "hover:shadow-xl hover:ring-2 hover:ring-white/40",
                                        getDragClasses(cycle.reviewTask.id)
                                      )}
                                      style={{
                                        left: reviewLeft + 2,
                                        width: reviewWidth - 4,
                                        backgroundColor: `${sectionColor}40`,
                                        borderColor: sectionColor,
                                        boxShadow: `0 2px 8px ${sectionColor}33`,
                                        ...getDragStyles(cycle.reviewTask.id),
                                      }}
                                      onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, cycle.reviewTask!, 'move')}
                                    >
                                      {!readOnly && (
                                        <>
                                          <div
                                            className={cn("gantt-resize-handle gantt-resize-handle-start", isReviewDragging && dragging?.type === 'resize-start' && "gantt-resize-handle-active")}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              handleDragStart(e, cycle.reviewTask!, 'resize-start');
                                            }}
                                          />
                                          <div
                                            className={cn("gantt-resize-handle gantt-resize-handle-end", isReviewDragging && dragging?.type === 'resize-end' && "gantt-resize-handle-active")}
                                            onMouseDown={(e) => {
                                              e.stopPropagation();
                                              handleDragStart(e, cycle.reviewTask!, 'resize-end');
                                            }}
                                          />
                                        </>
                                      )}
                                      <div className="absolute inset-0 flex items-center justify-center px-3 overflow-hidden">
                                        <span className="text-xs font-semibold truncate drop-shadow-sm tracking-wide" style={{ color: sectionColor }}>
                                          {reviewWidth > 80 ? 'Client Review' : ''}
                                        </span>
                                      </div>
                                    </div>
                                  </TooltipTrigger>
                                  {!isReviewDragging && (
                                    <TooltipContent side="top" className="font-semibold">
                                      <p>{cycle.reviewTask.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {safeFormat(reviewStart, 'MMM d')}{reviewEnd && reviewEnd > reviewStart ? ` → ${safeFormat(reviewEnd, 'MMM d')}` : ''}
                                      </p>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                                
                                {/* Dynamic tooltip during drag */}
                                {isReviewDragging && tooltipInfo && (
                                  <div 
                                    className="gantt-dynamic-tooltip"
                                    style={{ 
                                      left: reviewLeft + reviewWidth / 2,
                                      top: '50%',
                                      transform: 'translate(-50%, -200%)',
                                    }}
                                  >
                                    <div className="gantt-dynamic-tooltip-arrow" />
                                    {tooltipInfo.type === 'move' ? (
                                      <span>
                                        <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.start, 'MMM d')}</span>
                                        <span className="gantt-tooltip-separator">→</span>
                                        <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.end, 'MMM d')}</span>
                                      </span>
                                    ) : (
                                      <span>
                                        <span className="gantt-tooltip-date">
                                          {safeFormat(tooltipInfo.type === 'resize-start' ? tooltipInfo.start : tooltipInfo.end, 'MMM d')}
                                        </span>
                                        {(() => {
                                          const durationChange = getDurationChange();
                                          if (durationChange && durationChange.delta !== 0) {
                                            return (
                                              <span className={cn("gantt-tooltip-delta", durationChange.delta > 0 ? "positive" : "negative")}>
                                                {durationChange.delta > 0 ? '+' : ''}{durationChange.delta}d
                                              </span>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                )}
                                </>
                              );
                              })()}
                            </div>
                          </div>
                        );
                      })}

                      {/* Ungrouped task bars */}
                      {!isCollapsed && section.type === 'phase' && section.ungroupedTasks.map((task) => {
                        const isCurrentlyDragging = dragging?.taskId === task.id;
                        const isJustDropped = justDropped === task.id;
                        const displayStart = isCurrentlyDragging && dragPreview ? dragPreview.start : safeParseDate(task.start_date);
                        const displayEnd = isCurrentlyDragging && dragPreview ? dragPreview.end : safeParseDate(task.end_date);

                        const currentDaysDiff = safeDifferenceInDays(displayEnd, displayStart);
                        const currentDuration = currentDaysDiff !== null ? currentDaysDiff + 1 : null;
                        const originalDuration = dragging?.originalDuration;
                        const isResizing = isCurrentlyDragging && (dragging?.type === 'resize-start' || dragging?.type === 'resize-end');
                        const durationChanged = isResizing && originalDuration && currentDuration !== originalDuration;
                        
                        // Check if this is a feedback task (should have dashed border)
                        const isFeedback = isFeedbackTask(task);

                        if (!displayStart || !displayEnd) return (
                          <div key={task.id} style={{ height: ROW_HEIGHT }}>
                            <div className="flex h-full">
                              {groupedColumns.map((col) => {
                                const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                                return (
                                  <div
                                    key={col.key}
                                    className={cn("shrink-0 border-r border-border/60", isAlternateWeek && "bg-black/[0.04]")}
                                    style={{ width: columnWidth }}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );

                        const firstColDate = groupedColumns.length > 0 ? startOfDay(groupedColumns[0].startDate) : null;
                        const lastColDate = groupedColumns.length > 0 ? startOfDay(groupedColumns[groupedColumns.length - 1].startDate) : null;
                        const taskStartDay = startOfDay(displayStart);
                        const taskEndDay = startOfDay(displayEnd);
                        
                        const isOutsideView = firstColDate && lastColDate && 
                          (taskEndDay < firstColDate || taskStartDay > lastColDate);

                        let clippedLeft = dateToX(displayStart);
                        let clippedWidth = getTaskWidth(displayStart, displayEnd);
                        
                        if (firstColDate && taskStartDay < firstColDate) {
                          clippedLeft = 0;
                          clippedWidth = getTaskWidth(firstColDate, displayEnd);
                        }

                        return (
                          <div key={task.id} className="relative" style={{ height: ROW_HEIGHT }}>
                            <div className="absolute inset-0 flex">
                              {groupedColumns.map((col) => {
                                const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                                return (
                                  <div
                                    key={col.key}
                                    className={cn("shrink-0 border-r border-border/60", isAlternateWeek && "bg-black/[0.04]")}
                                    style={{ width: columnWidth }}
                                  />
                                );
                              })}
                            </div>

                            {!isOutsideView && clippedWidth > 0 && task.task_type === 'milestone' ? (
                              // Milestone: Flag icon aligned to right of column
                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute top-1/2 -translate-y-1/2 flex items-center justify-center cursor-move",
                                      "hover:scale-110 transition-transform",
                                      getDragClasses(task.id)
                                    )}
                                    style={{
                                      left: clippedLeft + clippedWidth - 20,
                                      width: 24,
                                    }}
                                    onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, task, 'move')}
                                  >
                                    <Flag 
                                      className="w-5 h-5 drop-shadow-md" 
                                      style={{ color: sectionColor }}
                                      fill={sectionColor}
                                      strokeWidth={1.5}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="bg-card text-card-foreground border shadow-lg">
                                  <div className="text-sm font-semibold">{task.name}</div>
                                  {displayStart && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {safeFormat(displayStart, 'MMM d, yyyy')}
                                    </div>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            ) : !isOutsideView && clippedWidth > 0 && (() => {
                              // Regular task bar with ghost and dynamic tooltip
                              const tooltipInfo = isCurrentlyDragging ? getDynamicTooltipInfo() : null;
                              
                              return (
                              <>
                              {/* Ghost element at original position */}
                              {isCurrentlyDragging && (() => {
                                const ghost = getGhostPosition();
                                if (!ghost) return null;
                                const ghostLeft = dateToX(ghost.start);
                                const ghostWidth = getTaskWidth(ghost.start, ghost.end);
                                return (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md gantt-task-ghost"
                                    style={{
                                      left: ghostLeft + 2,
                                      width: ghostWidth - 4,
                                      background: isFeedback 
                                        ? `${sectionColor}30` 
                                        : `linear-gradient(135deg, ${sectionColor}40 0%, ${sectionColor}30 100%)`,
                                    }}
                                  />
                                );
                              })()}

                              <Tooltip delayDuration={200}>
                                <TooltipTrigger asChild>
                                  <div
                                    className={cn(
                                      "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move",
                                      "gantt-task-bar-base",
                                      "hover:shadow-xl hover:ring-2 hover:ring-white/40",
                                      getDragClasses(task.id),
                                      isFeedback && "gantt-review-bar"
                                    )}
                                    style={{
                                      left: clippedLeft + 2,
                                      width: clippedWidth - 4,
                                      background: isFeedback 
                                        ? `${sectionColor}99` 
                                        : `linear-gradient(135deg, ${sectionColor} 0%, ${sectionColor}dd 100%)`,
                                      borderColor: isFeedback ? sectionColor : undefined,
                                      boxShadow: `0 4px 12px ${sectionColor}66`,
                                      ...getDragStyles(task.id),
                                    }}
                                    onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, task, 'move')}
                                  >
                                    {!readOnly && (
                                      <div
                                        className={cn("gantt-resize-handle gantt-resize-handle-start", isCurrentlyDragging && dragging?.type === 'resize-start' && "gantt-resize-handle-active")}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          handleDragStart(e, task, 'resize-start');
                                        }}
                                      />
                                    )}

                                    <div className="absolute inset-0 flex items-center justify-center px-3 overflow-hidden">
                                      <span className="text-xs font-semibold text-white truncate drop-shadow-md tracking-wide">
                                        {clippedWidth > 60 ? task.name : ''}
                                      </span>
                                    </div>

                                    {!readOnly && (
                                      <div
                                        className={cn("gantt-resize-handle gantt-resize-handle-end", isCurrentlyDragging && dragging?.type === 'resize-end' && "gantt-resize-handle-active")}
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          handleDragStart(e, task, 'resize-end');
                                        }}
                                      />
                                    )}
                                  </div>
                                </TooltipTrigger>
                                {!isCurrentlyDragging && viewMode === 'project' && (
                                  <TooltipContent side="top" className="font-semibold">
                                    <p>{task.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {safeFormat(displayStart, 'MMM d')} → {safeFormat(displayEnd, 'MMM d')}
                                    </p>
                                  </TooltipContent>
                                )}
                              </Tooltip>
                              
                              {/* Dynamic tooltip during drag */}
                              {isCurrentlyDragging && tooltipInfo && (
                                <div 
                                  className="gantt-dynamic-tooltip"
                                  style={{ 
                                    left: clippedLeft + clippedWidth / 2,
                                    top: '50%',
                                    transform: 'translate(-50%, -200%)',
                                  }}
                                >
                                  <div className="gantt-dynamic-tooltip-arrow" />
                                  {tooltipInfo.type === 'move' ? (
                                    <span>
                                      <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.start, 'MMM d')}</span>
                                      <span className="gantt-tooltip-separator">→</span>
                                      <span className="gantt-tooltip-date">{safeFormat(tooltipInfo.end, 'MMM d')}</span>
                                    </span>
                                  ) : (
                                    <span>
                                      <span className="gantt-tooltip-date">
                                        {safeFormat(tooltipInfo.type === 'resize-start' ? tooltipInfo.start : tooltipInfo.end, 'MMM d')}
                                      </span>
                                      {(() => {
                                        const durationChange = getDurationChange();
                                        if (durationChange && durationChange.delta !== 0) {
                                          return (
                                            <span className={cn("gantt-tooltip-delta", durationChange.delta > 0 ? "positive" : "negative")}>
                                              {durationChange.delta > 0 ? '+' : ''}{durationChange.delta}d
                                            </span>
                                          );
                                        }
                                        return null;
                                      })()}
                                    </span>
                                  )}
                                </div>
                              )}
                              </>
                            );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Today marker - Red vertical line with pulse */}
                {(() => {
                  const today = new Date();
                  const todayColIndex = groupedColumns.findIndex(col => 
                    safeIsSameDay(col.startDate, today)
                  );
                  if (todayColIndex === -1) return null;
                  
                  const todayX = todayColIndex * columnWidth + columnWidth / 2;
                  const bodyHeight = totalHeight - HEADER_HEIGHT;
                  return (
                    <div
                      className="absolute w-0.5 bg-destructive z-30 pointer-events-none animate-pulse-subtle"
                      style={{ 
                        left: todayX,
                        top: 0,
                        height: bodyHeight,
                        boxShadow: '0 0 8px 2px hsl(var(--destructive) / 0.4)',
                      }}
                    >
                      {/* Top indicator dot */}
                      <div 
                        className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-destructive animate-pulse-subtle"
                        style={{ boxShadow: '0 0 10px 3px hsl(var(--destructive) / 0.5)' }}
                      />
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating drag preview - follows cursor */}
      {isVerticalDragging && verticalDrag && getDragPreviewStyle() && (
        <div 
          className="gantt-drag-preview"
          style={getDragPreviewStyle() || undefined}
        >
          <div className="flex items-center gap-2 px-3 h-full">
            <GripVertical className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground truncate">{verticalDrag.taskName}</span>
          </div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}