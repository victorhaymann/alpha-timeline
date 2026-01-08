import { useMemo, useState, useEffect } from 'react';
import { Task } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
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
import { Users, Clock, CheckCircle2, PlayCircle, FileText, Loader2, NotebookPen, Trash2, Eye, EyeOff } from 'lucide-react';
import { format, startOfDay, isBefore, isAfter, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface MeetingHoverCardProps {
  meetingDate: Date;
  meetingName: string;
  checkinTime: string | null;
  checkinDuration: number | null;
  checkinTimezone: string | null;
  tasks: Task[];
  left: number;
  columnWidth: number;
  allMeetingDates: string[];
  meetingIndex: number;
  projectId: string;
  onDelete?: () => void;
  readOnly?: boolean;
  isHiddenFromClient?: boolean;
  onToggleClientVisibility?: (hidden: boolean) => void;
}

interface TaskNote {
  taskId: string;
  taskName: string;
  checked: boolean;
  notes: string;
  section: 'review' | 'validate';
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
  projectId,
  onDelete,
  readOnly = false,
  isHiddenFromClient = false,
  onToggleClientVisibility,
}: MeetingHoverCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [generalNotes, setGeneralNotes] = useState('');
  const [taskNotes, setTaskNotes] = useState<TaskNote[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  // Load existing notes from database
  const loadNotes = async () => {
    setIsLoading(true);
    try {
      const meetingDateStr = format(meetingDate, 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('meeting_notes')
        .select('*')
        .eq('project_id', projectId)
        .eq('meeting_date', meetingDateStr)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setGeneralNotes(data.general_notes || '');
        const savedTaskNotes = (data.task_notes as unknown as TaskNote[]) || [];
        
        // Merge saved notes with current tasks
        const mergedNotes: TaskNote[] = [
          ...inProgressTasks.map(task => {
            const saved = savedTaskNotes.find(n => n.taskId === task.id && n.section === 'review');
            return {
              taskId: task.id,
              taskName: task.name,
              checked: saved?.checked ?? false,
              notes: saved?.notes ?? '',
              section: 'review' as const,
            };
          }),
          ...recentlyCompletedTasks.map(task => {
            const saved = savedTaskNotes.find(n => n.taskId === task.id && n.section === 'validate');
            return {
              taskId: task.id,
              taskName: task.name,
              checked: saved?.checked ?? false,
              notes: saved?.notes ?? '',
              section: 'validate' as const,
            };
          }),
        ];
        setTaskNotes(mergedNotes);
      } else {
        // Initialize fresh notes
        initializeNotes();
      }
    } catch (error) {
      console.error('Error loading meeting notes:', error);
      initializeNotes();
    } finally {
      setIsLoading(false);
    }
  };

  const initializeNotes = () => {
    setGeneralNotes('');
    setTaskNotes([
      ...inProgressTasks.map(task => ({
        taskId: task.id,
        taskName: task.name,
        checked: false,
        notes: '',
        section: 'review' as const,
      })),
      ...recentlyCompletedTasks.map(task => ({
        taskId: task.id,
        taskName: task.name,
        checked: false,
        notes: '',
        section: 'validate' as const,
      })),
    ]);
  };

  // Save notes to database
  const saveNotes = async () => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const meetingDateStr = format(meetingDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('meeting_notes')
        .upsert([{
          project_id: projectId,
          meeting_date: meetingDateStr,
          general_notes: generalNotes,
          task_notes: JSON.parse(JSON.stringify(taskNotes)),
          created_by: user.id,
        }], {
          onConflict: 'project_id,meeting_date',
        });

      if (error) throw error;

      toast({
        title: 'Notes saved',
        description: 'Your meeting notes have been saved.',
      });
    } catch (error: any) {
      console.error('Error saving meeting notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to save meeting notes.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save when closing dialog
  const handleDialogClose = async (open: boolean) => {
    if (!open && notesDialogOpen) {
      await saveNotes();
    }
    setNotesDialogOpen(open);
  };

  // Open notes dialog
  const handleOpenNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNotesDialogOpen(true);
  };

  // Load notes when dialog opens
  useEffect(() => {
    if (notesDialogOpen) {
      loadNotes();
    }
  }, [notesDialogOpen]);

  const updateTaskNote = (taskId: string, section: 'review' | 'validate', field: 'checked' | 'notes', value: boolean | string) => {
    setTaskNotes(items => 
      items.map(item => 
        item.taskId === taskId && item.section === section 
          ? { ...item, [field]: value } 
          : item
      )
    );
  };

  const reviewItems = taskNotes.filter(n => n.section === 'review');
  const validateItems = taskNotes.filter(n => n.section === 'validate');

  return (
    <>
      <HoverCard openDelay={100} closeDelay={50}>
        <HoverCardTrigger asChild>
          <div
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 rotate-45 rounded-sm hover:scale-125 transition-transform cursor-pointer shadow-sm",
              isHiddenFromClient 
                ? "bg-foreground/30" 
                : "bg-foreground/80 diamond-shimmer"
            )}
            style={{ left: left + columnWidth / 2 - 8 }}
          >
            {isHiddenFromClient && (
              <EyeOff className="absolute -top-4 left-1/2 -translate-x-1/2 -rotate-45 w-3 h-3 text-amber-500" />
            )}
          </div>
        </HoverCardTrigger>
        <HoverCardContent 
          className="w-72 p-0 overflow-hidden"
          side="top"
          sideOffset={8}
        >
          {/* Header */}
          <div className="bg-muted/50 px-4 py-3 border-b border-border relative">
            <div className="absolute top-2 right-2 flex items-center gap-1">
              {!readOnly && onToggleClientVisibility && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-7 w-7",
                    isHiddenFromClient 
                      ? "text-amber-500 hover:text-amber-600 hover:bg-amber-500/10" 
                      : "text-muted-foreground hover:text-foreground hover:bg-background"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleClientVisibility(!isHiddenFromClient);
                  }}
                  title={isHiddenFromClient ? "Show to clients" : "Hide from clients"}
                >
                  {isHiddenFromClient ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              )}
              {!readOnly && onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  title="Delete meeting"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 hover:bg-background"
                onClick={handleOpenNotes}
                title="Meeting Notes"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
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
      <Dialog open={notesDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Meeting Notes - {format(meetingDate, 'MMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-6">
                {/* General Notes Section */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <NotebookPen className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      General Notes
                    </h3>
                  </div>
                  <Textarea
                    placeholder="Add general meeting notes, action items, or discussion points..."
                    value={generalNotes}
                    onChange={(e) => setGeneralNotes(e.target.value)}
                    className="min-h-[100px] text-sm resize-none"
                  />
                </div>

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
                    <div className="space-y-3">
                      {reviewItems.map(item => (
                        <div key={item.taskId} className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-3 mb-2">
                            <Checkbox
                              id={`review-${item.taskId}`}
                              checked={item.checked}
                              onCheckedChange={(checked) => 
                                updateTaskNote(item.taskId, 'review', 'checked', checked as boolean)
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
                            onChange={(e) => updateTaskNote(item.taskId, 'review', 'notes', e.target.value)}
                            className="min-h-[50px] text-sm resize-none"
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
                    <div className="space-y-3">
                      {validateItems.map(item => (
                        <div key={item.taskId} className="p-3 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-3 mb-2">
                            <Checkbox
                              id={`validate-${item.taskId}`}
                              checked={item.checked}
                              onCheckedChange={(checked) => 
                                updateTaskNote(item.taskId, 'validate', 'checked', checked as boolean)
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
                            onChange={(e) => updateTaskNote(item.taskId, 'validate', 'notes', e.target.value)}
                            className="min-h-[50px] text-sm resize-none"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic px-3">No tasks to validate</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}