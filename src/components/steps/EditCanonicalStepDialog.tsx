import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { PHASE_CATEGORIES, PhaseCategory, CanonicalStep } from '@/types/database';

interface EditCanonicalStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: CanonicalStep | null;
  onSave: (stepId: string, updates: {
    name: string;
    description: string | null;
    phase_category: PhaseCategory;
    task_type: 'task' | 'milestone' | 'meeting';
    is_optional: boolean;
  }) => void;
}

export function EditCanonicalStepDialog({
  open,
  onOpenChange,
  step,
  onSave
}: EditCanonicalStepDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [phaseCategory, setPhaseCategory] = useState<PhaseCategory>('Production');
  const [taskType, setTaskType] = useState<'task' | 'milestone' | 'meeting'>('task');
  const [isOptional, setIsOptional] = useState(false);

  useEffect(() => {
    if (step) {
      setName(step.name);
      setDescription(step.description || '');
      setPhaseCategory(step.phase_category as PhaseCategory);
      setTaskType(step.task_type);
      setIsOptional(step.is_optional || false);
    }
  }, [step]);

  const handleSubmit = () => {
    if (!step || !name.trim()) return;

    onSave(step.id, {
      name: name.trim(),
      description: description.trim() || null,
      phase_category: phaseCategory,
      task_type: taskType,
      is_optional: isOptional,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Step</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Step Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              id="edit-optional"
              checked={isOptional}
              onCheckedChange={(checked) => setIsOptional(checked as boolean)}
            />
            <Label htmlFor="edit-optional" className="text-sm font-normal">
              Optional step
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}