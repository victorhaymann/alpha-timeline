import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PHASE_CATEGORIES, PhaseCategory } from '@/types/database';

export interface CustomStep {
  id: string;
  name: string;
  phase_category: PhaseCategory;
  client_visible: boolean;
  review_rounds: number | null;
  weight_percent: number | null;
}

interface AddCustomStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (step: CustomStep) => void;
  defaultPhase?: PhaseCategory;
}

export function AddCustomStepDialog({ 
  open, 
  onOpenChange, 
  onAdd,
  defaultPhase = 'Production'
}: AddCustomStepDialogProps) {
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<PhaseCategory>(defaultPhase);
  const [clientVisible, setClientVisible] = useState(true);
  const [relativeWeight, setRelativeWeight] = useState<'low' | 'medium' | 'high'>('medium');

  // Sync phase state when defaultPhase prop changes (dialog is reused across phases)
  useEffect(() => {
    setPhase(defaultPhase);
  }, [defaultPhase]);

  const WEIGHT_MAP = { low: 5, medium: 10, high: 15 };

  const handleSubmit = () => {
    if (!name.trim()) return;

    const customStep: CustomStep = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      phase_category: phase,
      client_visible: clientVisible,
      review_rounds: null,
      weight_percent: WEIGHT_MAP[relativeWeight],
    };

    onAdd(customStep);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName('');
    setPhase(defaultPhase);
    setClientVisible(true);
    setRelativeWeight('medium');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Custom Step</DialogTitle>
          <DialogDescription>
            Create a custom step for your project timeline
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="step-name">Step Title *</Label>
            <Input
              id="step-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Client Review Session"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="step-phase">Phase</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v as PhaseCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_CATEGORIES.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="client-visible">Client Visible</Label>
              <p className="text-xs text-muted-foreground">
                Show this step in the client view
              </p>
            </div>
            <Switch
              id="client-visible"
              checked={clientVisible}
              onCheckedChange={setClientVisible}
            />
          </div>

          <div className="space-y-2">
            <Label>Relative Effort</Label>
            <p className="text-xs text-muted-foreground mb-2">
              How much time should this step take relative to others?
            </p>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((weight) => (
                <Button
                  key={weight}
                  type="button"
                  variant={relativeWeight === weight ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 capitalize"
                  onClick={() => setRelativeWeight(weight)}
                >
                  {weight}
                </Button>
              ))}
            </div>
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
