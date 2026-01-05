import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Task, Phase, PhaseCategory, PHASE_CATEGORY_COLORS } from '@/types/database';
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
  onTaskReorder: (phaseId: string, taskId: string, newIndex: number) => void;
  onAddTask: (phaseId: string) => void;
  onAddReviewRound: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddMeeting?: () => void;
  onDeleteMeeting?: (taskId: string) => void;
  readOnly?: boolean;
}

type ViewMode = 'week' | 'month' | 'project';

const TASK_COLUMN_WIDTH = 340;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const PHASE_HEADER_HEIGHT = 36;
const MIN_COLUMN_WIDTH = 36;

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
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  
  // Default view: show ~21 working days from project start (approximately 4 weeks)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const defaultEndDate = addDays(projectStartDate, 28); // ~4 weeks to get ~20-22 working days
    return {
      from: projectStartDate,
      to: defaultEndDate > projectEndDate ? projectEndDate : defaultEndDate,
    };
  });
  const [containerWidth, setContainerWidth] = useState(800);
  
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
    originalDuration: number;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: Date; end: Date } | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
  
  // Track collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  // Slide animation state
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);

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
  const viewStart = dateRange?.from || projectStartDate;
  const viewEnd = dateRange?.to || projectEndDate;

  // Check if day is a working day
  const isWorkingDay = useCallback((date: Date) => {
    const dayOfWeek = date.getDay();
    const dayBit = dayOfWeek === 0 ? 64 : (1 << (dayOfWeek - 1));
    return (workingDaysMask & dayBit) !== 0;
  }, [workingDaysMask]);

  // Generate working days only within the view range
  const workingDays = useMemo(() => {
    const allDays = eachDayOfInterval({ start: viewStart, end: viewEnd });
    return allDays.filter(day => isWorkingDay(day));
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

  // Observe container width for responsive columns
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth - TASK_COLUMN_WIDTH;
        setContainerWidth(Math.max(availableWidth, 400));
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => resizeObserver.disconnect();
  }, []);

  // Calculate responsive column width - fills available space
  const columnWidth = useMemo(() => {
    const columnCount = groupedColumns.length || 1;
    const calculatedWidth = containerWidth / columnCount;
    
    // Set minimum widths based on view mode - project view has smallest minimum for many columns
    const minWidths = { week: MIN_COLUMN_WIDTH, month: 60, project: 16 };
    return Math.max(calculatedWidth, minWidths[viewMode]);
  }, [containerWidth, groupedColumns.length, viewMode]);

  const chartWidth = groupedColumns.length * columnWidth;

  // Update date range when view mode changes - always start from project start
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    
    if (mode === 'week') {
      // Weekly view: show first week of project (7 days from project start)
      const weekStart = startOfWeek(projectStartDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      setDateRange({ from: weekStart, to: weekEnd });
    } else if (mode === 'month') {
      // Monthly view: show first month of project
      const monthStart = startOfMonth(projectStartDate);
      const monthEnd = endOfMonth(monthStart);
      setDateRange({ from: monthStart, to: monthEnd });
    } else {
      // Project view: show entire project from start to end
      setDateRange({ from: projectStartDate, to: projectEndDate });
    }
  }, [projectStartDate, projectEndDate]);

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
  type Section = { type: 'phase'; phase: Phase; tasks: Task[] } | { type: 'weekly-call'; task: Task };

  const orderedSections = useMemo((): Section[] => {
    const sections: Section[] = [];

    if (consolidatedWeeklyCall) {
      sections.push({ type: 'weekly-call', task: consolidatedWeeklyCall });
    }

    phases
      .filter(phase => phase.name !== 'Discovery' && phase.name !== 'Client Check-ins')
      .forEach(phase => {
        const phaseTasks = tasksByPhase.get(phase.id) || [];
        sections.push({ type: 'phase', phase, tasks: phaseTasks });
      });

    return sections;
  }, [phases, tasksByPhase, consolidatedWeeklyCall]);

  // Handle drag start
  const handleDragStart = (
    e: React.MouseEvent,
    task: Task,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.preventDefault();
    if (!task.start_date || !task.end_date) return;

    const startDate = new Date(task.start_date);
    const endDate = new Date(task.end_date);
    const originalDuration = differenceInDays(endDate, startDate) + 1;

    setDragging({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: startDate,
      originalEnd: endDate,
      originalDuration,
    });
    setDragPreview({
      start: startDate,
      end: endDate,
    });
  };

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragPreview) return;

    const deltaX = e.clientX - dragging.startX;
    const deltaDays = Math.round(deltaX / columnWidth);

    if (dragging.type === 'move') {
      setDragPreview({
        start: addDays(dragging.originalStart, deltaDays),
        end: addDays(dragging.originalEnd, deltaDays),
      });
    } else if (dragging.type === 'resize-end') {
      const newEnd = addDays(dragging.originalEnd, deltaDays);
      if (newEnd >= dragging.originalStart) {
        setDragPreview({
          start: dragging.originalStart,
          end: newEnd,
        });
      }
    } else if (dragging.type === 'resize-start') {
      const newStart = addDays(dragging.originalStart, deltaDays);
      if (newStart <= dragging.originalEnd) {
        setDragPreview({
          start: newStart,
          end: dragging.originalEnd,
        });
      }
    }
  }, [dragging, dragPreview, columnWidth]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (dragging && dragPreview) {
      // Trigger spring animation
      setJustDropped(dragging.taskId);
      setTimeout(() => setJustDropped(null), 400);
      
      onTaskUpdate(dragging.taskId, {
        start_date: format(dragPreview.start, 'yyyy-MM-dd'),
        end_date: format(dragPreview.end, 'yyyy-MM-dd'),
      });
    }
    setDragging(null);
    setDragPreview(null);
  }, [dragging, dragPreview, onTaskUpdate]);

  // Attach global mouse listeners when dragging
  useState(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  });

  // Calculate total chart height based on sections (accounting for collapsed state)
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
        totalHeight += section.tasks.length * ROW_HEIGHT;
      }
    }
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Controls - Light Header */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-xl bg-card border border-border">
        {/* Breadcrumb placeholder */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Projects</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">Timeline</span>
        </div>

        {/* Center controls */}
        <div className="flex items-center gap-2 mx-auto">
          {/* Navigation arrows */}
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-accent text-foreground"
            onClick={() => navigatePeriod('prev')}
            title="Previous period (← Arrow)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* View mode toggle - Segmented control */}
          <div className="flex items-center rounded-lg p-1 bg-muted border border-border">
            {(['week', 'month', 'project'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 px-4 text-xs font-semibold tracking-wide capitalize transition-all duration-200",
                  viewMode === mode 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => handleViewModeChange(mode)}
              >
                {mode === 'week' ? 'Weekly' : mode === 'month' ? 'Monthly' : 'Project'}
              </Button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 hover:bg-accent text-foreground"
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
                className="h-9 gap-2 px-4 hover:bg-accent text-foreground border border-border rounded-lg"
              >
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium tracking-wide">
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
                      </>
                    ) : (
                      format(dateRange.from, 'MMM d, yyyy')
                    )
                  ) : (
                    'Select date range'
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
                numberOfMonths={2}
                className="pointer-events-auto"
              />
              <div className="flex items-center justify-between p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ from: projectStartDate, to: projectEndDate })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Reset to project dates
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Right side info */}
        <div className="flex items-center gap-4 ml-auto">
          {/* Working days badge */}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
            {workingDays.length} working days left
          </span>

          {/* Legend tooltip */}
          <TooltipProvider>
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
                    <div className="w-4 h-4 bg-foreground/80 rotate-45 rounded-sm shrink-0" />
                    <span><strong>Diamond</strong> — Recurring meeting</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Flag className="w-4 h-4 text-amber-500 shrink-0" />
                    <span><strong>Flag</strong> — Milestone</span>
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
          </TooltipProvider>
        </div>
      </div>

      {/* Gantt Chart - Light Theme */}
      <div className="relative overflow-auto rounded-xl bg-muted border border-border shadow-sm" ref={containerRef}>
        <div className="relative flex bg-muted" style={{ height: totalHeight }}>
          {/* Fixed task names column - Left Sidebar */}
          <div className="sticky left-0 z-20 bg-muted border-r border-border shrink-0" style={{ width: TASK_COLUMN_WIDTH }}>
            {/* Header */}
            <div 
              className="flex items-center px-4 border-b border-border bg-muted/50 font-semibold text-sm tracking-wide uppercase"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="text-foreground">Tasks</span>
            </div>

            {/* Section rows (phases + client check-ins) */}
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
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: sectionColor }}
                    />
                    <span className="font-semibold text-sm tracking-wide text-foreground truncate">{sectionName}</span>
                    <div className="ml-auto flex items-center gap-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
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
                      className="flex items-center gap-3 px-4 group"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="w-4 shrink-0" />
                      <Users className="w-4 h-4 text-amber-500 shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">{section.task.name}</span>
                      
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
                        {section.task.recurring_dates?.length || 0} meetings
                      </span>
                    </div>
                  )}

                  {/* Task rows - only show if not collapsed (for phases only) */}
                  {!isCollapsed && section.type === 'phase' && section.tasks.map((task) => {
                    const startDate = task.start_date ? new Date(task.start_date) : null;
                    const endDate = task.end_date ? new Date(task.end_date) : null;
                    const duration = startDate && endDate 
                      ? differenceInDays(endDate, startDate) + 1 
                      : null;

                    return (
                      <div 
                        key={task.id}
                        className="flex items-center gap-2 px-3 group hover:bg-muted/30 transition-colors"
                        style={{ height: ROW_HEIGHT }}
                      >
                        {/* Drag handle + Delete - only show when not readOnly */}
                        {!readOnly && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
                            {onDeleteTask && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteTask(task.id);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/20 rounded transition-all"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Task type icon */}
                        {task.task_type === 'milestone' && <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {task.task_type === 'meeting' && <Users className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {task.task_type === 'task' && <div className="w-3.5 shrink-0" />}
                        
                        {/* Task name - more space */}
                        <span className="text-xs font-medium text-foreground truncate flex-1 min-w-0">{task.name}</span>
                        
                        {/* Task data: days, start → end - pushed to the right */}
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 ml-auto">
                          {duration !== null && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-muted">
                              {duration}d
                            </span>
                          )}
                          {startDate && (
                            <span className="font-medium">
                              {format(startDate, 'MMM d')}
                            </span>
                          )}
                          {startDate && endDate && (
                            <span className="opacity-50">→</span>
                          )}
                          {endDate && (
                            <span className="font-medium">
                              {format(endDate, 'MMM d')}
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

          {/* Timeline area */}
          <div 
            className={cn(
              "relative flex-1 min-w-0 bg-muted",
              slideDirection === 'left' && "animate-slide-left",
              slideDirection === 'right' && "animate-slide-right"
            )}
            ref={timelineRef}
            onMouseMove={dragging ? (e) => handleDragMove(e.nativeEvent) : undefined}
            onMouseUp={dragging ? handleDragEnd : undefined}
            onMouseLeave={dragging ? handleDragEnd : undefined}
          >
            {/* Column headers */}
            <div 
              className="flex border-b border-border bg-muted/50 sticky top-0 z-10"
              style={{ height: HEADER_HEIGHT }}
            >
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
                        const meetingDate = new Date(dateStr);
                        const left = dateToX(meetingDate);
                        
                        // Check if this date is visible in current view
                        const colIndex = groupedColumns.findIndex(col => 
                          isSameDay(col.startDate, meetingDate)
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

                  {/* Task bars - only show if not collapsed (for phases only) */}
                  {!isCollapsed && section.type === 'phase' && section.tasks.map((task) => {
                    const isCurrentlyDragging = dragging?.taskId === task.id;
                    const isJustDropped = justDropped === task.id;
                    const displayStart = isCurrentlyDragging && dragPreview ? dragPreview.start : (task.start_date ? new Date(task.start_date) : null);
                    const displayEnd = isCurrentlyDragging && dragPreview ? dragPreview.end : (task.end_date ? new Date(task.end_date) : null);

                    // Calculate durations for preview
                    const currentDuration = displayStart && displayEnd ? differenceInDays(displayEnd, displayStart) + 1 : null;
                    const originalDuration = dragging?.originalDuration;
                    const isResizing = isCurrentlyDragging && (dragging?.type === 'resize-start' || dragging?.type === 'resize-end');
                    const durationChanged = isResizing && originalDuration && currentDuration !== originalDuration;

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

                    // Check if task overlaps with visible range
                    const firstColDate = groupedColumns.length > 0 ? startOfDay(groupedColumns[0].startDate) : null;
                    const lastColDate = groupedColumns.length > 0 ? startOfDay(groupedColumns[groupedColumns.length - 1].startDate) : null;
                    const taskStartDay = startOfDay(displayStart);
                    const taskEndDay = startOfDay(displayEnd);
                    
                    // Skip rendering if task is completely outside visible range
                    const isOutsideView = firstColDate && lastColDate && 
                      (taskEndDay < firstColDate || taskStartDay > lastColDate);

                    // Calculate clipped position and width for tasks that partially overlap
                    let clippedLeft = dateToX(displayStart);
                    let clippedWidth = getTaskWidth(displayStart, displayEnd);
                    
                    // If task starts before view, clip to start at 0
                    if (firstColDate && taskStartDay < firstColDate) {
                      clippedLeft = 0;
                      // Recalculate width from first visible column to task end
                      clippedWidth = getTaskWidth(firstColDate, displayEnd);
                    }

                    return (
                      <div key={task.id} className="relative" style={{ height: ROW_HEIGHT }}>
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

                        {/* Task bar - Phase colored */}
                        {!isOutsideView && clippedWidth > 0 && (
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div
                                className={cn(
                                  "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move",
                                  "hover:shadow-xl hover:ring-2 hover:ring-white/40",
                                  "transition-all duration-300 ease-out shadow-md",
                                  isCurrentlyDragging && "opacity-90 ring-2 ring-white shadow-2xl !transition-none",
                                  isJustDropped && "animate-spring-settle",
                                  task.task_type === 'milestone' && "rounded-full"
                                )}
                                style={{
                                  left: clippedLeft + 2,
                                  width: task.task_type === 'milestone' ? 24 : clippedWidth - 4,
                                  background: `linear-gradient(135deg, ${sectionColor} 0%, ${sectionColor}dd 100%)`,
                                  boxShadow: `0 4px 12px ${sectionColor}66`,
                                }}
                                onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, task, 'move')}
                              >
                                {task.task_type !== 'milestone' && (
                                  <>
                                    {/* Resize handle - start */}
                                    {!readOnly && (
                                      <div
                                        className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l-md"
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          handleDragStart(e, task, 'resize-start');
                                        }}
                                      />
                                    )}

                                    {/* Task name */}
                                    <div className="absolute inset-0 flex items-center justify-center px-3 overflow-hidden">
                                      <span className="text-xs font-semibold text-white truncate drop-shadow-md tracking-wide">
                                        {clippedWidth > 60 ? task.name : ''}
                                      </span>
                                    </div>

                                    {/* Resize handle - end */}
                                    {!readOnly && (
                                      <div
                                        className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r-md"
                                        onMouseDown={(e) => {
                                          e.stopPropagation();
                                          handleDragStart(e, task, 'resize-end');
                                        }}
                                      />
                                    )}
                                  </>
                                )}

                              {/* Duration preview tooltip during resize */}
                              {durationChanged && (
                                <div 
                                  className="absolute -top-10 left-1/2 -translate-x-1/2 bg-card text-foreground px-3 py-2 rounded-lg shadow-xl text-xs font-semibold whitespace-nowrap z-50 animate-fade-in border border-border"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-muted-foreground line-through opacity-70">{originalDuration}d</span>
                                    <span className="text-amber-500">→</span>
                                    <span className={cn(
                                      "font-bold",
                                      currentDuration! > originalDuration! ? "text-green-600" : "text-amber-600"
                                    )}>
                                      {currentDuration}d
                                    </span>
                                    <span className={cn(
                                      "text-[10px]",
                                      currentDuration! > originalDuration! ? "text-green-600" : "text-amber-600"
                                    )}>
                                      ({currentDuration! > originalDuration! ? '+' : ''}{currentDuration! - originalDuration!})
                                    </span>
                                  </div>
                                  {/* Tooltip arrow */}
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-card" />
                                </div>
                              )}
                              </div>
                            </TooltipTrigger>
                            {viewMode === 'project' && (
                              <TooltipContent side="top" className="font-semibold">
                                <p>{task.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {format(displayStart, 'MMM d')} → {format(displayEnd, 'MMM d')}
                                </p>
                              </TooltipContent>
                            )}
                          </Tooltip>
                        )}
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
                isSameDay(col.startDate, today)
              );
              if (todayColIndex === -1) return null;
              
              const todayX = todayColIndex * columnWidth + columnWidth / 2;
              return (
                <div
                  className="absolute w-0.5 bg-destructive z-30 pointer-events-none animate-pulse-subtle"
                  style={{ 
                    left: todayX,
                    top: 0,
                    height: totalHeight,
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
  );
}