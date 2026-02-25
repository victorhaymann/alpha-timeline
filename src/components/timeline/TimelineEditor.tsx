import { useState, useCallback, useRef, useEffect } from 'react';
import { Task, Phase, Dependency, Project, PhaseCategory, TaskSegment } from '@/types/database';
import { DragResult } from '@/hooks/useDragAndResize';
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
import { 
  RefreshCw,
  Loader2,
  Undo2,
  Wrench,
  CalendarRange
} from 'lucide-react';
import { ShiftTimelineDialog } from './ShiftTimelineDialog';
import { format, parse, addDays, differenceInDays } from 'date-fns';
import { computeSchedule, ScheduleTask, ScheduleDependency } from '@/lib/scheduleEngine';
import { DEFAULT_FEEDBACK_SETTINGS } from '@/components/steps/FeedbackConfig';
import { snapTaskToWorkingDays, hasEndpointsOnNonWorkingDays, DEFAULT_WORKING_DAYS_MASK, nextWorkingDay as nextWorkingDayLib, convertLegacyMaskToLibFormat, addWorkingDays } from '@/lib/workingDays';
import { normalizeSegmentDates } from '@/lib/segmentUtils';

// Maximum number of undo states to keep
const MAX_UNDO_STACK_SIZE = 20;

interface UndoState {
  tasks: Task[];
  segments: TaskSegment[];
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
  renderActionButtons?: (props: {
    onUndo: () => void;
    undoDisabled: boolean;
    isUndoing: boolean;
    undoCount: number;
    onShiftTimeline: () => void;
  }) => React.ReactNode;
  hiddenMeetingDates?: Set<string>;
  onToggleMeetingVisibility?: (date: string, hidden: boolean) => void;
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
  renderActionButtons,
  hiddenMeetingDates,
  onToggleMeetingVisibility,
}: TimelineEditorProps) {
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isFixingWeekends, setIsFixingWeekends] = useState(false);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [addMeetingDialogOpen, setAddMeetingDialogOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState<Date | undefined>(undefined);
  const [isUndoing, setIsUndoing] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const hasRunWeekendFixRef = useRef(false);
  
  
  
  // Undo stack - stores previous task states
  const undoStackRef = useRef<UndoState[]>([]);
  const [undoStackLength, setUndoStackLength] = useState(0);

  const projectStartDate = new Date(project.start_date);
  const projectEndDate = new Date(project.end_date);


  // Save current state to undo stack before making changes
  const saveToUndoStack = useCallback((description: string) => {
    const newState: UndoState = {
      tasks: JSON.parse(JSON.stringify(tasks)), // Deep clone
      segments: JSON.parse(JSON.stringify(segments)), // Deep clone segments too
      description,
    };
    
    undoStackRef.current = [
      ...undoStackRef.current.slice(-(MAX_UNDO_STACK_SIZE - 1)),
      newState,
    ];
    setUndoStackLength(undoStackRef.current.length);
  }, [tasks, segments]);

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
      
      // Restore segments to database
      // First, get current segments for tasks in the previous state
      const taskIds = previousState.tasks.map(t => t.id);
      const previousSegmentTaskIds = [...new Set(previousState.segments.map(s => s.task_id))];
      
      // Delete segments that exist now but weren't in the previous state
      for (const taskId of taskIds) {
        const previousSegsForTask = previousState.segments.filter(s => s.task_id === taskId);
        const previousSegIds = previousSegsForTask.map(s => s.id);
        
        // Delete all current segments for this task and re-insert the previous ones
        await supabase.from('task_segments').delete().eq('task_id', taskId);
        
        // Re-insert previous segments
        if (previousSegsForTask.length > 0) {
          await supabase.from('task_segments').insert(
            previousSegsForTask.map(seg => ({
              id: seg.id,
              task_id: seg.task_id,
              start_date: seg.start_date,
              end_date: seg.end_date,
              order_index: seg.order_index,
              segment_type: seg.segment_type,
            }))
          );
        }
      }
      
      // Update local state
      onTasksChange(previousState.tasks);
      onSegmentsChange(previousState.segments);
      
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
  }, [onTasksChange, onSegmentsChange, onRefresh, toast]);

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

  /**
   * Convert project's legacy working days mask to the new library format.
   */
  const getLibMask = useCallback(() => {
    const oldMask = project.working_days_mask ?? 31; // Default Mon-Fri
    return convertLegacyMaskToLibFormat(oldMask);
  }, [project.working_days_mask]);

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
      const normalized = snapTaskToWorkingDays(startDate, endDate, libMask);
      
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

  // Legacy handleAddReviewRound removed - now using inline task segments instead

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    try {
      // First delete any segments for this task
      await supabase
        .from('task_segments')
        .delete()
        .eq('task_id', taskId);

      // Then delete any dependencies involving this task
      await supabase
        .from('dependencies')
        .delete()
        .or(`predecessor_task_id.eq.${taskId},successor_task_id.eq.${taskId}`);

      // Finally delete the task
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

  // Handle update segment (from Gantt drag/resize) - UNIFIED via normalizeSegmentDates
  const handleUpdateSegment = useCallback(async (segmentId: string, updates: { start_date?: string; end_date?: string }) => {
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;
    
    const task = tasks.find(t => t.id === segment.task_id);
    saveToUndoStack(task ? `Update period for "${task.name}"` : 'Update period');
    
    try {
      // Merge updates with current segment dates
      const currentStart = new Date(updates.start_date || segment.start_date);
      const currentEnd = new Date(updates.end_date || segment.end_date);
      
      // Use centralized normalization (clamp + snap + re-clamp)
      const normalized = normalizeSegmentDates(currentStart, currentEnd, {
        projectStartDate,
        projectEndDate,
        workingDaysMask: project.working_days_mask ?? 31,
      });
      
      // Update segment in database
      const { error } = await supabase
        .from('task_segments')
        .update(normalized)
        .eq('id', segmentId);

      if (error) throw error;
      
      // Update local segment state
      const updatedSegments = segments.map(s => 
        s.id === segmentId ? { ...s, ...normalized } : s
      );
      onSegmentsChange(updatedSegments);
      
      // Parent task dates are synced automatically by database trigger
    } catch (error: any) {
      console.error('Error updating segment:', error);
      toast({
        title: 'Error',
        description: 'Failed to update period.',
        variant: 'destructive',
      });
    }
  }, [segments, tasks, saveToUndoStack, projectStartDate, projectEndDate, project.working_days_mask, onSegmentsChange, toast]);

  // Batch update segments — single undo save, batch DB writes, single local state update.
  // Used by GanttChart when dragging/resizing the main task bar of a segmented task,
  // to avoid stale-closure clobbering when calling onUpdateSegment in a loop.
  const handleBatchUpdateSegments = useCallback(async (
    updates: { segmentId: string; changes: { start_date?: string; end_date?: string } }[]
  ) => {
    if (updates.length === 0) return;

    // Single undo save
    const firstSeg = segments.find(s => s.id === updates[0].segmentId);
    const task = firstSeg ? tasks.find(t => t.id === firstSeg.task_id) : null;
    saveToUndoStack(task ? `Move "${task.name}"` : 'Move task');

    try {
      // Normalize all updates
      const normalizedUpdates = updates.map(({ segmentId, changes }) => {
        const segment = segments.find(s => s.id === segmentId);
        if (!segment) return null;
        const currentStart = new Date(changes.start_date || segment.start_date);
        const currentEnd = new Date(changes.end_date || segment.end_date);
        const normalized = normalizeSegmentDates(currentStart, currentEnd, {
          projectStartDate,
          projectEndDate,
          workingDaysMask: project.working_days_mask ?? 31,
        });
        return { segmentId, normalized };
      }).filter(Boolean) as { segmentId: string; normalized: { start_date: string; end_date: string } }[];

      // Batch DB writes (fire all at once)
      await Promise.all(normalizedUpdates.map(({ segmentId, normalized }) =>
        supabase.from('task_segments').update(normalized).eq('id', segmentId)
      ));

      // Single local state update
      let updatedSegments = [...segments];
      for (const { segmentId, normalized } of normalizedUpdates) {
        updatedSegments = updatedSegments.map(s =>
          s.id === segmentId ? { ...s, ...normalized } : s
        );
      }
      onSegmentsChange(updatedSegments);
    } catch (error: any) {
      console.error('Error batch updating segments:', error);
      toast({ title: 'Error', description: 'Failed to update periods.', variant: 'destructive' });
    }
  }, [segments, tasks, saveToUndoStack, projectStartDate, projectEndDate, project.working_days_mask, onSegmentsChange, toast]);

  // ── Unified drag completion handler ─────────────────────────────────────
  // All drag/resize operations from the Gantt hook flow through here.
  // Routes to: task update, single segment update, or batch segment update.
  const handleDragComplete = useCallback(async (result: DragResult) => {
    const { type, taskId, segmentId, newStart, newEnd } = result;

    // Individual segment drag/resize
    if (segmentId) {
      handleUpdateSegment(segmentId, { start_date: newStart, end_date: newEnd });
      return;
    }

    // Task-level drag/resize
    const taskSegs = segments.filter(s => s.task_id === taskId);

    if (taskSegs.length === 0) {
      // Simple task (no segments) — update task directly
      handleTaskUpdate(taskId, { start_date: newStart, end_date: newEnd });
      return;
    }

    // Segmented task — compute deltas and batch update all segments
    const segStarts = taskSegs.map(s => new Date(s.start_date).getTime());
    const segEnds = taskSegs.map(s => new Date(s.end_date).getTime());
    const oldStart = new Date(Math.min(...segStarts));
    const oldEnd = new Date(Math.max(...segEnds));
    const startDelta = differenceInDays(new Date(newStart), oldStart);
    const endDelta = differenceInDays(new Date(newEnd), oldEnd);

    if (startDelta === 0 && endDelta === 0) return;

    const sorted = [...taskSegs].sort((a, b) => a.order_index - b.order_index);
    const batchUpdates: { segmentId: string; changes: { start_date?: string; end_date?: string } }[] = [];

    if (startDelta === endDelta) {
      // MOVE: shift all segments uniformly
      for (const seg of taskSegs) {
        batchUpdates.push({
          segmentId: seg.id,
          changes: {
            start_date: format(addDays(new Date(seg.start_date), startDelta), 'yyyy-MM-dd'),
            end_date: format(addDays(new Date(seg.end_date), startDelta), 'yyyy-MM-dd'),
          },
        });
      }
    } else if (startDelta === 0) {
      // RESIZE-END: only adjust last segment's end_date
      const lastSeg = sorted[sorted.length - 1];
      batchUpdates.push({
        segmentId: lastSeg.id,
        changes: { end_date: format(addDays(new Date(lastSeg.end_date), endDelta), 'yyyy-MM-dd') },
      });
    } else if (endDelta === 0) {
      // RESIZE-START: only adjust first segment's start_date
      const firstSeg = sorted[0];
      batchUpdates.push({
        segmentId: firstSeg.id,
        changes: { start_date: format(addDays(new Date(firstSeg.start_date), startDelta), 'yyyy-MM-dd') },
      });
    } else {
      // Mixed delta: shift all, then override last segment's end
      for (const seg of taskSegs) {
        batchUpdates.push({
          segmentId: seg.id,
          changes: {
            start_date: format(addDays(new Date(seg.start_date), startDelta), 'yyyy-MM-dd'),
            end_date: format(addDays(new Date(seg.end_date), startDelta), 'yyyy-MM-dd'),
          },
        });
      }
      const lastSeg = sorted[sorted.length - 1];
      const lastIdx = batchUpdates.findIndex(u => u.segmentId === lastSeg.id);
      if (lastIdx >= 0) {
        batchUpdates[lastIdx].changes.end_date = format(addDays(new Date(lastSeg.end_date), endDelta), 'yyyy-MM-dd');
      }
    }

    handleBatchUpdateSegments(batchUpdates);
  }, [segments, handleTaskUpdate, handleUpdateSegment, handleBatchUpdateSegments]);

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
        
        // Check if start or end falls on a non-working day (not just spans weekends)
        if (hasEndpointsOnNonWorkingDays(startDate, endDate, libMask)) {
          const normalized = snapTaskToWorkingDays(startDate, endDate, libMask);
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
      return hasEndpointsOnNonWorkingDays(new Date(task.start_date), new Date(task.end_date), libMask);
    });
    
    if (needsFix) {
      // Auto-run the fix
      handleFixWeekends();
    }
  }, [tasks, getLibMask, handleFixWeekends]);

  // Handle shift timeline
  const handleShiftTimeline = async (params: {
    days: number;
    direction: 'forward' | 'backward';
    scope: 'all' | 'from_date';
    fromDate?: Date;
    autoExtend: boolean;
  }) => {
    const { days: shiftDays, direction, scope, fromDate, autoExtend } = params;
    const signedDays = direction === 'forward' ? shiftDays : -shiftDays;
    const libMask = getLibMask();

    // Save current state for undo
    saveToUndoStack(`Shift timeline ${direction === 'forward' ? '+' : '-'}${shiftDays} days`);

    try {
      // Determine affected tasks
      let affectedTasks = tasks.filter(t => t.start_date && t.end_date);
      if (scope === 'from_date' && fromDate) {
        const fromStr = format(fromDate, 'yyyy-MM-dd');
        affectedTasks = affectedTasks.filter(t => t.start_date! >= fromStr || t.end_date! >= fromStr);
      }
      const affectedTaskIds = new Set(affectedTasks.map(t => t.id));
      const affectedSegments = segments.filter(s => affectedTaskIds.has(s.task_id));

      // Shift tasks
      const updatedTasks = tasks.map(t => {
        if (!affectedTaskIds.has(t.id) || !t.start_date || !t.end_date) return t;
        const newStart = addWorkingDays(new Date(t.start_date), signedDays, libMask);
        const newEnd = addWorkingDays(new Date(t.end_date), signedDays, libMask);
        return {
          ...t,
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        };
      });

      // Shift segments
      const updatedSegments = segments.map(s => {
        if (!affectedTaskIds.has(s.task_id)) return s;
        const newStart = addWorkingDays(new Date(s.start_date), signedDays, libMask);
        const newEnd = addWorkingDays(new Date(s.end_date), signedDays, libMask);
        return {
          ...s,
          start_date: format(newStart, 'yyyy-MM-dd'),
          end_date: format(newEnd, 'yyyy-MM-dd'),
        };
      });

      // Auto-extend project end date if needed
      if (autoExtend) {
        let latestEnd = projectEndDate;
        for (const t of updatedTasks) {
          if (t.end_date && new Date(t.end_date) > latestEnd) {
            latestEnd = new Date(t.end_date);
          }
        }
        for (const s of updatedSegments) {
          if (new Date(s.end_date) > latestEnd) {
            latestEnd = new Date(s.end_date);
          }
        }
        if (latestEnd > projectEndDate) {
          await supabase
            .from('projects')
            .update({ end_date: format(latestEnd, 'yyyy-MM-dd') })
            .eq('id', project.id);
        }
      }

      // Identify tasks with vs without segments
      const taskIdsWithSegments = new Set(affectedSegments.map(s => s.task_id));
      const segmentlessTasks = updatedTasks.filter(
        t => affectedTaskIds.has(t.id) && !taskIdsWithSegments.has(t.id)
      );

      // 1. Update all segments first (triggers will sync parent task dates)
      const segmentUpdatePromises = updatedSegments
        .filter(s => affectedTaskIds.has(s.task_id))
        .map(s =>
          supabase
            .from('task_segments')
            .update({ start_date: s.start_date, end_date: s.end_date })
            .eq('id', s.id)
        );
      await Promise.all(segmentUpdatePromises);

      // 2. Then update only segmentless tasks (no trigger race)
      if (segmentlessTasks.length > 0) {
        const taskUpdatePromises = segmentlessTasks.map(t =>
          supabase
            .from('tasks')
            .update({ start_date: t.start_date, end_date: t.end_date })
            .eq('id', t.id)
        );
        await Promise.all(taskUpdatePromises);
      }

      // 3. Update local state — no onRefresh() needed, local state is already correct
      onTasksChange(updatedTasks);
      onSegmentsChange(updatedSegments);

      toast({
        title: 'Timeline shifted',
        description: `Moved ${affectedTasks.length} task${affectedTasks.length !== 1 ? 's' : ''} ${direction} by ${shiftDays} working day${shiftDays !== 1 ? 's' : ''}.`,
      });
    } catch (error: any) {
      console.error('Error shifting timeline:', error);
      toast({
        title: 'Error',
        description: 'Failed to shift timeline.',
        variant: 'destructive',
      });
      onRefresh();
    }
  };

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
          onClick={() => setShiftDialogOpen(true)}
          className="gap-2"
          title="Shift all tasks forward or backward"
        >
          <CalendarRange className="w-4 h-4" />
          Shift Timeline
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
        renderActionButtons ? (
          renderActionButtons({
            onUndo: handleUndo,
            undoDisabled: undoStackLength === 0 || isUndoing,
            isUndoing,
            undoCount: undoStackLength,
            onShiftTimeline: () => setShiftDialogOpen(true),
          }) ?? null
        ) : (
          <div className="flex items-center justify-end gap-2">
            {undoButton}
            <Button
              variant="outline"
              onClick={() => setShiftDialogOpen(true)}
              className="gap-2"
              title="Shift all tasks forward or backward"
            >
              <CalendarRange className="w-4 h-4" />
              Shift Timeline
            </Button>
          </div>
        )
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
        onDeleteTask={handleDeleteTask}
        onAddMeeting={handleOpenAddMeeting}
        onDeleteMeeting={handleDeleteMeeting}
        onUpdateSegment={handleUpdateSegment}
        onDragComplete={handleDragComplete}
        hiddenMeetingDates={hiddenMeetingDates}
        onToggleMeetingVisibility={onToggleMeetingVisibility}
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


      <ShiftTimelineDialog
        open={shiftDialogOpen}
        onOpenChange={setShiftDialogOpen}
        tasks={tasks}
        segments={segments}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        workingDaysMask={project.working_days_mask}
        onShift={handleShiftTimeline}
      />
    </div>
  );
}
