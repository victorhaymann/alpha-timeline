import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PHASE_CATEGORIES, PhaseCategory } from '@/types/database';
import { ChevronDown, Settings2 } from 'lucide-react';

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
  const [reviewRounds, setReviewRounds] = useState<string>('');
  const [weightPercent, setWeightPercent] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const customStep: CustomStep = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      phase_category: phase,
      client_visible: clientVisible,
      review_rounds: reviewRounds ? parseInt(reviewRounds) : null,
      weight_percent: weightPercent ? parseFloat(weightPercent) : null,
    };

    onAdd(customStep);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setName('');
    setPhase(defaultPhase);
    setClientVisible(true);
    setReviewRounds('');
    setWeightPercent('');
    setShowAdvanced(false);
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
            <Label htmlFor="review-rounds">Review Rounds Override (optional)</Label>
            <Input
              id="review-rounds"
              type="number"
              min={0}
              max={10}
              value={reviewRounds}
              onChange={(e) => setReviewRounds(e.target.value)}
              placeholder="Leave empty to use project default"
            />
          </div>

          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 w-full justify-start px-0">
                <Settings2 className="w-4 h-4" />
                Advanced Settings
                <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <div className="space-y-2">
                <Label htmlFor="weight-percent">Weight Percent (optional)</Label>
                <Input
                  id="weight-percent"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={weightPercent}
                  onChange={(e) => setWeightPercent(e.target.value)}
                  placeholder="Auto-calculated if empty"
                />
                <p className="text-xs text-muted-foreground">
                  Relative weight for schedule distribution
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
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
