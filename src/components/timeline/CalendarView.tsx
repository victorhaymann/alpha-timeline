import { useState, useMemo } from 'react';
import { Task, Phase, PhaseCategory, PHASE_CATEGORY_COLORS } from '@/types/database';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Flag, 
  Users, 
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO
} from 'date-fns';
import { cn } from '@/lib/utils';

interface CalendarViewProps {
  projectStartDate: Date;
  projectEndDate: Date;
  phases: Phase[];
  tasks: Task[];
  workingDaysMask: number;
}

export function CalendarView({
  projectStartDate,
  projectEndDate,
  phases,
  tasks,
  workingDaysMask,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Start with project start date's month
    return startOfMonth(projectStartDate);
  });
  const [showTaskSpans, setShowTaskSpans] = useState(false);

  // Get calendar grid days (including days from adjacent months to fill weeks)
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Start on Monday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Check if day is a working day
  const isWorkingDay = (date: Date) => {
    const dayOfWeek = date.getDay();
    const dayBit = dayOfWeek === 0 ? 64 : (1 << (dayOfWeek - 1));
    return (workingDaysMask & dayBit) !== 0;
  };

  // Get phase color for a task
  const getPhaseColor = (task: Task) => {
    const phase = phases.find(p => p.id === task.phase_id);
    if (phase) {
      return PHASE_CATEGORY_COLORS[phase.name as PhaseCategory] || '#6B7280';
    }
    return '#6B7280';
  };

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    const meetings: Task[] = [];
    const milestones: Task[] = [];
    const taskSpans: Task[] = [];

    tasks.forEach(task => {
      if (!task.start_date || !task.end_date) return;

      const startDate = parseISO(task.start_date);
      const endDate = parseISO(task.end_date);

      // Check if this task spans this day
      if (isWithinInterval(day, { start: startDate, end: endDate })) {
        if (task.task_type === 'meeting') {
          // Meetings show on their start date
          if (isSameDay(day, startDate)) {
            meetings.push(task);
          }
        } else if (task.task_type === 'milestone') {
          // Milestones show on their date
          if (isSameDay(day, startDate) || isSameDay(day, endDate)) {
            milestones.push(task);
          }
        } else if (showTaskSpans) {
          // Only show task spans if toggle is on
          taskSpans.push(task);
        }
      }
    });

    return { meetings, milestones, taskSpans };
  };

  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(prev => subMonths(prev, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h3 className="text-lg font-semibold min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentMonth(prev => addMonths(prev, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="show-tasks"
            checked={showTaskSpans}
            onCheckedChange={setShowTaskSpans}
          />
          <Label htmlFor="show-tasks" className="text-sm">
            Show task spans
          </Label>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="border rounded-lg overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-muted/50">
          {weekDays.map(day => (
            <div 
              key={day} 
              className="px-2 py-3 text-center text-sm font-medium border-r last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isToday = isSameDay(day, new Date());
            const isNonWorking = !isWorkingDay(day);
            const { meetings, milestones, taskSpans } = getEventsForDay(day);
            const isInProject = day >= projectStartDate && day <= projectEndDate;

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[120px] p-1 border-r border-b last:border-r-0",
                  !isCurrentMonth && "bg-muted/30",
                  isNonWorking && isCurrentMonth && "bg-muted/20",
                  !isInProject && "opacity-50"
                )}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span 
                    className={cn(
                      "text-sm w-7 h-7 flex items-center justify-center rounded-full",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday && "bg-primary text-primary-foreground font-bold"
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                </div>

                {/* Events */}
                <div className="space-y-1">
                  {/* Milestones */}
                  {milestones.map(milestone => (
                    <div
                      key={milestone.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400"
                    >
                      <Flag className="w-3 h-3 shrink-0" />
                      <span className="text-xs truncate font-medium">
                        {milestone.name}
                      </span>
                    </div>
                  ))}

                  {/* Meetings */}
                  {meetings.map(meeting => (
                    <div
                      key={meeting.id}
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary"
                    >
                      <Users className="w-3 h-3 shrink-0" />
                      <span className="text-xs truncate font-medium">
                        {meeting.name}
                      </span>
                    </div>
                  ))}

                  {/* Task spans (when toggled) */}
                  {showTaskSpans && taskSpans.slice(0, 3).map(task => (
                    <div
                      key={task.id}
                      className="px-1.5 py-0.5 rounded text-white"
                      style={{ backgroundColor: getPhaseColor(task) + 'CC' }}
                    >
                      <span className="text-xs truncate block">
                        {task.name}
                      </span>
                    </div>
                  ))}

                  {/* More indicator */}
                  {showTaskSpans && taskSpans.length > 3 && (
                    <div className="text-xs text-muted-foreground px-1">
                      +{taskSpans.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Flag className="w-4 h-4 text-amber-500" />
          <span>Milestone</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" />
          <span>Meeting</span>
        </div>
        {showTaskSpans && (
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded bg-muted-foreground" />
            <span>Task</span>
          </div>
        )}
      </div>
    </div>
  );
}
