import { useMemo } from 'react';
import { Task } from '@/types/database';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Users, Clock, CheckCircle2, PlayCircle } from 'lucide-react';
import { format, differenceInDays, startOfDay } from 'date-fns';

interface MeetingHoverCardProps {
  meetingDate: Date;
  meetingName: string;
  checkinTime: string | null;
  checkinDuration: number | null;
  checkinTimezone: string | null;
  tasks: Task[];
  left: number;
  columnWidth: number;
}

export function MeetingHoverCard({
  meetingDate,
  meetingName,
  checkinTime,
  checkinDuration,
  checkinTimezone,
  tasks,
  left,
  columnWidth,
}: MeetingHoverCardProps) {
  // Tasks "To be reviewed" - currently in progress
  const inProgressTasks = useMemo(() => {
    return tasks.filter(task => task.status === 'in_progress');
  }, [tasks]);

  // Tasks "To be validated" - completed within the last 5 days
  const recentlyCompletedTasks = useMemo(() => {
    const today = startOfDay(new Date());
    return tasks.filter(task => {
      if (task.status !== 'completed' || !task.end_date) return false;
      const endDate = startOfDay(new Date(task.end_date));
      const daysSinceCompletion = differenceInDays(today, endDate);
      return daysSinceCompletion >= 0 && daysSinceCompletion <= 5;
    });
  }, [tasks]);

  // Format meeting time with duration
  const formattedTime = useMemo(() => {
    if (!checkinTime) return 'Time TBD';
    
    const [hours, minutes] = checkinTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(hours, minutes, 0, 0);
    
    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + (checkinDuration || 30));
    
    const formatTime = (d: Date) => {
      return d.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    };
    
    const tz = checkinTimezone ? checkinTimezone.split('/').pop()?.replace('_', ' ') : '';
    return `${formatTime(startDate)} - ${formatTime(endDate)}${tz ? ` (${tz})` : ''}`;
  }, [checkinTime, checkinDuration, checkinTimezone]);

  return (
    <HoverCard openDelay={100} closeDelay={50}>
      <HoverCardTrigger asChild>
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-foreground/80 rotate-45 rounded-sm hover:scale-125 transition-transform cursor-pointer shadow-sm"
          style={{ left: left + columnWidth / 2 - 8 }}
        />
      </HoverCardTrigger>
      <HoverCardContent 
        className="w-72 p-0 overflow-hidden"
        side="top"
        sideOffset={8}
      >
        {/* Header */}
        <div className="bg-muted/50 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">{meetingName}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formattedTime}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {format(meetingDate, 'EEEE, MMM d, yyyy')}
          </div>
        </div>

        {/* To be reviewed section */}
        <div className="px-4 py-2.5 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              To be reviewed
            </span>
            <span className="ml-auto text-xs font-medium text-amber-500">
              {inProgressTasks.length}
            </span>
          </div>
          {inProgressTasks.length > 0 ? (
            <ul className="space-y-1">
              {inProgressTasks.slice(0, 5).map(task => (
                <li key={task.id} className="flex items-center gap-2 text-xs text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">{task.name}</span>
                </li>
              ))}
              {inProgressTasks.length > 5 && (
                <li className="text-xs text-muted-foreground pl-3.5">
                  +{inProgressTasks.length - 5} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No tasks in progress</p>
          )}
        </div>

        {/* To be validated section */}
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              To be validated
            </span>
            <span className="ml-auto text-xs font-medium text-emerald-500">
              {recentlyCompletedTasks.length}
            </span>
          </div>
          {recentlyCompletedTasks.length > 0 ? (
            <ul className="space-y-1">
              {recentlyCompletedTasks.slice(0, 5).map(task => (
                <li key={task.id} className="flex items-center gap-2 text-xs text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="truncate">{task.name}</span>
                  {task.end_date && (
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {format(new Date(task.end_date), 'MMM d')}
                    </span>
                  )}
                </li>
              ))}
              {recentlyCompletedTasks.length > 5 && (
                <li className="text-xs text-muted-foreground pl-3.5">
                  +{recentlyCompletedTasks.length - 5} more
                </li>
              )}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">No tasks completed recently</p>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}