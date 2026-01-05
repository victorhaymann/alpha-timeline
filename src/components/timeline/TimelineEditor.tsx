import { useState } from 'react';
import { Task, Phase, Dependency, Project, PhaseCategory } from '@/types/database';
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
  Loader2
} from 'lucide-react';
import { format, parse } from 'date-fns';
import { computeSchedule, ScheduleTask, ScheduleDependency } from '@/lib/scheduleEngine';
import { DEFAULT_FEEDBACK_SETTINGS } from '@/components/steps/FeedbackConfig';

interface TimelineEditorProps {
  project: Project;
  phases: Phase[];
  tasks: Task[];
  dependencies: Dependency[];
  onTasksChange: (tasks: Task[]) => void;
  onRefresh: () => void;
  onTaskClick?: (task: Task) => void;
  renderRegenerateButton?: (props: { onClick: () => void; isLoading: boolean }) => React.ReactNode;
}

export function TimelineEditor({
  project,
  phases,
  tasks,
  dependencies,
  onTasksChange,
  onRefresh,
  renderRegenerateButton,
}: TimelineEditorProps) {
  const { toast } = useToast();
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [addTaskDialogOpen, setAddTaskDialogOpen] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [addMeetingDialogOpen, setAddMeetingDialogOpen] = useState(false);
  const [newMeetingDate, setNewMeetingDate] = useState<Date | undefined>(undefined);

  const projectStartDate = new Date(project.start_date);
  const projectEndDate = new Date(project.end_date);

  // Handle task update (from Gantt drag/resize)
  const handleTaskUpdate = async (taskId: string, updates: Partial<Task>) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);

      if (error) throw error;

      // Update local state
      onTasksChange(
        tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
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

  // Handle task reorder within phase
  const handleTaskReorder = async (phaseId: string, taskId: string, newIndex: number) => {
    const phaseTasks = tasks
      .filter(t => t.phase_id === phaseId)
      .sort((a, b) => a.order_index - b.order_index);

    const taskIndex = phaseTasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1 || taskIndex === newIndex) return;

    // Reorder
    const [movedTask] = phaseTasks.splice(taskIndex, 1);
    phaseTasks.splice(newIndex, 0, movedTask);

    // Update order indices
    const updates = phaseTasks.map((task, i) => ({
      id: task.id,
      order_index: i,
    }));

    try {
      for (const update of updates) {
        await supabase
          .from('tasks')
          .update({ order_index: update.order_index })
          .eq('id', update.id);
      }

      onRefresh();
    } catch (error: any) {
      console.error('Error reordering tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to reorder tasks.',
        variant: 'destructive',
      });
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

      const { error } = await supabase
        .from('tasks')
        .insert({
          phase_id: selectedPhaseId,
          project_id: project.id,
          name: taskData.name,
          task_type: taskData.task_type,
          client_visible: taskData.client_visible,
          start_date: taskData.start_date,
          end_date: taskData.end_date,
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
          client_visible: false,
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

  // If a render prop is provided, call it with the handler; otherwise render default button
  const regenerateButtonElement = renderRegenerateButton 
    ? renderRegenerateButton({ onClick: handleRegenerate, isLoading: isRegenerating })
    : (
      <div className="flex items-center justify-end">
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

  return (
    <div className="space-y-4">
      {!renderRegenerateButton && regenerateButtonElement}

      <GanttChart
        projectId={project.id}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        phases={phases}
        tasks={tasks}
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
    </div>
  );
}
