import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, getDay } from 'date-fns';
import { nextWorkingDay, addWorkingDays, DEFAULT_WORKING_DAYS_MASK } from '@/lib/workingDays';

interface AddTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (task: {
    name: string;
    task_type: 'task' | 'milestone' | 'meeting';
    client_visible: boolean;
    start_date: string;
    end_date: string;
  }) => void;
  projectStartDate: Date;
  projectEndDate: Date;
}

export function AddTaskDialog({
  open,
  onOpenChange,
  onAdd,
  projectStartDate,
  projectEndDate,
}: AddTaskDialogProps) {
  // Calculate working days mask for Mon-Fri
  const workingDaysMask = DEFAULT_WORKING_DAYS_MASK;
  
  const today = new Date();
  const defaultStart = useMemo(() => {
    const base = today < projectStartDate ? projectStartDate : today;
    return nextWorkingDay(base, workingDaysMask);
  }, [projectStartDate]);
  
  const [name, setName] = useState('');
  const [taskType, setTaskType] = useState<'task' | 'milestone' | 'meeting'>('task');
  const [clientVisible, setClientVisible] = useState(true);
  const [startDate, setStartDate] = useState(format(defaultStart, 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addWorkingDays(defaultStart, 3, workingDaysMask), 'yyyy-MM-dd'));

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      task_type: taskType,
      client_visible: clientVisible,
      start_date: startDate,
      end_date: taskType === 'milestone' ? startDate : endDate,
    });

    // Reset form with proper working day defaults
    const resetStart = nextWorkingDay(today < projectStartDate ? projectStartDate : today, workingDaysMask);
    setName('');
    setTaskType('task');
    setClientVisible(true);
    setStartDate(format(resetStart, 'yyyy-MM-dd'));
    setEndDate(format(addWorkingDays(resetStart, 3, workingDaysMask), 'yyyy-MM-dd'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new task for this phase
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="task-name">Task Name *</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Animation Polish"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-type">Type</Label>
            <Select value={taskType} onValueChange={(v) => setTaskType(v as typeof taskType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Task</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="meeting">Meeting</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={format(projectStartDate, 'yyyy-MM-dd')}
                max={format(projectEndDate, 'yyyy-MM-dd')}
              />
            </div>

            {taskType !== 'milestone' && (
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                  max={format(projectEndDate, 'yyyy-MM-dd')}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="client-visible">Client Visible</Label>
              <p className="text-xs text-muted-foreground">
                Show this task in the client portal
              </p>
            </div>
            <Switch
              id="client-visible"
              checked={clientVisible}
              onCheckedChange={setClientVisible}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Add Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
