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
  projectStartDate: Date;
  projectEndDate: Date;
  phases: Phase[];
  tasks: Task[];
  workingDaysMask: number;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskReorder: (phaseId: string, taskId: string, newIndex: number) => void;
  onAddTask: (phaseId: string) => void;
  onAddReviewRound: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
}

type ViewMode = 'week' | 'month';

const TASK_COLUMN_WIDTH = 340;
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const PHASE_HEADER_HEIGHT = 36;
const MIN_COLUMN_WIDTH = 36;

export function GanttChart({
  projectStartDate,
  projectEndDate,
  phases,
  tasks,
  workingDaysMask,
  onTaskUpdate,
  onTaskReorder,
  onAddTask,
  onAddReviewRound,
  onDeleteTask,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: projectStartDate,
    to: projectEndDate,
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

  // Both views show individual working days - just different date ranges
  const groupedColumns = useMemo(() => {
    return workingDays.map(day => ({
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'd'),
      subLabel: format(day, 'EEE'),
      days: [day],
      startDate: day,
      endDate: day,
      weekNumber: getWeek(day),
    }));
  }, [workingDays]);

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
    
    // Set minimum widths based on view mode
    const minWidths = { week: MIN_COLUMN_WIDTH, month: 60 };
    return Math.max(calculatedWidth, minWidths[viewMode]);
  }, [containerWidth, groupedColumns.length, viewMode]);

  const chartWidth = groupedColumns.length * columnWidth;

  // Update date range when view mode changes
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    
    const today = new Date();
    const baseDate = dateRange?.from || projectStartDate;
    
    if (mode === 'week') {
      // Weekly view: show 7 days (or working days within that range)
      const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      setDateRange({ from: weekStart, to: weekEnd });
    } else {
      // Monthly view: show ~30 days (a full month)
      const monthStart = startOfMonth(baseDate);
      const monthEnd = endOfMonth(monthStart);
      setDateRange({ from: monthStart, to: monthEnd });
    }
  }, [dateRange, projectStartDate]);

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
    } else {
      // Move by 1 month
      if (direction === 'prev') {
        newFrom = subMonths(dateRange.from, 1);
        newTo = subMonths(dateRange.to, 1);
      } else {
        newFrom = addMonths(dateRange.from, 1);
        newTo = addMonths(dateRange.to, 1);
      }
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
    const lastColStart = startOfDay(groupedColumns[groupedColumns.length - 1].startDate);
    
    // If before first column, clamp to 0
    if (targetDay < firstColStart) {
      return 0;
    }
    
    // If after last column, clamp to end
    if (targetDay > lastColStart) {
      return groupedColumns.length * columnWidth;
    }
    
    // Find which column this date falls into (exact match)
    for (let i = 0; i < groupedColumns.length; i++) {
      const col = groupedColumns[i];
      const colStart = startOfDay(col.startDate);
      
      if (isSameDay(targetDay, colStart)) {
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
  }, [groupedColumns, columnWidth]);

  // Calculate date from position
  const xToDate = useCallback((x: number) => {
    const colIndex = Math.round(x / columnWidth);
    const col = groupedColumns[Math.min(Math.max(0, colIndex), groupedColumns.length - 1)];
    return col?.days[0] || projectStartDate;
  }, [groupedColumns, columnWidth, projectStartDate]);

  // Calculate task width (counting working days only, clamped to visible range)
  const getTaskWidth = useCallback((start: Date, end: Date) => {
    if (groupedColumns.length === 0) return columnWidth;
    
    const startDay = startOfDay(start);
    const endDay = startOfDay(end);
    
    const firstColStart = startOfDay(groupedColumns[0].startDate);
    const lastColStart = startOfDay(groupedColumns[groupedColumns.length - 1].startDate);
    
    // Check if task overlaps with visible range at all
    if (endDay < firstColStart || startDay > lastColStart) {
      return 0; // Task is completely outside visible range
    }
    
    // Find start column index - the first column that is >= task start date
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
    
    // Find end column index - the last column that is <= task end date
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
  }, [groupedColumns, columnWidth]);

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
      .filter(phase => phase.name !== 'Discovery')
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
    totalHeight += PHASE_HEADER_HEIGHT;
    if (!isCollapsed) {
      if (section.type === 'weekly-call') {
        totalHeight += ROW_HEIGHT; // Single row for weekly call
      } else {
        totalHeight += section.tasks.length * ROW_HEIGHT;
        // Add space for "Add task" button only for phases
        totalHeight += ROW_HEIGHT;
      }
    }
  });

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Navigation arrows */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigatePeriod('prev')}
            title="Previous period (← Arrow)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border bg-muted/30 p-1">
            {(['week', 'month'] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs capitalize"
                onClick={() => handleViewModeChange(mode)}
              >
                {mode}ly
              </Button>
            ))}
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => navigatePeriod('next')}
            title="Next period (→ Arrow)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Date range picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="text-xs">
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
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
            <div className="flex items-center justify-between p-3 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDateRange({ from: projectStartDate, to: projectEndDate })}
              >
                Reset to project dates
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Working days info */}
        <span className="text-xs text-muted-foreground ml-auto">
          {workingDays.length} working days
        </span>

        {/* Legend tooltip */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground">
                <HelpCircle className="h-3.5 w-3.5" />
                <span className="text-xs">Legend</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="end" className="w-64 p-3">
              <div className="space-y-2.5 text-xs">
                <div className="font-medium text-sm mb-2">Chart Symbols</div>
                
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-primary rotate-45 rounded-sm shrink-0" />
                  <span><strong>Diamond</strong> — Recurring meeting (Weekly Call)</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-amber-500 shrink-0" />
                  <span><strong>Flag</strong> — Milestone</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-8 h-3 bg-primary/80 rounded-sm shrink-0" />
                  <span><strong>Bar</strong> — Task duration</span>
                </div>
                
                <div className="border-t pt-2 mt-2 text-muted-foreground">
                  <p><strong>Weekly view:</strong> Each diamond = one weekly meeting</p>
                  <p className="mt-1"><strong>Monthly view:</strong> Diamonds show all scheduled calls in the period</p>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Gantt Chart */}
      <div className="relative overflow-auto border rounded-lg bg-card" ref={containerRef}>
        <div className="relative flex" style={{ minHeight: totalHeight }}>
          {/* Fixed task names column */}
          <div className="sticky left-0 z-20 bg-card border-r shrink-0" style={{ width: TASK_COLUMN_WIDTH }}>
            {/* Header */}
            <div 
              className="flex items-center px-3 border-b bg-muted/50 font-medium"
              style={{ height: HEADER_HEIGHT }}
            >
              Tasks
            </div>

            {/* Section rows (phases + client check-ins) */}
            {orderedSections.map((section, sectionIndex) => {
              const sectionKey = section.type === 'phase' ? section.phase.id : 'weekly-call';
              const sectionName = section.type === 'phase' ? section.phase.name : 'Client Check-ins';
              const sectionColor = PHASE_CATEGORY_COLORS[sectionName as PhaseCategory] || '#9CA3AF';
              const isCollapsed = collapsedSections.has(sectionKey);
              const isWeeklyCall = section.type === 'weekly-call';

              return (
                <div key={sectionKey} className={isWeeklyCall ? 'bg-muted/20' : ''}>
                  {/* Section header */}
                  <div 
                    className="flex items-center gap-2 px-3 border-b bg-muted/30 font-medium text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    style={{ height: PHASE_HEADER_HEIGHT }}
                    onClick={() => toggleSectionCollapse(sectionKey)}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: sectionColor }}
                    />
                    <span className="truncate">{sectionName}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {section.type === 'weekly-call' 
                        ? section.task.recurring_dates?.length || 0
                        : section.tasks.length}
                    </Badge>
                  </div>

                  {/* Weekly call row - single row with meeting count */}
                  {isWeeklyCall && !isCollapsed && (
                    <div 
                      className="flex items-center gap-2 px-3 border-b hover:bg-muted/30 group"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="w-3 shrink-0" />
                      <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-sm truncate flex-1 min-w-0">{section.task.name}</span>
                      
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                        <span className="bg-muted px-1.5 py-0.5 rounded font-medium">
                          {section.task.recurring_dates?.length || 0} meetings
                        </span>
                      </div>
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
                        className="flex items-center gap-2 px-3 border-b hover:bg-muted/30 group"
                        style={{ height: ROW_HEIGHT }}
                      >
                        <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                        {task.task_type === 'milestone' && <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                        {task.task_type === 'meeting' && <Users className="w-3.5 h-3.5 text-primary shrink-0" />}
                        {task.task_type === 'task' && <div className="w-3.5 shrink-0" />}
                        <span className="text-sm truncate flex-1 min-w-0">{task.name}</span>
                        
                        {/* Task data: days, start, end */}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                          {duration !== null && (
                            <span className="bg-muted px-1.5 py-0.5 rounded font-medium transition-all duration-300">
                              {duration}d
                            </span>
                          )}
                          {startDate && (
                            <span className="hidden sm:inline">
                              {format(startDate, 'MMM d')}
                            </span>
                          )}
                          {startDate && endDate && (
                            <span className="hidden sm:inline text-muted-foreground/50">→</span>
                          )}
                          {endDate && (
                            <span className="hidden sm:inline">
                              {format(endDate, 'MMM d')}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => onAddReviewRound(task.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded shrink-0"
                          title="Add review round"
                        >
                          <RotateCcw className="w-3 h-3 text-muted-foreground" />
                        </button>

                        {onDeleteTask && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteTask(task.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded shrink-0"
                            title="Delete task"
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Add task button - only for phases and when not collapsed */}
                  {section.type === 'phase' && !isCollapsed && (
                    <div 
                      className="flex items-center px-3 border-b"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <button
                        onClick={() => onAddTask(section.phase.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add task
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline area */}
          <div 
            className={cn(
              "flex-1 min-w-0",
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
              className="flex border-b bg-muted/50 sticky top-0 z-10"
              style={{ height: HEADER_HEIGHT }}
            >
              {groupedColumns.map((col) => {
                const isToday = col.days.some(d => isSameDay(d, new Date()));
                const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                const monthLabel = format(col.startDate, 'MMM');

                return (
                  <div
                    key={col.key}
                    className={cn(
                      "flex flex-col items-center justify-center border-r text-xs shrink-0",
                      isToday && "bg-primary/10",
                      !isToday && isAlternateWeek && "bg-muted"
                    )}
                    style={{ width: columnWidth }}
                  >
                    <span className="font-medium">{col.label}</span>
                    <span className="text-muted-foreground text-[10px]">{col.subLabel}</span>
                    <span className="text-muted-foreground/60 text-[8px]">{monthLabel}</span>
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

              return (
                <div key={sectionKey} className={isWeeklyCall ? 'bg-muted/20' : ''}>
                  {/* Section header row */}
                  <div 
                    className={cn(
                      "border-b cursor-pointer hover:bg-muted/20 transition-colors",
                      isWeeklyCall && "bg-muted/30"
                    )}
                    style={{ height: PHASE_HEADER_HEIGHT }}
                    onClick={() => toggleSectionCollapse(sectionKey)}
                  >
                    <div className="flex h-full">
                      {groupedColumns.map((col) => {
                        const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                        return (
                          <div
                            key={col.key}
                            className={cn("border-r shrink-0", isAlternateWeek && "bg-muted")}
                            style={{ width: columnWidth }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* Weekly call row with diamond markers */}
                  {isWeeklyCall && !isCollapsed && (
                    <div className="relative border-b" style={{ height: ROW_HEIGHT }}>
                      {/* Grid background */}
                      <div className="absolute inset-0 flex">
                        {groupedColumns.map((col) => {
                          const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                          return (
                            <div
                              key={col.key}
                              className={cn("border-r shrink-0", isAlternateWeek && "bg-muted")}
                              style={{ width: columnWidth }}
                            />
                          );
                        })}
                      </div>

                      {/* Diamond markers for each recurring date */}
                      {section.task.recurring_dates?.map((dateStr, idx) => {
                        const meetingDate = new Date(dateStr);
                        const left = dateToX(meetingDate);
                        
                        // Check if this date is visible in current view
                        const colIndex = groupedColumns.findIndex(col => 
                          isSameDay(col.startDate, meetingDate)
                        );
                        if (colIndex === -1) return null;
                        
                        return (
                          <div
                            key={dateStr}
                            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rotate-45 rounded-sm shadow-md hover:scale-125 transition-transform cursor-default"
                            style={{ left: left + columnWidth / 2 - 8 }}
                            title={`Meeting ${idx + 1}: ${format(meetingDate, 'MMM d, yyyy')}`}
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
                      <div key={task.id} className="border-b" style={{ height: ROW_HEIGHT }}>
                        <div className="flex h-full">
                          {groupedColumns.map((col) => {
                            const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                            return (
                              <div
                                key={col.key}
                                className={cn("border-r shrink-0", isAlternateWeek && "bg-muted")}
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
                      <div key={task.id} className="relative border-b" style={{ height: ROW_HEIGHT }}>
                        {/* Grid background */}
                        <div className="absolute inset-0 flex">
                          {groupedColumns.map((col) => {
                            const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                            return (
                              <div
                                key={col.key}
                                className={cn("border-r shrink-0", isAlternateWeek && "bg-muted")}
                                style={{ width: columnWidth }}
                              />
                            );
                          })}
                        </div>

                        {/* Task bar - only render if within visible range */}
                        {!isOutsideView && clippedWidth > 0 && (
                          <div
                            className={cn(
                              "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move",
                              "hover:shadow-lg hover:ring-2 hover:ring-primary/30",
                              "transition-all duration-300 ease-out",
                              isCurrentlyDragging && "opacity-90 ring-2 ring-primary shadow-xl !transition-none",
                              isJustDropped && "animate-spring-settle",
                              task.task_type === 'milestone' && "rounded-full",
                              task.task_type === 'meeting' && "bg-primary/80"
                            )}
                            style={{
                              left: clippedLeft + 2,
                              width: task.task_type === 'milestone' ? 24 : clippedWidth - 4,
                              backgroundColor: task.task_type === 'milestone' 
                                ? '#F59E0B' 
                                : task.task_type === 'meeting'
                                  ? undefined
                                  : sectionColor,
                            }}
                            onMouseDown={(e) => handleDragStart(e, task, 'move')}
                          >
                            {task.task_type !== 'milestone' && (
                              <>
                                {/* Resize handle - start */}
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l-md"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, task, 'resize-start');
                                  }}
                                />

                                {/* Task name */}
                                <div className="absolute inset-0 flex items-center justify-center px-2 overflow-hidden">
                                  <span className="text-xs font-medium text-white truncate drop-shadow-sm">
                                    {clippedWidth > 60 ? task.name : ''}
                                  </span>
                                </div>

                                {/* Resize handle - end */}
                                <div
                                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r-md"
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleDragStart(e, task, 'resize-end');
                                  }}
                                />
                              </>
                            )}

                          {/* Duration preview tooltip during resize */}
                          {durationChanged && (
                            <div 
                              className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background px-2.5 py-1.5 rounded-md shadow-lg text-xs font-medium whitespace-nowrap z-50 animate-fade-in"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground line-through opacity-70">{originalDuration}d</span>
                                <span className="text-primary">→</span>
                                <span className={cn(
                                  "font-bold",
                                  currentDuration! > originalDuration! ? "text-green-400" : "text-amber-400"
                                )}>
                                  {currentDuration}d
                                </span>
                                <span className={cn(
                                  "text-[10px]",
                                  currentDuration! > originalDuration! ? "text-green-400" : "text-amber-400"
                                )}>
                                  ({currentDuration! > originalDuration! ? '+' : ''}{currentDuration! - originalDuration!})
                                </span>
                              </div>
                              {/* Tooltip arrow */}
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                            </div>
                          )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Add task row - only for phases and when not collapsed */}
                  {section.type === 'phase' && !isCollapsed && (
                    <div className="border-b" style={{ height: ROW_HEIGHT }}>
                      <div className="flex h-full">
                        {groupedColumns.map((col) => (
                          <div
                            key={col.key}
                            className="border-r shrink-0"
                            style={{ width: columnWidth }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Today marker */}
            {(() => {
              const today = new Date();
              const todayColIndex = groupedColumns.findIndex(col => 
                col.days.some(d => isSameDay(d, today))
              );
              if (todayColIndex !== -1) {
                const todayX = todayColIndex * columnWidth;
                return (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-destructive z-30 pointer-events-none"
                    style={{ left: todayX + columnWidth / 2 }}
                  >
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-destructive" />
                  </div>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}