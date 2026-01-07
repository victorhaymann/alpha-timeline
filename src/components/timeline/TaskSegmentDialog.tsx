import { useState, useEffect } from 'react';
import { TaskSegment, Task } from '@/types/database';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { CalendarIcon, Plus, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { snapTaskToWorkingDays } from '@/lib/workingDays';

interface TaskSegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task;
  segments: TaskSegment[];
  workingDaysMask: number;
  onSegmentsChange: (segments: TaskSegment[]) => void;
}

export function TaskSegmentDialog({
  open,
  onOpenChange,
  task,
  segments,
  workingDaysMask,
  onSegmentsChange,
}: TaskSegmentDialogProps) {
  const { toast } = useToast();
  const [localSegments, setLocalSegments] = useState<TaskSegment[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize local segments when dialog opens
  useEffect(() => {
    if (open) {
      if (segments.length > 0) {
        setLocalSegments([...segments].sort((a, b) => a.order_index - b.order_index));
      } else if (task.start_date && task.end_date) {
        // Create initial segment from task dates
        setLocalSegments([{
          id: 'temp-initial',
          task_id: task.id,
          start_date: task.start_date,
          end_date: task.end_date,
          order_index: 0,
          created_at: new Date().toISOString(),
        }]);
      }
    }
  }, [open, segments, task]);

  const handleAddSegment = () => {
    const lastSegment = localSegments[localSegments.length - 1];
    const lastEndDate = lastSegment ? new Date(lastSegment.end_date) : new Date(task.end_date || new Date());
    
    // Default: start 3 days after last segment ends, duration 2 days
    const newStart = addDays(lastEndDate, 3);
    const newEnd = addDays(newStart, 2);
    
    // Snap to working days
    const normalized = snapTaskToWorkingDays(newStart, newEnd, workingDaysMask);

    const newSegment: TaskSegment = {
      id: `temp-${Date.now()}`,
      task_id: task.id,
      start_date: format(normalized.start, 'yyyy-MM-dd'),
      end_date: format(normalized.end, 'yyyy-MM-dd'),
      order_index: localSegments.length,
      created_at: new Date().toISOString(),
    };

    setLocalSegments([...localSegments, newSegment]);
  };

  const handleUpdateSegment = (index: number, field: 'start_date' | 'end_date', date: Date) => {
    const updated = [...localSegments];
    const segment = updated[index];
    
    if (field === 'start_date') {
      const endDate = new Date(segment.end_date);
      if (date > endDate) {
        // If start is after end, move end too
        const normalized = snapTaskToWorkingDays(date, date, workingDaysMask);
        segment.start_date = format(normalized.start, 'yyyy-MM-dd');
        segment.end_date = format(normalized.end, 'yyyy-MM-dd');
      } else {
        const normalized = snapTaskToWorkingDays(date, endDate, workingDaysMask);
        segment.start_date = format(normalized.start, 'yyyy-MM-dd');
        segment.end_date = format(normalized.end, 'yyyy-MM-dd');
      }
    } else {
      const startDate = new Date(segment.start_date);
      if (date < startDate) {
        // If end is before start, move start too
        const normalized = snapTaskToWorkingDays(date, date, workingDaysMask);
        segment.start_date = format(normalized.start, 'yyyy-MM-dd');
        segment.end_date = format(normalized.end, 'yyyy-MM-dd');
      } else {
        const normalized = snapTaskToWorkingDays(startDate, date, workingDaysMask);
        segment.start_date = format(normalized.start, 'yyyy-MM-dd');
        segment.end_date = format(normalized.end, 'yyyy-MM-dd');
      }
    }
    
    setLocalSegments(updated);
  };

  const handleDeleteSegment = (index: number) => {
    if (localSegments.length <= 1) {
      toast({
        title: 'Cannot delete',
        description: 'A task must have at least one period.',
        variant: 'destructive',
      });
      return;
    }
    
    const updated = localSegments.filter((_, i) => i !== index);
    // Reindex
    updated.forEach((seg, i) => seg.order_index = i);
    setLocalSegments(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    
    try {
      // Delete existing segments
      await supabase
        .from('task_segments')
        .delete()
        .eq('task_id', task.id);

      // Insert new segments
      const segmentsToInsert = localSegments.map((seg, index) => ({
        task_id: task.id,
        start_date: seg.start_date,
        end_date: seg.end_date,
        order_index: index,
      }));

      const { data: insertedSegments, error } = await supabase
        .from('task_segments')
        .insert(segmentsToInsert)
        .select();

      if (error) throw error;

      // Update task's main dates to span all segments
      const allStarts = localSegments.map(s => new Date(s.start_date));
      const allEnds = localSegments.map(s => new Date(s.end_date));
      const minStart = new Date(Math.min(...allStarts.map(d => d.getTime())));
      const maxEnd = new Date(Math.max(...allEnds.map(d => d.getTime())));

      await supabase
        .from('tasks')
        .update({
          start_date: format(minStart, 'yyyy-MM-dd'),
          end_date: format(maxEnd, 'yyyy-MM-dd'),
        })
        .eq('id', task.id);

      onSegmentsChange(insertedSegments as TaskSegment[]);
      
      toast({
        title: 'Segments saved',
        description: `${localSegments.length} period${localSegments.length > 1 ? 's' : ''} saved.`,
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving segments:', error);
      toast({
        title: 'Error',
        description: 'Failed to save segments.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Periods for "{task.name}"</DialogTitle>
          <DialogDescription>
            Add multiple time periods for this task. Periods will be shown as connected segments on the timeline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-[400px] overflow-y-auto py-4">
          {localSegments.map((segment, index) => (
            <div
              key={segment.id}
              className="flex items-center gap-2 p-3 rounded-lg border bg-card"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              
              <span className="text-sm font-medium text-muted-foreground w-8">
                #{index + 1}
              </span>

              {/* Start Date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("justify-start text-left font-normal flex-1")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(segment.start_date), 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(segment.start_date)}
                    onSelect={(date) => date && handleUpdateSegment(index, 'start_date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-muted-foreground">→</span>

              {/* End Date */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn("justify-start text-left font-normal flex-1")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(new Date(segment.end_date), 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={new Date(segment.end_date)}
                    onSelect={(date) => date && handleUpdateSegment(index, 'end_date', date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteSegment(index)}
                disabled={localSegments.length <= 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleAddSegment}
        >
          <Plus className="w-4 h-4" />
          Add Period
        </Button>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Periods'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
