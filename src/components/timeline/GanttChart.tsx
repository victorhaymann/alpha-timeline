import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { Task, Phase, PhaseCategory, PHASE_CATEGORY_COLORS, TaskSegment } from '@/types/database';
import { useDragAndResize, DragResult } from '@/hooks/useDragAndResize';
import { useVerticalReorder } from '@/hooks/useVerticalReorder';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverAnchor,
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
import { InlineDatePicker } from './InlineDatePicker';
import { GanttHeader } from './GanttHeader';
import { useTaskPopover } from './useTaskPopover';
import { TaskPopoverMenu } from './TaskPopoverMenu';
import { ReviewNotesDialog } from './ReviewNotesDialog';
import { ReviewNotesViewDialog } from './ReviewNotesViewDialog';
import { StaffAssignmentPopover } from '@/components/staff/StaffAssignmentPopover';
import { 
  useGanttCalculations, 
  isValidDate, 
  safeParseDate, 
  safeFormat, 
  safeDifferenceInDays, 
  safeIsSameDay 
} from './useGanttCalculations';
import { 
  ViewMode,
  ROW_HEIGHT,
  REVIEW_SUB_ROW_HEIGHT,
  MONTH_ROW_HEIGHT,
  WEEK_ROW_HEIGHT,
  DAY_ROW_HEIGHT,
  HEADER_HEIGHT,
  PHASE_HEADER_HEIGHT,
  PHASE_SEPARATOR_HEIGHT,
  TASK_COLUMN_WIDTH_DESKTOP,
  TASK_COLUMN_WIDTH_MOBILE,
  MIN_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH_MOBILE,
} from './ganttTypes';
import { 
  Flag, 
  Users, 
  GripVertical,
  Plus,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Layers,
  MoreHorizontal,
  CalendarIcon,
  HelpCircle,
  FileText,
} from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { 
  format, 
  addDays,
  differenceInDays,
  startOfDay,
  startOfWeek,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface GanttChartProps {
  projectId: string;
  projectStartDate: Date;
  projectEndDate: Date;
  phases: Phase[];
  tasks: Task[];
  segments: TaskSegment[];
  workingDaysMask: number;
  checkinTime?: string | null;
  checkinDuration?: number | null;
  checkinTimezone?: string | null;
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => void;
  onTaskReorder: (sourcePhaseId: string, targetPhaseId: string, taskId: string, newIndex: number) => void;
  onAddTask: (phaseId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onAddReviewSegment?: (taskId: string) => void;
  onAddMeeting?: () => void;
  onDeleteMeeting?: (taskId: string) => void;
  onUpdateSegment?: (segmentId: string, updates: Partial<TaskSegment>) => void;
  onDragComplete: (result: DragResult) => void;
  hiddenMeetingDates?: Set<string>;
  onToggleMeetingVisibility?: (date: string, hidden: boolean) => void;
  readOnly?: boolean;
}

// Section type for organizing the Gantt chart
type Section = { 
  type: 'phase'; 
  phase: Phase; 
  tasks: Task[];
} | { type: 'weekly-call'; task: Task };

export function GanttChart({
  projectId,
  projectStartDate,
  projectEndDate,
  phases,
  tasks,
  segments,
  workingDaysMask,
  checkinTime,
  checkinDuration,
  checkinTimezone,
  onTaskUpdate,
  onTaskReorder,
  onAddTask,
  onDeleteTask,
  onAddReviewSegment,
  onAddMeeting,
  onDeleteMeeting,
  onUpdateSegment,
  onDragComplete,
  hiddenMeetingDates,
  onToggleMeetingVisibility,
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
  
  // Always use full project range so the timeline is physically scrollable
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    return { from: validStartDate, to: validEndDate };
  });
  const [containerWidth, setContainerWidth] = useState(800);
  
  // Visible date range computed from scroll position (for header display)
  const [visibleDateRange, setVisibleDateRange] = useState<DateRange | undefined>(undefined);
  
  // Track mode changes to trigger auto-scroll (start with 'month' to scroll to today on first render)
  const [scrollTarget, setScrollTarget] = useState<ViewMode | null>('month');
  
  // Sync dateRange when project dates change
  useEffect(() => {
    setDateRange({ from: validStartDate, to: validEndDate });
  }, [validStartDate.getTime(), validEndDate.getTime()]);
  
  // Collapsed sections removed - flat layout, all tasks always visible
  
  // Inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // Review notes dialog state
  const [reviewNotesDialog, setReviewNotesDialog] = useState<{
    open: boolean;
    segmentId: string;
    taskName: string;
    notes: string;
  } | null>(null);
  
  // Client-side review notes view dialog state
  const [reviewNotesViewDialog, setReviewNotesViewDialog] = useState<{
    open: boolean;
    taskName: string;
    notes: string;
    startDate?: string;
    endDate?: string;
  } | null>(null);

  // Local segments state for optimistic updates of review_notes
  const [localSegmentNotes, setLocalSegmentNotes] = useState<Record<string, string>>({});

  // Handle starting task name edit (simplified - no cascade context needed)
  const handleStartEdit = useCallback((taskId: string, currentName: string) => {
    if (readOnly) return;
    setEditingTaskId(taskId);
    setEditingTaskName(currentName);
  }, [readOnly]);

  // Handle saving task name edit (simplified - no cascade rename)
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

  // toggleSectionCollapse removed - flat layout

  // View date range (use custom range or project range)
  const viewStart = dateRange?.from || validStartDate;
  const viewEnd = dateRange?.to || validEndDate;

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

  // Use the extracted calculations hook
  const {
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
  } = useGanttCalculations({
    viewStart,
    viewEnd,
    workingDaysMask,
    viewMode,
    containerWidth,
    projectStartDate: validStartDate,
    isMobile,
  });

  const chartWidth = groupedColumns.length * columnWidth;

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
    
    // Update visible date range from scroll position
    if (rightBodyRef.current && groupedColumns.length > 0) {
      const scrollLeft = rightBodyRef.current.scrollLeft;
      const visibleWidth = rightBodyRef.current.clientWidth;
      const fromDate = xToDate(scrollLeft);
      const toDate = xToDate(scrollLeft + visibleWidth);
      setVisibleDateRange({ from: fromDate, to: toDate });
    }
    
    requestAnimationFrame(() => { isSyncingScroll.current = false; });
  }, [groupedColumns, xToDate]);

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
    getSegmentDragPreview,
  } = useDragAndResize({
    columnWidth,
    onDragComplete,
    readOnly,
    isWorkingDay,
    columnsAreWeeks: viewMode === 'project',
    projectStartDate: validStartDate,
    projectEndDate: validEndDate,
  });

  // Task popover hook - consolidated menu state and handlers
  const {
    openTaskMenuId,
    hoveredSegmentId,
    taskMenuPos,
    setOpenTaskMenuId,
    setHoveredSegmentId,
    handleTaskBarMouseEnter,
    handleTaskBarMouseLeave,
    handlePopoverMouseEnter,
    handlePopoverMouseLeave,
    handleMenuButtonClick,
    closeMenu: closeTaskMenu,
  } = useTaskPopover({ readOnly, isDraggingAny });

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
    // dateRange stays full project for all modes
    setDateRange({ from: validStartDate, to: validEndDate });
    // Trigger auto-scroll to appropriate position
    setScrollTarget(mode);
  }, [validStartDate, validEndDate]);

  // Navigate to previous/next period based on view mode
  const navigatePeriod = useCallback((direction: 'prev' | 'next') => {
    if (!rightBodyRef.current) return;
    
    if (viewMode === 'project') return; // No navigation in project view
    
    const sign = direction === 'next' ? 1 : -1;
    let pixelOffset: number;
    
    if (viewMode === 'week') {
      // Scroll by 5 working day columns (1 week)
      pixelOffset = 5 * columnWidth * sign;
    } else {
      // Scroll by ~22 working day columns (1 month)
      pixelOffset = 22 * columnWidth * sign;
    }
    
    rightBodyRef.current.scrollBy({ left: pixelOffset, behavior: 'smooth' });
  }, [viewMode, columnWidth]);

  // Auto-scroll to correct position on mode change
  useEffect(() => {
    if (!scrollTarget || !rightBodyRef.current || groupedColumns.length === 0) return;
    
    const today = new Date();
    let targetX = 0;
    
    if (scrollTarget === 'week') {
      const monday = startOfWeek(today, { weekStartsOn: 1 });
      targetX = dateToX(monday);
    } else if (scrollTarget === 'month') {
      targetX = dateToX(today);
    }
    // project: scroll to 0
    
    rightBodyRef.current.scrollLeft = targetX;
    // Also sync header
    if (rightHeaderRef.current) {
      rightHeaderRef.current.scrollLeft = targetX;
    }
    setScrollTarget(null);
  }, [scrollTarget, groupedColumns, columnWidth, dateToX]);

  // Keyboard navigation for horizontal scrolling and period navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
        if (rightBodyRef.current) {
          rightBodyRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
      } else if (e.key === 'End') {
        e.preventDefault();
        if (rightBodyRef.current) {
          rightBodyRef.current.scrollTo({ left: rightBodyRef.current.scrollWidth, behavior: 'smooth' });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigatePeriod]);

  // Helper to check if a task is a client check-in (legacy) or consolidated call
  const isClientCheckin = useCallback((task: Task) => {
    const n = task.name.toLowerCase();
    return n.includes('client check-in') || n.includes('client checkin') || n.includes('weekly call') || n.includes('bi-weekly call');
  }, []);

  // Legacy isFeedbackTask helper removed - now using inline segments for reviews

  // Legacy review cycle grouping removed - now using inline segments instead
  // Tasks with review segments are displayed as a single row with connected segments

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

    // For client views (readOnly), filter out hidden meeting dates completely
    if (readOnly && hiddenMeetingDates && hiddenMeetingDates.size > 0) {
      recurring_dates = recurring_dates.filter(date => !hiddenMeetingDates.has(date));
    }

    return {
      ...first,
      id: 'consolidated-weekly-call',
      name: 'Weekly Call',
      start_date: first.start_date,
      end_date: last.end_date || last.start_date,
      recurring_dates,
    } satisfies Task;
  }, [checkinTasks, projectEndDate, isWorkingDay, readOnly, hiddenMeetingDates]);

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
  // Simplified: no more cycle grouping - all tasks rendered as single rows with inline segments
  type Section = { 
    type: 'phase'; 
    phase: Phase; 
    tasks: Task[];
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
        sections.push({ type: 'phase', phase, tasks: phaseTasks });
      });

    return sections;
  }, [phases, tasksByPhase, consolidatedWeeklyCall]);


  // Calculate total chart height based on sections (flat layout with phase separators)
  let totalHeight = HEADER_HEIGHT;
  orderedSections.forEach((section, sectionIndex) => {
    const isWeeklyCall = section.type === 'weekly-call';
    const hasNoMeetings =
      isWeeklyCall && (!section.task?.recurring_dates || section.task.recurring_dates.length === 0);

    // Skip sections that won't be rendered
    if (hasNoMeetings) return;

    // Phase separator (thin label row) - skip for first visible section and weekly calls
    if (section.type === 'phase') {
      totalHeight += PHASE_SEPARATOR_HEIGHT;
    }

    if (section.type === 'weekly-call') {
      totalHeight += PHASE_SEPARATOR_HEIGHT + ROW_HEIGHT; // separator + single row
    } else {
      section.tasks.forEach(task => {
        totalHeight += ROW_HEIGHT;
        // Add review sub-row height if task has review segments
        const hasReviewSegments = segments.some(s => s.task_id === task.id && s.segment_type === 'review');
        if (hasReviewSegments) {
          totalHeight += REVIEW_SUB_ROW_HEIGHT;
        }
      });
    }
  });

  return (
    <>
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
                  {(() => {
                    const displayRange = visibleDateRange || dateRange;
                    if (!displayRange?.from) return 'Dates';
                    if (displayRange.to) {
                      return `${format(displayRange.from, 'MMM d')} - ${format(displayRange.to, 'MMM d')}`;
                    }
                    return format(displayRange.from, 'MMM d');
                  })()}
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
      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto" ref={containerRef}>
        <div className="flex" style={{ height: totalHeight, minWidth: isMobile ? taskColumnWidth + 200 : undefined }}>
          {/* Left Pane - Fixed Tasks Column (no horizontal scroll) */}
          <div className="flex flex-col shrink-0 bg-card border-r border-border z-20 sticky left-0" style={{ width: taskColumnWidth }}>
            {/* Tasks Header - Fixed */}
            <div 
              className="flex items-center px-2 md:px-4 border-b border-border bg-muted/30 shrink-0"
              style={{ height: HEADER_HEIGHT }}
            >
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tasks</span>
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
                    "relative"
                  )}
                  onMouseEnter={() => {
                    if (isVerticalDragging && section.type === 'phase') {
                      handlePhaseHover(section.phase.id, section.tasks.length);
                    }
                  }}
                >
                  {/* Drop indicator line */}
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
                        height: ROW_HEIGHT,
                        top: PHASE_SEPARATOR_HEIGHT + ghostInfo.originalIndex * ROW_HEIGHT,
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Phase separator label (subtle, thin) */}
                  <div 
                    className="flex items-center gap-2 px-3 md:px-4 group/separator"
                    style={{ height: PHASE_SEPARATOR_HEIGHT }}
                  >
                    <div 
                      className="w-1 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: sectionColor }}
                    />
                    <span className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground truncate">{sectionName}</span>
                    {section.type === 'phase' && !readOnly && (
                      <div className="ml-auto flex items-center gap-1.5 opacity-0 group-hover/separator:opacity-100 transition-opacity">
                        <StaffAssignmentPopover phaseId={section.phase.id} projectId={projectId} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddTask(section.phase.id);
                          }}
                          className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Add task"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    {isWeeklyCall && !readOnly && onAddMeeting && (
                      <div className="ml-auto opacity-0 group-hover/separator:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddMeeting();
                          }}
                          className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Add meeting"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Weekly call row */}
                  {isWeeklyCall && (
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

                  {/* Task rows - flat, one per task */}
                  {section.type === 'phase' && section.tasks.map((task, taskIndex) => {
                    const taskSegments = segments.filter(s => s.task_id === task.id).sort((a, b) => a.order_index - b.order_index);
                    
                    const effectiveStartStr = taskSegments.length > 0 
                      ? taskSegments.reduce((min, s) => s.start_date < min ? s.start_date : min, taskSegments[0].start_date)
                      : task.start_date;
                    const effectiveEndStr = taskSegments.length > 0
                      ? taskSegments.reduce((max, s) => s.end_date > max ? s.end_date : max, taskSegments[0].end_date)
                      : task.end_date;

                    const startDate = safeParseDate(effectiveStartStr);
                    const endDate = safeParseDate(effectiveEndStr);
                    const workingDuration = startDate && endDate ? getWorkingDaysDuration(startDate, endDate) : null;

                    const insertionGap = shouldShowInsertionGap(taskIndex, section.phase.id);

                    const reviewSegments = taskSegments.filter(s => s.segment_type === 'review');
                    const hasReviewSegments = reviewSegments.length > 0;

                    return (
                      <React.Fragment key={task.id}>
                      <div
                        className={cn(
                          "flex items-center gap-1 md:gap-2 px-2 md:px-4 group hover:bg-muted/20 transition-colors border-b border-border/30",
                          getVerticalDragClasses(task.id),
                          getSwapTargetClasses(task.id, taskIndex, section.phase.id),
                          insertionGap && "gantt-insertion-gap"
                        )}
                        style={{ 
                          height: ROW_HEIGHT,
                          ...getVerticalDragStyles(task.id, taskIndex, section.phase.id),
                        }}
                      >
                        {/* Grip handle for reordering */}
                        {!readOnly && (
                          <div 
                            className="flex items-center justify-center w-4 md:w-5 h-full cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                            onMouseDown={(e) => handleVerticalDragStart(e, task.id, task.name, section.phase.id, taskIndex)}
                          >
                            <GripVertical className="w-3 md:w-3.5 h-3 md:h-3.5" />
                          </div>
                        )}

                        {/* Phase color dot */}
                        <div 
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: sectionColor }}
                        />

                        {/* Task name - editable */}
                        {editingTaskId === task.id ? (
                          <input
                            ref={editInputRef}
                            className="flex-1 min-w-0 text-xs md:text-sm font-medium bg-transparent border-b border-primary/50 outline-none text-foreground px-0.5"
                            value={editingTaskName}
                            onChange={(e) => setEditingTaskName(e.target.value)}
                            onBlur={handleSaveEdit}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                        ) : (
                          <span 
                            className={cn(
                              "text-xs md:text-sm font-medium text-foreground truncate flex-1 min-w-0",
                              !readOnly && "cursor-text hover:text-primary/80"
                            )}
                            onDoubleClick={() => handleStartEdit(task.id, task.name)}
                          >
                            {task.name}
                          </span>
                        )}

                        {/* Duration badge */}
                        {workingDuration !== null && (
                          <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground shrink-0">
                            {workingDuration}d
                          </span>
                        )}

                        {/* Inline date pickers */}
                        <div className="hidden md:flex items-center gap-1 shrink-0">
                          {startDate && (
                            <InlineDatePicker
                              date={startDate}
                              onDateChange={(newDate) => {
                                const newDateStr = format(newDate, 'yyyy-MM-dd');
                                if (taskSegments.length > 0 && onUpdateSegment) {
                                  const earliestSeg = taskSegments.reduce((min, s) => 
                                    s.start_date < min.start_date ? s : min, taskSegments[0]);
                                  onUpdateSegment(earliestSeg.id, { start_date: newDateStr });
                                } else {
                                  onTaskUpdate(task.id, { start_date: newDateStr });
                                }
                              }}
                              disabled={readOnly}
                              className="text-[11px]"
                              minDate={validStartDate}
                              maxDate={validEndDate}
                            />
                          )}
                          {startDate && endDate && (
                            <span className="text-muted-foreground text-[10px]">→</span>
                          )}
                          {endDate && (
                            <InlineDatePicker
                              date={endDate}
                              onDateChange={(newDate) => {
                                const newDateStr = format(newDate, 'yyyy-MM-dd');
                                if (taskSegments.length > 0 && onUpdateSegment) {
                                  const latestSeg = taskSegments.reduce((max, s) => 
                                    s.end_date > max.end_date ? s : max, taskSegments[0]);
                                  onUpdateSegment(latestSeg.id, { end_date: newDateStr });
                                } else {
                                  onTaskUpdate(task.id, { end_date: newDateStr });
                                }
                              }}
                              disabled={readOnly}
                              className="text-[11px]"
                              minDate={validStartDate}
                              maxDate={validEndDate}
                            />
                          )}
                        </div>

                        {/* Delete button on hover */}
                        {!readOnly && onDeleteTask && (
                          <button
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-destructive rounded shrink-0"
                            onClick={() => onDeleteTask(task.id)}
                            title="Delete task"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Review sub-row label */}
                      {hasReviewSegments && (
                        <div
                          className="flex items-center gap-1 px-2 md:px-4 border-b border-border/20"
                          style={{ height: REVIEW_SUB_ROW_HEIGHT }}
                        >
                          <div className="w-4 md:w-5 shrink-0" />
                          <div className="w-2 shrink-0" />
                          <span className="text-[10px] text-muted-foreground font-medium tracking-wide pl-1">
                            ↳ Reviews ({reviewSegments.length})
                          </span>
                        </div>
                      )}
                      </React.Fragment>
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
              className="overflow-x-hidden shrink-0 border-b border-border bg-muted/30"
              style={{ height: HEADER_HEIGHT }}
            >
              {/* Month Row */}
              <div className="flex border-b border-border/10" style={{ height: MONTH_ROW_HEIGHT, width: chartWidth }}>
                {monthGroups.map((group, idx) => (
                  <div
                    key={`month-${group.monthLabel}-${idx}`}
                    className="flex items-center justify-center text-[10px] font-medium text-muted-foreground border-r border-border/10 shrink-0"
                    style={{ width: group.count * columnWidth }}
                  >
                    {group.monthLabel}
                  </div>
                ))}
              </div>

              {/* Week Row */}
              <div className="flex border-b border-border/10" style={{ height: WEEK_ROW_HEIGHT, width: chartWidth }}>
                {weekGroups.map((group, idx) => (
                    <div
                      key={`week-${group.weekLabel}-${idx}`}
                      className="flex items-center justify-center text-[10px] font-medium text-muted-foreground border-r border-border/10 shrink-0"
                      style={{ width: group.count * columnWidth }}
                    >
                      {group.weekLabel}
                    </div>
                ))}
              </div>

              {/* Day Row */}
              <div className="flex" style={{ height: DAY_ROW_HEIGHT, width: chartWidth }}>
                {groupedColumns.map((col) => {
                  const isToday = col.days.some(d => isSameDay(d, new Date()));

                  return (
                    <div
                      key={col.key}
                      className={cn(
                        "flex items-center justify-center shrink-0 border-r border-border/10",
                        isToday && "bg-destructive/10"
                      )}
                      style={{ width: columnWidth }}
                    >
                      <span className="text-[9px] text-muted-foreground">{col.subLabel || format(col.days[0], 'EEE').charAt(0)}</span>
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
                  const isWeeklyCall = section.type === 'weekly-call';
                  
                  // Hide Client Check-ins section when it has no meetings
                  const hasNoMeetings = isWeeklyCall && (!section.task.recurring_dates || section.task.recurring_dates.length === 0);
                  if (hasNoMeetings) return null;

                  return (
                    <div key={sectionKey}>
                      {/* Phase separator row (thin, matches left pane) */}
                      <div 
                        className="bg-transparent"
                        style={{ height: PHASE_SEPARATOR_HEIGHT }}
                      >
                        <div className="flex h-full">
                          {groupedColumns.map((col) => {
                            return (
                              <div
                                key={col.key}
                                className="shrink-0 border-r border-border/10"
                                style={{ width: columnWidth }}
                              />
                            );
                          })}
                        </div>
                      </div>

                      {/* Weekly call row with diamond markers */}
                      {isWeeklyCall && (
                        <div className="relative" style={{ height: ROW_HEIGHT }}>
                          {/* Grid background */}
                          <div className="absolute inset-0 flex">
                            {groupedColumns.map((col) => {
                              const isAlternateWeek = weekAlternatingMap[col.weekNumber];
                              return (
                                <div
                                  key={col.key}
                                  className="shrink-0 border-r border-border/10"
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
                            
                            const isHidden = hiddenMeetingDates?.has(dateStr) ?? false;
                            
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
                                isHiddenFromClient={isHidden}
                                onToggleClientVisibility={onToggleMeetingVisibility ? (hidden) => onToggleMeetingVisibility(dateStr, hidden) : undefined}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* All task bars - continuous work bar + review sub-row */}
                      {section.type === 'phase' && section.tasks.map((task) => {
                        const isCurrentlyDragging = dragging?.taskId === task.id && !dragging?.segmentId;
                        const isJustDropped = justDropped === task.id;
                        
                        // Use segment-derived dates when segments exist (single source of truth)
                        const taskSegments = segments.filter(s => s.task_id === task.id).sort((a, b) => a.order_index - b.order_index);
                        const effectiveStartStr = taskSegments.length > 0 
                          ? taskSegments.reduce((min, s) => s.start_date < min ? s.start_date : min, taskSegments[0].start_date)
                          : task.start_date;
                        const effectiveEndStr = taskSegments.length > 0
                          ? taskSegments.reduce((max, s) => s.end_date > max ? s.end_date : max, taskSegments[0].end_date)
                          : task.end_date;
                        
                        // Synthetic task with effective dates so drag hook uses visual position
                        const dragTask = taskSegments.length > 0
                          ? { ...task, start_date: effectiveStartStr, end_date: effectiveEndStr }
                          : task;

                        const displayStart = isCurrentlyDragging && dragPreview ? dragPreview.start : safeParseDate(effectiveStartStr);
                        const displayEnd = isCurrentlyDragging && dragPreview ? dragPreview.end : safeParseDate(effectiveEndStr);

                        const isFeedback = task.is_feedback_meeting || task.task_type === 'meeting';
                        const reviewSegments = taskSegments.filter(s => s.segment_type === 'review');
                        const hasReviewSegments = reviewSegments.length > 0;

                        // Grid background helper
                        const renderGridBg = (height: number) => (
                          <div className="absolute inset-0 flex">
                            {groupedColumns.map((col) => (
                                <div
                                  key={col.key}
                                  className="shrink-0 border-r border-border/10"
                                  style={{ width: columnWidth }}
                                />
                            ))}
                          </div>
                        );

                        if (!displayStart || !displayEnd) return (
                          <React.Fragment key={task.id}>
                            <div style={{ height: ROW_HEIGHT }}>
                              <div className="flex h-full">
                                {groupedColumns.map((col) => {
                                  return (
                                    <div
                                      key={col.key}
                                      className="shrink-0 border-r border-border/10"
                                      style={{ width: columnWidth }}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                            {hasReviewSegments && (
                              <div style={{ height: REVIEW_SUB_ROW_HEIGHT }}>
                                <div className="flex h-full">
                                {groupedColumns.map((col) => (
                                    <div
                                      key={col.key}
                                      className="shrink-0 border-r border-border/10"
                                      style={{ width: columnWidth }}
                                    />
                                ))}
                                </div>
                              </div>
                            )}
                          </React.Fragment>
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

                        const tooltipInfo = isCurrentlyDragging ? getDynamicTooltipInfo() : null;

                        return (
                          <React.Fragment key={task.id}>
                          {/* Main task row - continuous work bar */}
                          <div className="relative" style={{ height: ROW_HEIGHT }}>
                            {renderGridBg(ROW_HEIGHT)}

                            {!isOutsideView && clippedWidth > 0 && task.task_type === 'milestone' ? (
                              // Milestone: Flag icon
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
                            ) : !isOutsideView && clippedWidth > 0 && (
                              <>
                              {/* Ghost element at original position */}
                              {isCurrentlyDragging && (() => {
                                const ghost = getGhostPosition();
                                if (!ghost) return null;
                                const ghostLeft = dateToX(ghost.start);
                                const ghostWidth = getTaskWidth(ghost.start, ghost.end);
                                return (
                                  <div
                                    className="absolute top-1/2 -translate-y-1/2 h-5 rounded-sm gantt-task-ghost"
                                    style={{
                                      left: ghostLeft + 2,
                                      width: ghostWidth - 4,
                                      background: `${sectionColor}30`,
                                    }}
                                  />
                                );
                              })()}

                              <Popover 
                                open={openTaskMenuId === task.id}
                                onOpenChange={(open) => {
                                  if (!open) closeTaskMenu();
                                  else setOpenTaskMenuId(task.id);
                                }}
                              >
                                {openTaskMenuId === task.id && taskMenuPos && (
                                  <PopoverAnchor asChild>
                                    <div
                                      style={{
                                        position: 'fixed',
                                        left: taskMenuPos.x,
                                        top: taskMenuPos.y,
                                        width: 1,
                                        height: 1,
                                        pointerEvents: 'none',
                                      }}
                                    />
                                  </PopoverAnchor>
                                )}

                                <Tooltip delayDuration={200}>
                                  <TooltipTrigger asChild>
                                    <div
                                      className={cn(
                                        "absolute top-1/2 -translate-y-1/2 h-5 rounded-sm cursor-move group/taskbar",
                                        "gantt-task-bar-base",
                                        "hover:shadow-md",
                                        getDragClasses(task.id),
                                        isFeedback && "gantt-review-bar"
                                      )}
                                      style={{
                                        left: clippedLeft + 2,
                                        width: clippedWidth - 4,
                                        backgroundColor: sectionColor,
                                        opacity: 0.9,
                                        boxShadow: `0 1px 3px ${sectionColor}33`,
                                        ...getDragStyles(task.id),
                                      }}
                                      onMouseEnter={(e) => handleTaskBarMouseEnter(e, task.id)}
                                      onMouseLeave={() => handleTaskBarMouseLeave(task.id)}
                                      onMouseDown={readOnly ? undefined : (e) => handleDragStart(e, dragTask, 'move')}
                                    >
                                      {!readOnly && (
                                        <div
                                          className={cn("gantt-resize-handle gantt-resize-handle-start", isCurrentlyDragging && dragging?.type === 'resize-start' && "gantt-resize-handle-active")}
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleDragStart(e, dragTask, 'resize-start');
                                          }}
                                        />
                                      )}

                                      <div className="absolute inset-0 flex items-center justify-between px-2 overflow-hidden">
                                        <span className="text-xs font-semibold text-white truncate drop-shadow-md tracking-wide flex-1 text-center">
                                          {clippedWidth > 60 ? task.name : ''}
                                        </span>
                                        {!readOnly && clippedWidth > 40 && (
                                          <button
                                            className="opacity-0 group-hover/taskbar:opacity-100 transition-opacity duration-150 p-0.5 rounded hover:bg-white/20 shrink-0 ml-1"
                                            onClick={(e) => handleMenuButtonClick(e, task.id)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                          >
                                            <MoreHorizontal className="w-4 h-4 text-white drop-shadow-md" />
                                          </button>
                                        )}
                                      </div>

                                      {!readOnly && (
                                        <div
                                          className={cn("gantt-resize-handle gantt-resize-handle-end", isCurrentlyDragging && dragging?.type === 'resize-end' && "gantt-resize-handle-active")}
                                          onMouseDown={(e) => {
                                            e.stopPropagation();
                                            handleDragStart(e, dragTask, 'resize-end');
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

                                <PopoverContent
                                  className="w-48 p-1 animate-enter"
                                  side="bottom"
                                  align="start"
                                  sideOffset={8}
                                  onMouseEnter={handlePopoverMouseEnter}
                                  onMouseLeave={() => handlePopoverMouseLeave(task.id)}
                                >
                                  <TaskPopoverMenu
                                    task={task}
                                    taskSegments={taskSegments}
                                    hoveredSegmentId={hoveredSegmentId}
                                     onDeleteTask={onDeleteTask}
                                     onEditReviewNotes={!readOnly ? (segId, taskName, notes) => {
                                       setReviewNotesDialog({ open: true, segmentId: segId, taskName, notes });
                                     } : undefined}
                                     onAddReview={!readOnly ? onAddReviewSegment : undefined}
                                     onClose={closeTaskMenu}
                                  />
                                </PopoverContent>
                              </Popover>
                              
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
                            )}
                          </div>

                          {/* Review sub-row - dashed review segment bars */}
                          {hasReviewSegments && (
                            <div className="relative" style={{ height: REVIEW_SUB_ROW_HEIGHT }}>
                              {renderGridBg(REVIEW_SUB_ROW_HEIGHT)}

                              {reviewSegments.map((seg) => {
                                const segmentPreview = getSegmentDragPreview(seg.id);
                                const segStart = segmentPreview ? segmentPreview.start : safeParseDate(seg.start_date);
                                const segEnd = segmentPreview ? segmentPreview.end : safeParseDate(seg.end_date);
                                if (!segStart || !segEnd) return null;
                                
                                const segLeft = dateToX(segStart);
                                const segWidth = getTaskWidth(segStart, segEnd);
                                const isSegmentDragging = dragging?.segmentId === seg.id;
                                const segTooltipInfo = isSegmentDragging ? getDynamicTooltipInfo() : null;
                                
                                return (
                                  <React.Fragment key={seg.id}>
                                    <Tooltip delayDuration={200}>
                                      <TooltipTrigger asChild>
                                        <div
                                          className={cn(
                                            "absolute top-1/2 -translate-y-1/2 h-4 rounded-sm group/reviewbar",
                                            readOnly ? ((localSegmentNotes[seg.id] || (seg as any).review_notes) ? "cursor-pointer" : "cursor-default") : "cursor-pointer",
                                            "hover:shadow-md",
                                            "gantt-review-bar",
                                            getDragClasses(task.id, seg.id)
                                          )}
                                          style={{
                                            left: segLeft + 2,
                                            width: segWidth - 4,
                                            backgroundColor: `${sectionColor}15`,
                                            border: `2px dashed ${sectionColor}`,
                                            boxShadow: `0 1px 3px ${sectionColor}15`,
                                            ...getDragStyles(task.id, seg.id),
                                          }}
                                          onMouseEnter={(e) => handleTaskBarMouseEnter(e, task.id, seg.id)}
                                          onMouseLeave={() => handleTaskBarMouseLeave(task.id)}
                                          onMouseDown={readOnly ? undefined : (e) => {
                                            handleDragStart(e, task, 'move', seg);
                                          }}
                                          onClick={readOnly ? () => {
                                            const notes = localSegmentNotes[seg.id] || (seg as any).review_notes;
                                            if (notes) {
                                              setReviewNotesViewDialog({
                                                open: true,
                                                taskName: task.name,
                                                notes,
                                                startDate: seg.start_date,
                                                endDate: seg.end_date,
                                              });
                                            }
                                          } : undefined}
                                        >
                                          {/* Review badge */}
                                          {segWidth > 40 && (
                                            <span 
                                              className="absolute -top-2 left-1/2 -translate-x-1/2 bg-background border rounded-full px-1.5 py-0 text-[8px] font-bold uppercase tracking-wider shadow-sm whitespace-nowrap z-10 flex items-center gap-0.5"
                                              style={{ borderColor: sectionColor, color: sectionColor }}
                                            >
                                              Review
                                              {(localSegmentNotes[seg.id] || (seg as any).review_notes) && (
                                                <FileText className="w-2 h-2" />
                                              )}
                                            </span>
                                          )}
                                          {/* Resize handles */}
                                          {!readOnly && (
                                            <>
                                              <div className={cn("gantt-resize-handle gantt-resize-handle-start", isSegmentDragging && dragging?.type === 'resize-start' && "gantt-resize-handle-active")} />
                                              <div className={cn("gantt-resize-handle gantt-resize-handle-end", isSegmentDragging && dragging?.type === 'resize-end' && "gantt-resize-handle-active")} />
                                            </>
                                          )}
                                          {/* Menu button */}
                                          {!readOnly && segWidth > 30 && (
                                            <div className="absolute inset-0 flex items-center justify-end px-1">
                                              <button
                                                className="opacity-0 group-hover/reviewbar:opacity-100 transition-opacity duration-150 p-0.5 rounded hover:bg-black/10 shrink-0"
                                                onClick={(e) => handleMenuButtonClick(e, task.id, seg.id)}
                                                onMouseDown={(e) => e.stopPropagation()}
                                              >
                                                <MoreHorizontal className="w-3 h-3 text-foreground" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </TooltipTrigger>
                                      {!isSegmentDragging && (
                                        <TooltipContent side="top" className="font-semibold">
                                          <p>{task.name} - Client Review</p>
                                          <p className="text-xs text-muted-foreground">
                                            {safeFormat(segStart, 'MMM d')} → {safeFormat(segEnd, 'MMM d')}
                                          </p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                    
                                    {/* Dynamic tooltip during segment drag */}
                                    {isSegmentDragging && segTooltipInfo && (
                                      <div 
                                        className="gantt-dynamic-tooltip"
                                        style={{ 
                                          left: segLeft + segWidth / 2,
                                          top: '50%',
                                          transform: 'translate(-50%, -200%)',
                                        }}
                                      >
                                        <div className="gantt-dynamic-tooltip-arrow" />
                                        {segTooltipInfo.type === 'move' ? (
                                          <span>
                                            <span className="gantt-tooltip-date">{safeFormat(segTooltipInfo.start, 'MMM d')}</span>
                                            <span className="gantt-tooltip-separator">→</span>
                                            <span className="gantt-tooltip-date">{safeFormat(segTooltipInfo.end, 'MMM d')}</span>
                                          </span>
                                        ) : (
                                          <span>
                                            <span className="gantt-tooltip-date">
                                              {safeFormat(segTooltipInfo.type === 'resize-start' ? segTooltipInfo.start : segTooltipInfo.end, 'MMM d')}
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
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          )}
                          </React.Fragment>
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
                        className="absolute w-0.5 bg-destructive/70 z-10 pointer-events-none"
                        style={{ 
                          left: todayX,
                          top: 0,
                          height: bodyHeight,
                        }}
                      />
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

    {/* Review Notes Edit Dialog (Admin) */}
    {reviewNotesDialog && (
      <ReviewNotesDialog
        open={reviewNotesDialog.open}
        onOpenChange={(open) => {
          if (!open) setReviewNotesDialog(null);
        }}
        segmentId={reviewNotesDialog.segmentId}
        taskName={reviewNotesDialog.taskName}
        initialNotes={reviewNotesDialog.notes}
        onSaved={(segId, notes) => {
          setLocalSegmentNotes(prev => ({ ...prev, [segId]: notes }));
        }}
      />
    )}

    {/* Review Notes View Dialog (Client) */}
    {reviewNotesViewDialog && (
      <ReviewNotesViewDialog
        open={reviewNotesViewDialog.open}
        onOpenChange={(open) => {
          if (!open) setReviewNotesViewDialog(null);
        }}
        taskName={reviewNotesViewDialog.taskName}
        reviewNotes={reviewNotesViewDialog.notes}
        startDate={reviewNotesViewDialog.startDate}
        endDate={reviewNotesViewDialog.endDate}
      />
    )}
    </>
  );
}