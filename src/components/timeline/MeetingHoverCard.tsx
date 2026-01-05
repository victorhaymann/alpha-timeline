import { useMemo, useState } from 'react';
import { Task } from '@/types/database';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Clock, CheckCircle2, PlayCircle, FileText } from 'lucide-react';
import { format, startOfDay, isBefore, isAfter, isSameDay } from 'date-fns';

interface MeetingHoverCardProps {
  meetingDate: Date;
  meetingName: string;
  checkinTime: string | null;
  checkinDuration: number | null;
  checkinTimezone: string | null;
  tasks: Task[];
  left: number;
  columnWidth: number;
  allMeetingDates: string[]; // All recurring dates to calculate previous meeting
  meetingIndex: number; // Index of this meeting in the array
}

interface AgendaItem {
  taskId: string;
  taskName: string;
  checked: boolean;
  notes: string;
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
  allMeetingDates,
  meetingIndex,
}: MeetingHoverCardProps) {
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<AgendaItem[]>([]);
  const [validateItems, setValidateItems] = useState<AgendaItem[]>([]);

  // Tasks "To be reviewed" - tasks in progress at the time of this meeting
  const inProgressTasks = useMemo(() => {
    const meetingDay = startOfDay(meetingDate);
    return tasks.filter(task => {
      if (!task.start_date || !task.end_date) return false;
      if (task.task_type === 'meeting' || task.is_milestone) return false;
      
      const taskStart = startOfDay(new Date(task.start_date));
      const taskEnd = startOfDay(new Date(task.end_date));
      
      return (isBefore(taskStart, meetingDay) || isSameDay(taskStart, meetingDay)) &&
             (isAfter(taskEnd, meetingDay) || isSameDay(taskEnd, meetingDay));
    });
  }, [tasks, meetingDate]);

  // Tasks "To be validated" - tasks completed between the previous meeting and this one
  const recentlyCompletedTasks = useMemo(() => {
    const meetingDay = startOfDay(meetingDate);
    
    let previousMeetingDay: Date | null = null;
    if (meetingIndex > 0 && allMeetingDates[meetingIndex - 1]) {
      previousMeetingDay = startOfDay(new Date(allMeetingDates[meetingIndex - 1]));
    }
    
    return tasks.filter(task => {
      if (!task.end_date) return false;
      if (task.task_type === 'meeting' || task.is_milestone) return false;
      
      const taskEnd = startOfDay(new Date(task.end_date));
      
      const endedBeforeMeeting = isBefore(taskEnd, meetingDay) || isSameDay(taskEnd, meetingDay);
      const endedAfterPreviousMeeting = previousMeetingDay 
        ? isAfter(taskEnd, previousMeetingDay)
        : true;
      
      return endedBeforeMeeting && endedAfterPreviousMeeting;
    });
  }, [tasks, meetingDate, allMeetingDates, meetingIndex]);

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

  // Open notes dialog and initialize agenda items
  const handleOpenNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Initialize review items from in-progress tasks
    setReviewItems(inProgressTasks.map(task => ({
      taskId: task.id,
      taskName: task.name,
      checked: false,
      notes: '',
    })));
    
    // Initialize validate items from recently completed tasks
    setValidateItems(recentlyCompletedTasks.map(task => ({
      taskId: task.id,
      taskName: task.name,
      checked: false,
      notes: '',
    })));
    
    setNotesDialogOpen(true);
  };

  const updateReviewItem = (taskId: string, field: 'checked' | 'notes', value: boolean | string) => {
    setReviewItems(items => 
      items.map(item => 
        item.taskId === taskId ? { ...item, [field]: value } : item
      )
    );
  };

  const updateValidateItem = (taskId: string, field: 'checked' | 'notes', value: boolean | string) => {
    setValidateItems(items => 
      items.map(item => 
        item.taskId === taskId ? { ...item, [field]: value } : item
      )
    );
  };

  return (
    <>
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
          <div className="bg-muted/50 px-4 py-3 border-b border-border relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 h-7 w-7 hover:bg-background"
              onClick={handleOpenNotes}
              title="Meeting Notes"
            >
              <FileText className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2 mb-1 pr-8">
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

      {/* Meeting Notes Dialog */}
      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Meeting Notes - {format(meetingDate, 'MMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6 py-4">
              {/* To be reviewed section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <PlayCircle className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    To be reviewed
                  </h3>
                  <span className="text-xs font-medium text-amber-500">
                    ({reviewItems.length})
                  </span>
                </div>
                
                {reviewItems.length > 0 ? (
                  <div className="space-y-4">
                    {reviewItems.map(item => (
                      <div key={item.taskId} className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`review-${item.taskId}`}
                            checked={item.checked}
                            onCheckedChange={(checked) => 
                              updateReviewItem(item.taskId, 'checked', checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`review-${item.taskId}`}
                            className={`text-sm font-medium cursor-pointer ${
                              item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {item.taskName}
                          </label>
                        </div>
                        <Textarea
                          placeholder="Add notes..."
                          value={item.notes}
                          onChange={(e) => updateReviewItem(item.taskId, 'notes', e.target.value)}
                          className="min-h-[60px] text-sm resize-none"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic px-3">No tasks to review</p>
                )}
              </div>

              {/* To be validated section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    To be validated
                  </h3>
                  <span className="text-xs font-medium text-emerald-500">
                    ({validateItems.length})
                  </span>
                </div>
                
                {validateItems.length > 0 ? (
                  <div className="space-y-4">
                    {validateItems.map(item => (
                      <div key={item.taskId} className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            id={`validate-${item.taskId}`}
                            checked={item.checked}
                            onCheckedChange={(checked) => 
                              updateValidateItem(item.taskId, 'checked', checked as boolean)
                            }
                          />
                          <label
                            htmlFor={`validate-${item.taskId}`}
                            className={`text-sm font-medium cursor-pointer ${
                              item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}
                          >
                            {item.taskName}
                          </label>
                        </div>
                        <Textarea
                          placeholder="Add notes..."
                          value={item.notes}
                          onChange={(e) => updateValidateItem(item.taskId, 'notes', e.target.value)}
                          className="min-h-[60px] text-sm resize-none"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic px-3">No tasks to validate</p>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}