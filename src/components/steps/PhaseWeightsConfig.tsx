import { PHASE_WEIGHTS, PhaseCategory } from '@/types/database';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import { PhaseTimelineSlider } from './PhaseTimelineSlider';

export type PhaseWeightConfig = Record<PhaseCategory, number>;

interface PhaseWeightsConfigProps {
  weights: PhaseWeightConfig;
  onChange: (weights: PhaseWeightConfig) => void;
  startDate?: Date;
  endDate?: Date;
}

export const DEFAULT_PHASE_WEIGHTS: PhaseWeightConfig = { ...PHASE_WEIGHTS };

export function PhaseWeightsConfig({ weights, onChange, startDate, endDate }: PhaseWeightsConfigProps) {
  const handleReset = () => {
    onChange({ ...DEFAULT_PHASE_WEIGHTS });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">Phase Time Allocation</Label>
          <p className="text-sm text-muted-foreground">
            Drag the dividers to adjust phase durations
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </Button>
      </div>

      <PhaseTimelineSlider 
        weights={weights} 
        onChange={onChange}
        startDate={startDate}
        endDate={endDate}
      />

      {/* Non-weightable phases info */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p><span className="font-medium">Client Check-ins:</span> Scheduled separately based on feedback settings</p>
        <p><span className="font-medium">Immersive:</span> Add-on phase, allocated separately when enabled</p>
      </div>
    </div>
  );
}
