import { useState, useCallback, useRef, useEffect } from 'react';
import { Task, Phase, Dependency, Project, PhaseCategory, TaskSegment } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { GanttChart } from './GanttChart';
import { AddTaskDialog } from './AddTaskDialog';
import { TaskSegmentDialog } from './TaskSegmentDialog';
import { 
  RefreshCw,
  Loader2,
  Undo2,
  Wrench
} from 'lucide-react';
import { format, parse, addDays } from 'date-fns';
import { computeSchedule, ScheduleTask, ScheduleDependency } from '@/lib/scheduleEngine';
import { DEFAULT_FEEDBACK_SETTINGS } from '@/components/steps/FeedbackConfig';
import { normalizeTaskDates, snapTaskToWorkingDays, hasNonWorkingDays, DEFAULT_WORKING_DAYS_MASK, nextWorkingDay as nextWorkingDayLib } from '@/lib/workingDays';

// Maximum number of undo states to keep
const MAX_UNDO_STACK_SIZE = 20;

interface UndoState {
  tasks: Task[];
  description: string;
}

interface TimelineEditorProps {
  project: Project;
  phases: Phase[];
  tasks: Task[];
  dependencies: Dependency[];
  segments: TaskSegment[];
  onTasksChange: (tasks: Task[]) => void;
  onSegmentsChange: (segments: TaskSegment[]) => void;
  onRefresh: () => void;
  onTaskClick?: (task: Task) => void;
  renderRegenerateButton?: (props: { onClick: () => void; isLoading: boolean }) => React.ReactNode;
}

export function TimelineEditor({
  project,
  phases,
  tasks,
  dependencies,
  segments,
  onTasksChange,
  onSegmentsChange,
  onRefresh,
  renderRegenerateButton,
}: TimelineEditorProps) {
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isFixingWeekends, setIsFixingWeekends] = useState(false);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [addMeetingDialogOpen, setAddMeetingDialogOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState<Date | undefined>(undefined);
  const [isUndoing, setIsUndoing] = useState(false);
  const hasRunWeekendFixRef = useRef(false);
  
  // Segment dialog state
  const [segmentDialogOpen, setSegmentDialogOpen] = useState(false);
  const [selectedTaskForSegments, setSelectedTaskForSegments] = useState<Task | null>(null);
  
  // Undo stack - stores previous task states
  const undoStackRef = useRef<UndoState[]>([]);
  const [undoStackLength, setUndoStackLength] = useState(0);

  const projectStartDate = new Date(project.start_date);
  const projectEndDate = new Date(project.end_date);


  // Save current state to undo stack before making changes
  const saveToUndoStack = useCallback((description: string) => {
    const newState: UndoState = {
      tasks: JSON.parse(JSON.stringify(tasks)), // Deep clone
      description,
    };
    
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO_STACK_SIZE - 1)),
      newState,
    ];
    setUndoStackLength(undoStackRef.current.length);
  }, [tasks]);

  // Undo the last change
  const handleUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) return;
    
    setIsUndoing(true);
    
    try {
      const previousState = undoStackRef.current.pop();
      setUndoStackLength(undoStackRef.current.length);
      
      if (!previousState) return;
      
      // Restore tasks to database
      for (const task of previousState.tasks) {
        await supabase
          .from('tasks')
          .update({
            name: task.name,
            start_date: task.start_date,
            end_date: task.end_date,
            order_index: task.order_index,
            phase_id: task.phase_id,
          })
          .eq('id', task.id);
      }
      
      // Update local state
      onTasksChange(previousState.tasks);
      
      toast({
        title: 'Undone',
        description: `Reverted: ${previousState.description}`,
      });
    } catch (error: any) {
      console.error('Error undoing changes:', error);
      toast({
        title: 'Error',
        description: 'Failed to undo changes.',
        variant: 'destructive',
      });
      onRefresh();
    } finally {
      setIsUndoing(false);
    }
  }, [onTasksChange, onRefresh, toast]);

  // Keyboard shortcut for undo (Ctrl+Z / Cmd+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Prevent default browser undo behavior
        e.preventDefault();
        
        if (undoStackRef.current.length > 0 && !isUndoing) {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUndoing, handleUndo]);

  // Handle task update (from Gantt drag/resize)
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    // Save current state before making changes
    const task = tasks.find(t => t.id === taskId);
    const updateDescription = task 
      ? `Update "${task.name}"` 
      : 'Update task';
    saveToUndoStack(updateDescription);
    
    try {
      // Normalize dates if they're being updated
      let normalizedUpdates = { ...updates };
      if (updates.start_date && updates.end_date) {
        const libMask = getLibMask();
        // Use snapTaskToWorkingDays to preserve working-day duration on move/resize
        const normalized = snapTaskToWorkingDays(
          new Date(updates.start_date),
          new Date(updates.end_date),
          libMask
        );
        normalizedUpdates.start_date = format(normalized.start, 'yyyy-MM-dd');
        normalizedUpdates.end_date = format(normalized.end, 'yyyy-MM-dd');
      }
      
      const { error } = await supabase
        .from('tasks')
        .update(normalizedUpdates)
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      onTasksChange(
        tasks.map(t => t.id === taskId ? { ...t, ...normalizedUpdates } : t)
      );
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task.',
        variant: 'destructive',
      });
    }
  };

  // Handle task reorder (within phase or cross-phase)
  const handleTaskReorder = async (sourcePhaseId: string, targetPhaseId: string, taskId: string, newIndex: number) => {
    // Save current state before making changes
    const task = tasks.find(t => t.id === taskId);
    saveToUndoStack(task ? `Reorder "${task.name}"` : 'Reorder task');
    
    const isCrossPhase = sourcePhaseId !== targetPhaseId;
    
    if (isCrossPhase) {
      // Cross-phase reordering
      const sourcePhaseTasks = tasks
        .filter(t => t.phase_id === sourcePhaseId)
        .sort((a, b) => a.order_index - b.order_index);
      
      const targetPhaseTasks = tasks
        .filter(t => t.phase_id === targetPhaseId)
        .sort((a, b) => a.order_index - b.order_index);
      
      const movedTask = sourcePhaseTasks.find(t => t.id === taskId);
      if (!movedTask) return;
      
      // Remove from source phase
      const updatedSourceTasks = sourcePhaseTasks
        .filter(t => t.id !== taskId)
        .map((t, i) => ({ ...t, order_index: i }));
      
      // Insert into target phase at newIndex
      const clampedIndex = Math.max(0, Math.min(newIndex, targetPhaseTasks.length));
      const updatedTargetTasks = [
        ...targetPhaseTasks.slice(0, clampedIndex),
        { ...movedTask, phase_id: targetPhaseId, order_index: clampedIndex },
        ...targetPhaseTasks.slice(clampedIndex),
      ].map((t, i) => ({ ...t, order_index: i }));
      
      // Optimistic update
      const updatedTasks = tasks.map(t => {
        if (t.id === taskId) {
          return { ...t, phase_id: targetPhaseId, order_index: clampedIndex };
        }
        const sourceUpdate = updatedSourceTasks.find(u => u.id === t.id);
        if (sourceUpdate) return sourceUpdate;
        const targetUpdate = updatedTargetTasks.find(u => u.id === t.id);
        if (targetUpdate) return targetUpdate;
        return t;
      });
      onTasksChange(updatedTasks);
      
      try {
        // Update the moved task's phase and order
        await supabase
          .from('tasks')
          .update({ phase_id: targetPhaseId, order_index: clampedIndex })
          .eq('id', taskId);
        
        // Update source phase order indices
        for (const task of updatedSourceTasks) {
          await supabase
            .from('tasks')
            .update({ order_index: task.order_index })
            .eq('id', task.id);
        }
        
        // Update target phase order indices (excluding the moved task)
        for (const task of updatedTargetTasks.filter(t => t.id !== taskId)) {
          await supabase
            .from('tasks')
            .update({ order_index: task.order_index })
            .eq('id', task.id);
        }
      } catch (error: any) {
        console.error('Error moving task to different phase:', error);
        toast({
          title: 'Error',
          description: 'Failed to move task.',
          variant: 'destructive',
        });
        onRefresh();
      }
    } else {
      // Same-phase reordering (existing logic)
      const phaseTasks = tasks
        .filter(t => t.phase_id === sourcePhaseId)
        .sort((a, b) => a.order_index - b.order_index);

      const taskIndex = phaseTasks.findIndex(t => t.id === taskId);
      if (taskIndex === -1 || taskIndex === newIndex) return;

      const clampedNewIndex = Math.max(0, Math.min(newIndex, phaseTasks.length - 1));
      if (taskIndex === clampedNewIndex) return;

      const reorderedTasks = [...phaseTasks];
      const [movedTask] = reorderedTasks.splice(taskIndex, 1);
      reorderedTasks.splice(clampedNewIndex, 0, movedTask);

      const updates = reorderedTasks.map((task, i) => ({
        id: task.id,
        order_index: i,
      }));

      // Optimistic update
      const updatedTasks = tasks.map(t => {
        const update = updates.find(u => u.id === t.id);
        return update ? { ...t, order_index: update.order_index } : t;
      });
      onTasksChange(updatedTasks);

      try {
        for (const update of updates) {
          await supabase
            .from('tasks')
            .update({ order_index: update.order_index })
            .eq('id', update.id);
        }
      } catch (error: any) {
        console.error('Error reordering tasks:', error);
        toast({
          title: 'Error',
          description: 'Failed to reorder tasks.',
          variant: 'destructive',
        });
        onRefresh();
      }
    }
  };

  // Handle add task
  const handleAddTask = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setAddTaskDialogOpen(true);
  };

  // Create new task
  const handleCreateTask = async (taskData: {
    name: string;
    task_type: 'task' | 'milestone' | 'meeting';
    client_visible: boolean;
    start_date: string;
    end_date: string;
  }) => {
    if (!selectedPhaseId) return;

    try {
      const maxOrder = tasks
        .filter(t => t.phase_id === selectedPhaseId)
        .reduce((max, t) => Math.max(max, t.order_index), -1);

      // Normalize dates to exclude weekends
      const libMask = getLibMask();
      const startDate = new Date(taskData.start_date);
      const endDate = new Date(taskData.end_date);
      const normalized = normalizeTaskDates(startDate, endDate, libMask);
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          phase_id: selectedPhaseId,
          project_id: project.id,
          name: taskData.name,
          task_type: taskData.task_type,
          client_visible: taskData.client_visible,
          start_date: format(normalized.start, 'yyyy-MM-dd'),
          end_date: format(normalized.end, 'yyyy-MM-dd'),
          order_index: maxOrder + 1,
          status: 'pending',
          weight_percent: 0,
          review_rounds: 0,
          percentage_allocation: 0,
        });

      if (error) throw error;

      toast({
        title: 'Task created',
        description: `${taskData.name} has been added.`,
      });

      onRefresh();
      setAddTaskDialogOpen(false);
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to create task.',
        variant: 'destructive',
      });
    }
  };

  // Handle add review round
  const handleAddReviewRound = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      // Find the phase for this task
      const phase = phases.find(p => p.id === task.phase_id);
      if (!phase) return;

      // Create a review meeting after this task
      const reviewName = `${task.name} Review`;
      const maxOrder = tasks
        .filter(t => t.phase_id === task.phase_id)
        .reduce((max, t) => Math.max(max, t.order_index), -1);

      const reviewEndDate = task.end_date || format(new Date(), 'yyyy-MM-dd');

      // Insert review meeting
      const { data: reviewTask, error: reviewError } = await supabase
        .from('tasks')
        .insert({
          phase_id: task.phase_id,
          project_id: project.id,
          name: reviewName,
          task_type: 'meeting',
          client_visible: true,
          start_date: reviewEndDate,
          end_date: reviewEndDate,
          order_index: maxOrder + 1,
          status: 'pending',
          weight_percent: 0,
          review_rounds: 0,
          percentage_allocation: 0,
          is_feedback_meeting: true,
        })
        .select()
        .single();

      if (reviewError) throw reviewError;

      // Optionally add rework buffer
      const { error: bufferError } = await supabase
        .from('tasks')
        .insert({
          phase_id: task.phase_id,
          project_id: project.id,
          name: `${task.name} Rework`,
          task_type: 'task',
          client_visible: true,
          start_date: reviewEndDate,
          end_date: reviewEndDate,
          order_index: maxOrder + 2,
          status: 'pending',
          weight_percent: 2,
          review_rounds: 0,
          percentage_allocation: 0,
        });

      if (bufferError) throw bufferError;

      // Create dependency: review depends on original task
      if (reviewTask) {
        await supabase
          .from('dependencies')
          .insert({
            predecessor_task_id: taskId,
            successor_task_id: reviewTask.id,
          });
      }

      toast({
        title: 'Review round added',
        description: `Added review meeting and rework buffer for ${task.name}.`,
      });

      onRefresh();
    } catch (error: any) {
      console.error('Error adding review round:', error);
      toast({
        title: 'Error',
        description: 'Failed to add review round.',
        variant: 'destructive',
      });
    }
  };

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      // First delete any dependencies involving this task
      await supabase
        .from('dependencies')
        .delete()
        .or(`predecessor_task_id.eq.${taskId},successor_task_id.eq.${taskId}`);

      // Then delete the task
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Task deleted',
        description: 'The task has been removed.',
      });

      onRefresh();
    } catch (error: any) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task.',
        variant: 'destructive',
      });
    }
  };

  // Handle open add meeting dialog
  const handleOpenAddMeeting = () => {
    const today = new Date();
    const defaultDate = today < projectStartDate ? projectStartDate : today;
    setNewMeetingDate(defaultDate);
    setAddMeetingDialogOpen(true);
  };

  // Handle add meeting (for Client Check-ins)
  const handleConfirmAddMeeting = async () => {
    if (!newMeetingDate) return;
    
    try {
      // Find the Client Check-ins phase
      const checkinPhase = phases.find(p => p.name === 'Client Check-ins');
      if (!checkinPhase) {
        toast({
          title: 'Error',
          description: 'Client Check-ins phase not found.',
          variant: 'destructive',
        });
        return;
      }

      const dateStr = format(newMeetingDate, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('tasks')
        .insert({
          phase_id: checkinPhase.id,
          project_id: project.id,
          name: 'Client Check-in',
          task_type: 'meeting',
          client_visible: true,
          start_date: dateStr,
          end_date: dateStr,
          order_index: tasks.filter(t => t.phase_id === checkinPhase.id).length,
          status: 'pending',
          weight_percent: 0,
          review_rounds: 0,
          percentage_allocation: 0,
          is_feedback_meeting: true,
        });

      if (error) throw error;

      toast({
        title: 'Meeting added',
        description: `New meeting added for ${format(newMeetingDate, 'MMM d, yyyy')}.`,
      });

      setAddMeetingDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      console.error('Error adding meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to add meeting.',
        variant: 'destructive',
      });
    }
  };

  // Handle delete meeting
  const handleDeleteMeeting = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Meeting deleted',
        description: 'The meeting has been removed.',
      });

      onRefresh();
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete meeting.',
        variant: 'destructive',
      });
    }
  };

  // Handle add segment to task
  const handleAddSegment = async (taskId: string, position: 'before' | 'after') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    try {
      const taskSegments = segments.filter(s => s.task_id === taskId);
      const libMask = getLibMask();
      
      let newStart: Date;
      let newEnd: Date;
      
      if (taskSegments.length === 0) {
        // No segments yet - create initial segment from task dates, then add new one
        if (task.start_date && task.end_date) {
          // First create the initial segment
          const { error: initialError } = await supabase
            .from('task_segments')
            .insert({
              task_id: taskId,
              start_date: task.start_date,
              end_date: task.end_date,
              order_index: 0,
            });
          
          if (initialError) throw initialError;
        }
        
        // Calculate new segment position based on task dates
        const taskEndDate = task.end_date ? new Date(task.end_date) : new Date();
        const taskStartDate = task.start_date ? new Date(task.start_date) : new Date();
        
        if (position === 'after') {
          newStart = addDays(taskEndDate, 3);
          newEnd = addDays(newStart, 2);
        } else {
          newEnd = addDays(taskStartDate, -3);
          newStart = addDays(newEnd, -2);
        }
      } else {
        // Has segments - add relative to first/last
        const sortedSegments = [...taskSegments].sort((a, b) => a.order_index - b.order_index);
        
        if (position === 'after') {
          const lastSegment = sortedSegments[sortedSegments.length - 1];
          newStart = addDays(new Date(lastSegment.end_date), 3);
          newEnd = addDays(newStart, 2);
        } else {
          const firstSegment = sortedSegments[0];
          newEnd = addDays(new Date(firstSegment.start_date), -3);
          newStart = addDays(newEnd, -2);
        }
      }
      
      // Snap to working days
      const normalized = snapTaskToWorkingDays(newStart, newEnd, libMask);
      
      // Determine order index
      const existingSegments = segments.filter(s => s.task_id === taskId);
      const newOrderIndex = position === 'after' 
        ? existingSegments.length 
        : 0;
      
      // If adding before, need to increment all existing segment order_index
      if (position === 'before' && existingSegments.length > 0) {
        for (const seg of existingSegments) {
          await supabase
            .from('task_segments')
            .update({ order_index: seg.order_index + 1 })
            .eq('id', seg.id);
        }
      }
      
      const { data: newSegment, error } = await supabase
        .from('task_segments')
        .insert({
          task_id: taskId,
          start_date: format(normalized.start, 'yyyy-MM-dd'),
          end_date: format(normalized.end, 'yyyy-MM-dd'),
          order_index: newOrderIndex,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update task's main dates to span all segments
      const allSegments = [...existingSegments, newSegment as TaskSegment];
      const allStarts = allSegments.map(s => new Date(s.start_date));
      const allEnds = allSegments.map(s => new Date(s.end_date));
      const minStart = new Date(Math.min(...allStarts.map(d => d.getTime())));
      const maxEnd = new Date(Math.max(...allEnds.map(d => d.getTime())));
      
      await supabase
        .from('tasks')
        .update({
          start_date: format(minStart, 'yyyy-MM-dd'),
          end_date: format(maxEnd, 'yyyy-MM-dd'),
        })
        .eq('id', taskId);
      
      toast({
        title: 'Period added',
        description: `New period added ${position} existing work.`,
      });
      
      onRefresh();
    } catch (error: any) {
      console.error('Error adding segment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add period.',
        variant: 'destructive',
      });
    }
  }

  // Regenerate schedule
  const handleRegenerate = async () => {
    setIsRegenerating(true);

    try {
      // Build schedule input from existing tasks
      const scheduleTasks: ScheduleTask[] = tasks.map(task => {
        const phase = phases.find(p => p.id === task.phase_id);
        return {
          _stepId: task.id,
          name: task.name,
          phaseCategory: (phase?.name || 'Production') as PhaseCategory,
          taskType: task.task_type as 'task' | 'milestone' | 'meeting',
          weightPercent: task.weight_percent || 0,
          reviewRounds: task.review_rounds || 0,
          clientVisible: task.client_visible,
        };
      });

      const scheduleDependencies: ScheduleDependency[] = dependencies.map(dep => ({
        predecessorId: dep.predecessor_task_id,
        successorId: dep.successor_task_id,
      }));

      // Run schedule engine
      const scheduleOutput = computeSchedule({
        projectStartDate: parse(project.start_date, 'yyyy-MM-dd', new Date()),
        projectEndDate: parse(project.end_date, 'yyyy-MM-dd', new Date()),
        workingDaysMask: project.working_days_mask,
        bufferPercentage: project.buffer_percentage,
        tasks: scheduleTasks,
        dependencies: scheduleDependencies,
        feedbackSettings: DEFAULT_FEEDBACK_SETTINGS, // Use defaults for regeneration
      });

      // Update tasks with new dates
      const updates = scheduleOutput.scheduledTasks
        .filter(st => !st.isGenerated) // Only update existing tasks, not generated ones
        .map(st => ({
          id: st._stepId,
          start_date: format(st.startDate, 'yyyy-MM-dd'),
          end_date: format(st.endDate, 'yyyy-MM-dd'),
        }));

      for (const update of updates) {
        await supabase
          .from('tasks')
          .update({
            start_date: update.start_date,
            end_date: update.end_date,
          })
          .eq('id', update.id);
      }

      // Handle generated weekly call task
      const weeklyCallTask = scheduleOutput.scheduledTasks.find(
        st => st.generatedType === 'check-in' && st.recurringDates
      );

      if (weeklyCallTask) {
        // Update local state to include the weekly call with recurring_dates
        const existingWeeklyCall = tasks.find(t => 
          t.name.toLowerCase().includes('weekly call') || 
          t.name.toLowerCase().includes('bi-weekly call') ||
          t.name.toLowerCase().includes('client check-in')
        );

        if (existingWeeklyCall) {
          // Update the existing weekly call with the generated recurring_dates
          onTasksChange(
            tasks.map(t => 
              t.id === existingWeeklyCall.id 
                ? { 
                    ...t, 
                    recurring_dates: weeklyCallTask.recurringDates,
                    start_date: format(weeklyCallTask.startDate, 'yyyy-MM-dd'),
                    end_date: format(weeklyCallTask.endDate, 'yyyy-MM-dd'),
                  } 
                : t
            )
          );
        } else {
          // Add a new one to local state (not persisted to DB, just for display)
          const weeklyCallDisplayTask: Task = {
            id: `generated-weekly-call-${Date.now()}`,
            phase_id: phases[0]?.id || '',
            project_id: project.id,
            name: weeklyCallTask.name,
            description: null,
            start_date: format(weeklyCallTask.startDate, 'yyyy-MM-dd'),
            end_date: format(weeklyCallTask.endDate, 'yyyy-MM-dd'),
            status: 'pending',
            task_type: 'meeting',
            percentage_allocation: 0,
            weight_percent: 0,
            is_milestone: false,
            is_feedback_meeting: true,
            client_visible: true,
            review_rounds: 0,
            narrative_text: null,
            order_index: -1, // Show at top
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            recurring_dates: weeklyCallTask.recurringDates,
          };
          
          onTasksChange([weeklyCallDisplayTask, ...tasks]);
        }
      }

      toast({
        title: 'Schedule regenerated',
        description: `Updated dates for ${updates.length} tasks. ${scheduleOutput.warnings.length > 0 ? scheduleOutput.warnings[0] : ''}`,
      });

      onRefresh();
    } catch (error: any) {
      console.error('Error regenerating schedule:', error);
      toast({
        title: 'Error',
        description: 'Failed to regenerate schedule.',
        variant: 'destructive',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  /**
   * Convert project's legacy working days mask to the new library format.
   * Old: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
   * New: bit 0 = Sunday, bit 1 = Monday, ..., bit 6 = Saturday
   */
  const getLibMask = useCallback(() => {
    const oldMask = project.working_days_mask ?? 31; // Default Mon-Fri
    let newMask = 0;
    if (oldMask & 1) newMask |= (1 << 1);   // Mon
    if (oldMask & 2) newMask |= (1 << 2);   // Tue
    if (oldMask & 4) newMask |= (1 << 3);   // Wed
    if (oldMask & 8) newMask |= (1 << 4);   // Thu
    if (oldMask & 16) newMask |= (1 << 5);  // Fri
    if (oldMask & 32) newMask |= (1 << 6);  // Sat
    if (oldMask & 64) newMask |= (1 << 0);  // Sun
    return newMask;
  }, [project.working_days_mask]);

  // Fix tasks with weekend dates
  const handleFixWeekends = useCallback(async () => {
    setIsFixingWeekends(true);
    
    try {
      const libMask = getLibMask();
      const tasksToFix: { id: string; start: Date; end: Date }[] = [];
      
      for (const task of tasks) {
        if (!task.start_date || !task.end_date) continue;
        
        const startDate = new Date(task.start_date);
        const endDate = new Date(task.end_date);
        
        // Check if this task has any non-working days
        if (hasNonWorkingDays(startDate, endDate, libMask)) {
          const normalized = normalizeTaskDates(startDate, endDate, libMask);
          if (normalized.changed) {
            tasksToFix.push({
              id: task.id,
              start: normalized.start,
              end: normalized.end,
            });
          }
        }
      }
      
      if (tasksToFix.length === 0) {
        toast({
          title: 'No changes needed',
          description: 'All tasks are already on working days only.',
        });
        setIsFixingWeekends(false);
        return;
      }
      
      // Save to undo stack before making changes
      saveToUndoStack(`Fix ${tasksToFix.length} weekend tasks`);
      
      // Update database
      for (const fix of tasksToFix) {
        await supabase
          .from('tasks')
          .update({
            start_date: format(fix.start, 'yyyy-MM-dd'),
            end_date: format(fix.end, 'yyyy-MM-dd'),
          })
          .eq('id', fix.id);
      }
      
      toast({
        title: 'Weekends fixed',
        description: `Updated ${tasksToFix.length} task(s) to exclude weekends.`,
      });
      
      onRefresh();
    } catch (error: any) {
      console.error('Error fixing weekends:', error);
      toast({
        title: 'Error',
        description: 'Failed to fix weekend dates.',
        variant: 'destructive',
      });
    } finally {
      setIsFixingWeekends(false);
    }
  }, [tasks, getLibMask, saveToUndoStack, onRefresh, toast]);

  // Auto-fix weekends on first load
  useEffect(() => {
    if (hasRunWeekendFixRef.current || tasks.length === 0) return;
    hasRunWeekendFixRef.current = true;
    
    // Check if any tasks need fixing
    const libMask = getLibMask();
    const needsFix = tasks.some(task => {
      if (!task.start_date || !task.end_date) return false;
      return hasNonWorkingDays(new Date(task.start_date), new Date(task.end_date), libMask);
    });
    
    if (needsFix) {
      // Auto-run the fix
      handleFixWeekends();
    }
  }, [tasks, getLibMask, handleFixWeekends]);

  // If a render prop is provided, call it with the handler; otherwise render default button
  const regenerateButtonElement = renderRegenerateButton 
    ? renderRegenerateButton({ onClick: handleRegenerate, isLoading: isRegenerating })
    : (
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleUndo}
          disabled={undoStackLength === 0 || isUndoing}
          className="gap-2"
          title={undoStackLength > 0 ? `Undo (${undoStackLength} changes)` : 'No changes to undo'}
        >
          {isUndoing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Undo2 className="w-4 h-4" />
          )}
          Undo
        </Button>
        <Button
          variant="outline"
          onClick={handleFixWeekends}
          disabled={isFixingWeekends}
          className="gap-2"
          title="Fix any tasks that span weekends"
        >
          {isFixingWeekends ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Wrench className="w-4 h-4" />
          )}
          Fix Weekends
        </Button>
        <Button
          variant="outline"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="gap-2"
        >
          {isRegenerating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Regenerate Schedule
        </Button>
      </div>
    );

  // Undo button for when using custom regenerate button
  const undoButton = (
    <Button
      variant="outline"
      onClick={handleUndo}
      disabled={undoStackLength === 0 || isUndoing}
      className="gap-2"
      title={undoStackLength > 0 ? `Undo (${undoStackLength} changes)` : 'No changes to undo'}
    >
      {isUndoing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Undo2 className="w-4 h-4" />
      )}
      Undo
    </Button>
  );

  return (
    <div className="space-y-4">
      {renderRegenerateButton ? (
        <div className="flex items-center justify-end gap-2">
          {undoButton}
        </div>
      ) : (
        regenerateButtonElement
      )}

      <GanttChart
        projectId={project.id}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        phases={phases}
        tasks={tasks}
        segments={segments}
        workingDaysMask={project.working_days_mask}
        checkinTime={project.checkin_time}
        checkinDuration={project.checkin_duration}
        checkinTimezone={project.checkin_timezone}
        onTaskUpdate={handleTaskUpdate}
        onTaskReorder={handleTaskReorder}
        onAddTask={handleAddTask}
        onAddReviewRound={handleAddReviewRound}
        onDeleteTask={handleDeleteTask}
        onAddMeeting={handleOpenAddMeeting}
        onDeleteMeeting={handleDeleteMeeting}
        onAddSegment={handleAddSegment}
        onEditSegments={(task) => {
          setSelectedTaskForSegments(task);
          setSegmentDialogOpen(true);
        }}
      />

      <AddTaskDialog
        open={addTaskDialogOpen}
        onOpenChange={setAddTaskDialogOpen}
        onAdd={handleCreateTask}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
      />

      {/* Add Meeting Dialog */}
      <Dialog open={addMeetingDialogOpen} onOpenChange={setAddMeetingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Meeting</DialogTitle>
            <DialogDescription>
              Select a date for the new client check-in meeting
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={newMeetingDate}
              onSelect={setNewMeetingDate}
              disabled={(date) =>
                date < projectStartDate || date > projectEndDate
              }
              className="rounded-md border"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMeetingDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmAddMeeting} disabled={!newMeetingDate}>
              Add Meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Segment Editor Dialog */}
      {selectedTaskForSegments && (
        <TaskSegmentDialog
          open={segmentDialogOpen}
          onOpenChange={setSegmentDialogOpen}
          task={selectedTaskForSegments}
          segments={segments.filter(s => s.task_id === selectedTaskForSegments.id)}
          workingDaysMask={project.working_days_mask}
          onSegmentsChange={(newSegments) => {
            const otherSegments = segments.filter(s => s.task_id !== selectedTaskForSegments.id);
            onSegmentsChange([...otherSegments, ...newSegments]);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
