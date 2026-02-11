import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { CalendarIcon, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Task, TaskSegment } from '@/types/database';
import { addWorkingDays, convertLegacyMaskToLibFormat } from '@/lib/workingDays';

type ShiftScope = 'all' | 'from_date';
type ShiftDirection = 'forward' | 'backward';

interface ShiftTimelineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  segments: TaskSegment[];
  projectStartDate: Date;
  projectEndDate: Date;
  workingDaysMask: number | null;
  onShift: (params: {
    days: number;
    direction: ShiftDirection;
    scope: ShiftScope;
    fromDate?: Date;
    autoExtend: boolean;
  }) => void;
}

export function ShiftTimelineDialog({
  open,
  onOpenChange,
  tasks,
  segments,
  projectStartDate,
  projectEndDate,
  workingDaysMask,
  onShift,
}: ShiftTimelineDialogProps) {
  const [days, setDays] = useState(1);
  const [direction, setDirection] = useState<ShiftDirection>('forward');
  const [scope, setScope] = useState<ShiftScope>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [autoExtend, setAutoExtend] = useState(false);

  const libMask = convertLegacyMaskToLibFormat(workingDaysMask ?? 31);

  // Calculate affected counts
  const { affectedTasks, affectedSegments, wouldOverflow, newEndDate } = useMemo(() => {
    const signedDays = direction === 'forward' ? days : -days;

    let filteredTasks = tasks.filter(t => t.start_date && t.end_date);
    if (scope === 'from_date' && fromDate) {
      const fromStr = format(fromDate, 'yyyy-MM-dd');
      filteredTasks = filteredTasks.filter(t => t.start_date! >= fromStr || t.end_date! >= fromStr);
    }

    const taskIds = new Set(filteredTasks.map(t => t.id));
    const filteredSegments = segments.filter(s => taskIds.has(s.task_id));

    // Check if any task would overflow project end date
    let latestEnd = projectEndDate;
    for (const task of filteredTasks) {
      if (task.end_date) {
        const shifted = addWorkingDays(new Date(task.end_date), signedDays, libMask);
        if (shifted > latestEnd) latestEnd = shifted;
      }
    }
    for (const seg of filteredSegments) {
      const shifted = addWorkingDays(new Date(seg.end_date), signedDays, libMask);
      if (shifted > latestEnd) latestEnd = shifted;
    }

    return {
      affectedTasks: filteredTasks.length,
      affectedSegments: filteredSegments.length,
      wouldOverflow: latestEnd > projectEndDate,
      newEndDate: latestEnd,
    };
  }, [tasks, segments, days, direction, scope, fromDate, projectEndDate, libMask]);

  const handleSubmit = () => {
    onShift({
      days,
      direction,
      scope,
      fromDate: scope === 'from_date' ? fromDate : undefined,
      autoExtend,
    });
    onOpenChange(false);
    // Reset state
    setDays(1);
    setDirection('forward');
    setScope('all');
    setFromDate(undefined);
    setAutoExtend(false);
  };

  const canSubmit = days > 0 && affectedTasks > 0 && (scope === 'all' || fromDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Shift Timeline</DialogTitle>
          <DialogDescription>
            Move tasks forward or backward by a number of working days
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Days input */}
          <div className="space-y-2">
            <Label>Working days to shift</Label>
            <Input
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </div>

          {/* Direction toggle */}
          <div className="space-y-2">
            <Label>Direction</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === 'forward' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setDirection('forward')}
              >
                <ArrowRight className="w-4 h-4" />
                Forward
              </Button>
              <Button
                type="button"
                variant={direction === 'backward' ? 'default' : 'outline'}
                className="flex-1 gap-2"
                onClick={() => setDirection('backward')}
              >
                <ArrowLeft className="w-4 h-4" />
                Backward
              </Button>
            </div>
          </div>

          {/* Scope selector */}
          <div className="space-y-2">
            <Label>Scope</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={scope === 'all' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setScope('all')}
              >
                All tasks
              </Button>
              <Button
                type="button"
                variant={scope === 'from_date' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setScope('from_date')}
              >
                From date onward
              </Button>
            </div>

            {scope === 'from_date' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal mt-2',
                      !fromDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, 'PPP') : 'Pick a start date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={setFromDate}
                    disabled={(date) =>
                      date < projectStartDate || date > projectEndDate
                    }
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Preview summary */}
          <div className="rounded-md border bg-muted/50 p-3 text-sm">
            <p>
              This will move <strong>{affectedTasks} task{affectedTasks !== 1 ? 's' : ''}</strong>
              {affectedSegments > 0 && (
                <> and <strong>{affectedSegments} segment{affectedSegments !== 1 ? 's' : ''}</strong></>
              )}
              {' '}{direction} by <strong>{days} working day{days !== 1 ? 's' : ''}</strong>
            </p>
          </div>

          {/* Overflow warning */}
          {wouldOverflow && direction === 'forward' && (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium text-orange-600 dark:text-orange-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Tasks will exceed project end date
              </div>
              <p className="text-muted-foreground">
                New latest date: {format(newEndDate, 'MMM d, yyyy')} (currently {format(projectEndDate, 'MMM d, yyyy')})
              </p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoExtend}
                  onChange={(e) => setAutoExtend(e.target.checked)}
                  className="rounded"
                />
                <span>Auto-extend project deadline</span>
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || (wouldOverflow && direction === 'forward' && !autoExtend)}
          >
            Shift Timeline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
