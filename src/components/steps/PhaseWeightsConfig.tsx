import { PHASE_CATEGORIES, PHASE_CATEGORY_COLORS, PHASE_WEIGHTS, PhaseCategory } from '@/types/database';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phases that can be weighted (exclude check-ins and immersive add-on)
const WEIGHTABLE_PHASES: PhaseCategory[] = ['Pre-Production', 'Production', 'Post-Production', 'Delivery'];

export type PhaseWeightConfig = Record<PhaseCategory, number>;

interface PhaseWeightsConfigProps {
  weights: PhaseWeightConfig;
  onChange: (weights: PhaseWeightConfig) => void;
}

export const DEFAULT_PHASE_WEIGHTS: PhaseWeightConfig = { ...PHASE_WEIGHTS };

export function PhaseWeightsConfig({ weights, onChange }: PhaseWeightsConfigProps) {
  const totalWeight = WEIGHTABLE_PHASES.reduce((sum, phase) => sum + weights[phase], 0);
  const isValid = totalWeight === 100;

  const handleWeightChange = (phase: PhaseCategory, value: number) => {
    onChange({
      ...weights,
      [phase]: value,
    });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_PHASE_WEIGHTS });
  };

  // Auto-balance: adjust other phases proportionally to make total 100
  const handleAutoBalance = () => {
    if (totalWeight === 0) {
      // If all are 0, reset to defaults
      handleReset();
      return;
    }

    const factor = 100 / totalWeight;
    const newWeights = { ...weights };
    let remaining = 100;
    
    // Scale each phase proportionally
    WEIGHTABLE_PHASES.forEach((phase, index) => {
      if (index === WEIGHTABLE_PHASES.length - 1) {
        // Last phase gets the remainder to ensure exact 100
        newWeights[phase] = remaining;
      } else {
        const scaled = Math.round(weights[phase] * factor);
        newWeights[phase] = scaled;
        remaining -= scaled;
      }
    });

    onChange(newWeights);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-base font-medium">Phase Time Allocation</Label>
          <p className="text-sm text-muted-foreground">
            Distribute project time across phases (must total 100%)
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!isValid && (
            <Button variant="outline" size="sm" onClick={handleAutoBalance} className="gap-1.5">
              Auto-balance
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </Button>
        </div>
      </div>

      {/* Total indicator */}
      <div className={cn(
        "flex items-center gap-2 p-3 rounded-lg transition-colors",
        isValid ? "bg-green-500/10 border border-green-500/20" : "bg-amber-500/10 border border-amber-500/20"
      )}>
        {isValid ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-amber-500" />
        )}
        <span className={cn(
          "text-sm font-medium",
          isValid ? "text-green-500" : "text-amber-500"
        )}>
          Total: {totalWeight}%
        </span>
        {!isValid && (
          <span className="text-sm text-muted-foreground">
            ({totalWeight < 100 ? `${100 - totalWeight}% remaining` : `${totalWeight - 100}% over`})
          </span>
        )}
      </div>

      {/* Visual bar representation */}
      <div className="h-4 rounded-full overflow-hidden flex bg-muted">
        {WEIGHTABLE_PHASES.map((phase) => {
          const weight = weights[phase];
          if (weight === 0) return null;
          return (
            <div
              key={phase}
              className="h-full transition-all duration-300"
              style={{ 
                width: `${weight}%`,
                backgroundColor: PHASE_CATEGORY_COLORS[phase],
              }}
              title={`${phase}: ${weight}%`}
            />
          );
        })}
      </div>

      {/* Individual phase sliders */}
      <div className="space-y-4">
        {WEIGHTABLE_PHASES.map((phase) => {
          const color = PHASE_CATEGORY_COLORS[phase];
          return (
            <div key={phase} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">{phase}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className="tabular-nums"
                  style={{ borderColor: color, color }}
                >
                  {weights[phase]}%
                </Badge>
              </div>
              <Slider
                value={[weights[phase]]}
                onValueChange={([value]) => handleWeightChange(phase, value)}
                min={0}
                max={100}
                step={1}
                className="cursor-pointer"
              />
            </div>
          );
        })}
      </div>

      {/* Non-weightable phases info */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
        <p><span className="font-medium">Client Check-ins:</span> Scheduled separately based on feedback settings</p>
        <p><span className="font-medium">Immersive:</span> Add-on phase, allocated separately when enabled</p>
      </div>
    </div>
  );
}
