import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PHASE_CATEGORIES, PhaseCategory } from '@/types/database';

interface AddCanonicalStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (step: {
    name: string;
    description: string;
    phase_category: PhaseCategory;
    task_type: 'task' | 'milestone' | 'meeting';
    is_optional: boolean;
  }) => void;
  defaultPhase?: PhaseCategory;
}

export function AddCanonicalStepDialog({
  open,
  onOpenChange,
  onAdd,
  defaultPhase = 'Production'
}: AddCanonicalStepDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phaseCategory, setPhaseCategory] = useState<PhaseCategory>(defaultPhase);
  const [taskType, setTaskType] = useState<'task' | 'milestone' | 'meeting'>('task');
  const [isOptional, setIsOptional] = useState(false);

  // Sync phase state when defaultPhase prop changes (dialog is reused across phases)
  useEffect(() => {
    setPhaseCategory(defaultPhase);
  }, [defaultPhase]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      description: description.trim(),
      phase_category: phaseCategory,
      task_type: taskType,
      is_optional: isOptional,
    });

    // Reset form
    setName('');
    setDescription('');
    setTaskType('task');
    setIsOptional(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Canonical Step</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Step Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Concept Art Review"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this step..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Phase</Label>
            <Select value={phaseCategory} onValueChange={(v) => setPhaseCategory(v as PhaseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_CATEGORIES.map((phase) => (
                  <SelectItem key={phase} value={phase}>
                    {phase}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={taskType} onValueChange={(v) => setTaskType(v as 'task' | 'milestone' | 'meeting')}>
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

          <div className="flex items-center gap-2">
            <Checkbox
              id="optional"
              checked={isOptional}
              onCheckedChange={(checked) => setIsOptional(checked as boolean)}
            />
            <Label htmlFor="optional" className="text-sm font-normal">
              Optional step (not included by default)
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Add Step
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}