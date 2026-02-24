import { PHASE_WEIGHTS, PhaseCategory, PHASE_CATEGORY_COLORS } from '@/types/database';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RotateCcw, Minus, Plus, ChevronDown, Video, Clock, CalendarClock } from 'lucide-react';
import { PhaseTimelineSlider } from './PhaseTimelineSlider';
import { FeedbackSettings } from './FeedbackConfig';
import { useState } from 'react';

export type PhaseWeightConfig = Record<PhaseCategory, number>;

export type PhaseFeedbackRounds = Record<string, number>;

const WEIGHTABLE_PHASES = ['Pre-Production', 'Production', 'Post-Production', 'Delivery'] as const;

const WEEKDAYS = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
];

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
];

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

interface PhaseWeightsConfigProps {
  weights: PhaseWeightConfig;
  onChange: (weights: PhaseWeightConfig) => void;
  startDate?: Date;
  endDate?: Date;
  phaseFeedbackRounds: PhaseFeedbackRounds;
  onFeedbackRoundsChange: (rounds: PhaseFeedbackRounds) => void;
  feedbackSettings: FeedbackSettings;
  onFeedbackChange: (settings: FeedbackSettings) => void;
  defaultZoomLink?: string;
}

export const DEFAULT_PHASE_WEIGHTS: PhaseWeightConfig = { ...PHASE_WEIGHTS };

export const DEFAULT_PHASE_FEEDBACK_ROUNDS: PhaseFeedbackRounds = {
  'Pre-Production': 1,
  'Production': 2,
  'Post-Production': 1,
  'Delivery': 0,
};

export function PhaseWeightsConfig({
  weights,
  onChange,
  startDate,
  endDate,
  phaseFeedbackRounds,
  onFeedbackRoundsChange,
  feedbackSettings,
  onFeedbackChange,
  defaultZoomLink,
}: PhaseWeightsConfigProps) {
  const [checkinOpen, setCheckinOpen] = useState(false);

  const handleReset = () => {
    onChange({ ...DEFAULT_PHASE_WEIGHTS });
  };

  const handleRoundChange = (phase: string, delta: number) => {
    const current = phaseFeedbackRounds[phase] ?? 0;
    const next = Math.max(0, Math.min(10, current + delta));
    onFeedbackRoundsChange({ ...phaseFeedbackRounds, [phase]: next });
  };

  const updateFeedback = <K extends keyof FeedbackSettings>(key: K, value: FeedbackSettings[K]) => {
    onFeedbackChange({ ...feedbackSettings, [key]: value });
  };

  return (
    <div className="space-y-6">
      {/* Phase Timeline Slider */}
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

      {/* Per-Phase Feedback Rounds */}
      <div className="space-y-3 pt-2 border-t">
        <div className="space-y-1">
          <Label className="text-base font-medium">Client Feedback Rounds</Label>
          <p className="text-sm text-muted-foreground">
            Number of client review cycles per phase (creates alternating work/review segments)
          </p>
        </div>

        <div className="space-y-2">
          {WEIGHTABLE_PHASES.map((phase) => {
            const count = phaseFeedbackRounds[phase] ?? 0;
            const color = PHASE_CATEGORY_COLORS[phase] || '#3B82F6';
            return (
              <div
                key={phase}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium">{phase}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRoundChange(phase, -1)}
                    disabled={count <= 0}
                  >
                    <Minus className="w-3 h-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">
                    {count}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRoundChange(phase, 1)}
                    disabled={count >= 10}
                  >
                    <Plus className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">
          Each feedback round creates a review segment. Work gets ~80% of phase time, reviews ~20%.
        </p>
      </div>

      {/* Collapsible Weekly Check-in Settings */}
      <Collapsible open={checkinOpen} onOpenChange={setCheckinOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full py-3 px-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors border-t">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Weekly Check-in Settings</span>
            </div>
            <div className="flex items-center gap-2">
              {feedbackSettings.checkInEnabled && (
                <span className="text-xs text-muted-foreground">
                  {feedbackSettings.checkInFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} · {feedbackSettings.checkInWeekday}
                </span>
              )}
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${checkinOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable recurring check-ins</Label>
              <p className="text-xs text-muted-foreground">
                Schedule recurring meetings with the client
              </p>
            </div>
            <Switch
              checked={feedbackSettings.checkInEnabled}
              onCheckedChange={(checked) => updateFeedback('checkInEnabled', checked)}
            />
          </div>

          {feedbackSettings.checkInEnabled && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={feedbackSettings.checkInFrequency}
                    onValueChange={(v) => updateFeedback('checkInFrequency', v as 'weekly' | 'biweekly')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={feedbackSettings.checkInWeekday}
                    onValueChange={(v) => updateFeedback('checkInWeekday', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Time
                  </Label>
                  <Input
                    type="time"
                    value={feedbackSettings.checkInTime}
                    onChange={(e) => updateFeedback('checkInTime', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    min={15}
                    max={180}
                    step={15}
                    value={feedbackSettings.checkInDuration}
                    onChange={(e) => updateFeedback('checkInDuration', parseInt(e.target.value) || 30)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select
                    value={feedbackSettings.checkInTimezone}
                    onValueChange={(v) => updateFeedback('checkInTimezone', v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  Zoom Link
                </Label>
                <Input
                  value={feedbackSettings.checkInZoomLink}
                  onChange={(e) => updateFeedback('checkInZoomLink', e.target.value)}
                  placeholder={defaultZoomLink || 'https://zoom.us/j/...'}
                />
                {defaultZoomLink && !feedbackSettings.checkInZoomLink && (
                  <p className="text-xs text-muted-foreground">
                    Will use project default: {defaultZoomLink}
                  </p>
                )}
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
