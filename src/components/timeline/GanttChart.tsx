import { useState, useRef, useCallback, useMemo } from 'react';
import { Task, Phase, PhaseCategory, PHASE_CATEGORY_COLORS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Flag, 
  Users, 
  GripVertical,
  Plus,
  RotateCcw
} from 'lucide-react';
import { 
  format, 
  differenceInDays, 
  addDays, 
  startOfDay,
  eachDayOfInterval,
  isWeekend,
  isSameDay
} from 'date-fns';
import { cn } from '@/lib/utils';

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
}

const DAY_WIDTH = 32; // pixels per day
const ROW_HEIGHT = 40;
const HEADER_HEIGHT = 60;
const PHASE_HEADER_HEIGHT = 36;

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
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{
    taskId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStart: Date;
    originalEnd: Date;
  } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ start: Date; end: Date } | null>(null);

  const totalDays = differenceInDays(projectEndDate, projectStartDate) + 1;
  const chartWidth = totalDays * DAY_WIDTH;

  // Generate day columns
  const days = useMemo(() => 
    eachDayOfInterval({ start: projectStartDate, end: projectEndDate }),
    [projectStartDate, projectEndDate]
  );

  // Check if day is a working day
  const isWorkingDay = useCallback((date: Date) => {
    const dayOfWeek = date.getDay();
    const dayBit = dayOfWeek === 0 ? 64 : (1 << (dayOfWeek - 1));
    return (workingDaysMask & dayBit) !== 0;
  }, [workingDaysMask]);

  // Calculate position from date
  const dateToX = useCallback((date: Date) => {
    return differenceInDays(startOfDay(date), startOfDay(projectStartDate)) * DAY_WIDTH;
  }, [projectStartDate]);

  // Calculate date from position
  const xToDate = useCallback((x: number) => {
    const days = Math.round(x / DAY_WIDTH);
    return addDays(projectStartDate, days);
  }, [projectStartDate]);

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped = new Map<string, Task[]>();
    phases.forEach(phase => {
      grouped.set(
        phase.id,
        tasks
          .filter(t => t.phase_id === phase.id)
          .sort((a, b) => a.order_index - b.order_index)
      );
    });
    return grouped;
  }, [phases, tasks]);

  // Handle drag start
  const handleDragStart = (
    e: React.MouseEvent,
    task: Task,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.preventDefault();
    if (!task.start_date || !task.end_date) return;

    setDragging({
      taskId: task.id,
      type,
      startX: e.clientX,
      originalStart: new Date(task.start_date),
      originalEnd: new Date(task.end_date),
    });
    setDragPreview({
      start: new Date(task.start_date),
      end: new Date(task.end_date),
    });
  };

  // Handle drag move
  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragPreview) return;

    const deltaX = e.clientX - dragging.startX;
    const deltaDays = Math.round(deltaX / DAY_WIDTH);

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
  }, [dragging, dragPreview]);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (dragging && dragPreview) {
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

  // Calculate total chart height
  let totalHeight = HEADER_HEIGHT;
  phases.forEach(phase => {
    const phaseTasks = tasksByPhase.get(phase.id) || [];
    totalHeight += PHASE_HEADER_HEIGHT + (phaseTasks.length * ROW_HEIGHT);
  });

  return (
    <div className="relative overflow-auto border rounded-lg bg-card" ref={containerRef}>
      <div className="relative" style={{ width: chartWidth + 200, minHeight: totalHeight }}>
        {/* Fixed task names column */}
        <div className="sticky left-0 z-20 bg-card border-r" style={{ width: 200 }}>
          {/* Header */}
          <div 
            className="flex items-center px-3 border-b bg-muted/50 font-medium"
            style={{ height: HEADER_HEIGHT }}
          >
            Tasks
          </div>

          {/* Phase and task rows */}
          {phases.map(phase => {
            const phaseTasks = tasksByPhase.get(phase.id) || [];
            const phaseColor = PHASE_CATEGORY_COLORS[phase.name as PhaseCategory] || '#6B7280';

            return (
              <div key={phase.id}>
                {/* Phase header */}
                <div 
                  className="flex items-center gap-2 px-3 border-b bg-muted/30 font-medium text-sm"
                  style={{ height: PHASE_HEADER_HEIGHT }}
                >
                  <div 
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: phaseColor }}
                  />
                  <span className="truncate">{phase.name}</span>
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {phaseTasks.length}
                  </Badge>
                </div>

                {/* Task rows */}
                {phaseTasks.map((task) => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-2 px-3 border-b hover:bg-muted/30 group"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                    {task.task_type === 'milestone' && <Flag className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
                    {task.task_type === 'meeting' && <Users className="w-3.5 h-3.5 text-primary shrink-0" />}
                    <span className="text-sm truncate flex-1">{task.name}</span>
                    <button
                      onClick={() => onAddReviewRound(task.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded"
                      title="Add review round"
                    >
                      <RotateCcw className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}

                {/* Add task button */}
                <div 
                  className="flex items-center px-3 border-b"
                  style={{ height: ROW_HEIGHT }}
                >
                  <button
                    onClick={() => onAddTask(phase.id)}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add task
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timeline area */}
        <div 
          className="absolute top-0 left-[200px]"
          style={{ width: chartWidth }}
          onMouseMove={dragging ? (e) => handleDragMove(e.nativeEvent) : undefined}
          onMouseUp={dragging ? handleDragEnd : undefined}
          onMouseLeave={dragging ? handleDragEnd : undefined}
        >
          {/* Day headers */}
          <div 
            className="flex border-b bg-muted/50 sticky top-0 z-10"
            style={{ height: HEADER_HEIGHT }}
          >
            {days.map((day, i) => {
              const isToday = isSameDay(day, new Date());
              const isNonWorking = !isWorkingDay(day);

              return (
                <div
                  key={i}
                  className={cn(
                    "flex flex-col items-center justify-center border-r text-xs shrink-0",
                    isNonWorking && "bg-muted/50 text-muted-foreground",
                    isToday && "bg-primary/10"
                  )}
                  style={{ width: DAY_WIDTH }}
                >
                  <span className="font-medium">{format(day, 'd')}</span>
                  <span className="text-muted-foreground">{format(day, 'EEE')}</span>
                </div>
              );
            })}
          </div>

          {/* Phase rows with task bars */}
          {phases.map(phase => {
            const phaseTasks = tasksByPhase.get(phase.id) || [];
            const phaseColor = PHASE_CATEGORY_COLORS[phase.name as PhaseCategory] || '#6B7280';

            return (
              <div key={phase.id}>
                {/* Phase header row */}
                <div 
                  className="border-b"
                  style={{ height: PHASE_HEADER_HEIGHT }}
                >
                  <div className="flex h-full">
                    {days.map((day, i) => (
                      <div
                        key={i}
                        className={cn(
                          "border-r shrink-0",
                          !isWorkingDay(day) && "bg-muted/30"
                        )}
                        style={{ width: DAY_WIDTH }}
                      />
                    ))}
                  </div>
                </div>

                {/* Task bars */}
                {phaseTasks.map((task) => {
                  const isCurrentlyDragging = dragging?.taskId === task.id;
                  const displayStart = isCurrentlyDragging && dragPreview ? dragPreview.start : (task.start_date ? new Date(task.start_date) : null);
                  const displayEnd = isCurrentlyDragging && dragPreview ? dragPreview.end : (task.end_date ? new Date(task.end_date) : null);

                  if (!displayStart || !displayEnd) return (
                    <div key={task.id} className="border-b" style={{ height: ROW_HEIGHT }}>
                      <div className="flex h-full">
                        {days.map((day, i) => (
                          <div
                            key={i}
                            className={cn(
                              "border-r shrink-0",
                              !isWorkingDay(day) && "bg-muted/30"
                            )}
                            style={{ width: DAY_WIDTH }}
                          />
                        ))}
                      </div>
                    </div>
                  );

                  const left = dateToX(displayStart);
                  const width = Math.max(DAY_WIDTH, (differenceInDays(displayEnd, displayStart) + 1) * DAY_WIDTH);

                  return (
                    <div key={task.id} className="relative border-b" style={{ height: ROW_HEIGHT }}>
                      {/* Grid background */}
                      <div className="absolute inset-0 flex">
                        {days.map((day, i) => (
                          <div
                            key={i}
                            className={cn(
                              "border-r shrink-0",
                              !isWorkingDay(day) && "bg-muted/30"
                            )}
                            style={{ width: DAY_WIDTH }}
                          />
                        ))}
                      </div>

                      {/* Task bar */}
                      <div
                        className={cn(
                          "absolute top-1/2 -translate-y-1/2 h-7 rounded-md cursor-move transition-shadow",
                          "hover:shadow-lg hover:ring-2 hover:ring-primary/30",
                          isCurrentlyDragging && "opacity-80 ring-2 ring-primary",
                          task.task_type === 'milestone' && "rounded-full",
                          task.task_type === 'meeting' && "bg-primary/80"
                        )}
                        style={{
                          left: left + 2,
                          width: task.task_type === 'milestone' ? 24 : width - 4,
                          backgroundColor: task.task_type === 'milestone' 
                            ? '#F59E0B' 
                            : task.task_type === 'meeting'
                              ? undefined
                              : phaseColor,
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
                                {width > 60 ? task.name : ''}
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
                      </div>
                    </div>
                  );
                })}

                {/* Add task row */}
                <div className="border-b" style={{ height: ROW_HEIGHT }}>
                  <div className="flex h-full">
                    {days.map((day, i) => (
                      <div
                        key={i}
                        className={cn(
                          "border-r shrink-0",
                          !isWorkingDay(day) && "bg-muted/30"
                        )}
                        style={{ width: DAY_WIDTH }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Today marker */}
          {(() => {
            const today = new Date();
            if (today >= projectStartDate && today <= projectEndDate) {
              const todayX = dateToX(today);
              return (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive z-30 pointer-events-none"
                  style={{ left: todayX + DAY_WIDTH / 2 }}
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
  );
}
