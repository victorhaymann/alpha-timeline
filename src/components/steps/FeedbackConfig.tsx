import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Video, 
  CalendarClock, 
  Flag, 
  RotateCcw,
  ChevronDown,
  Clock,
  Calendar
} from 'lucide-react';
import { useState } from 'react';

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

const DEFAULT_REVIEW_STEPS = [
  'Concept',
  'Styleframes',
  'Lookdev',
  'Animation',
  'Lighting',
  'Compositing',
];

export interface FeedbackSettings {
  // Recurring check-in
  checkInEnabled: boolean;
  checkInFrequency: 'weekly' | 'biweekly';
  checkInWeekday: string;
  checkInTime: string;
  checkInDuration: number; // minutes
  checkInTimezone: string;
  checkInZoomLink: string;

  // Milestone reviews
  milestoneAtPhaseEnd: boolean;
  milestoneAtSelectedSteps: boolean;
  milestoneStepNames: string[];

  // Rework buffer
  reworkBufferEnabled: boolean;
}

interface FeedbackConfigProps {
  settings: FeedbackSettings;
  onChange: (settings: FeedbackSettings) => void;
  defaultZoomLink: string;
  clientTimezone: string;
  availableStepNames: string[];
}

export function FeedbackConfig({
  settings,
  onChange,
  defaultZoomLink,
  clientTimezone,
  availableStepNames,
}: FeedbackConfigProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const updateSetting = <K extends keyof FeedbackSettings>(
    key: K,
    value: FeedbackSettings[K]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  const toggleMilestoneStep = (stepName: string) => {
    const current = settings.milestoneStepNames;
    const updated = current.includes(stepName)
      ? current.filter(s => s !== stepName)
      : [...current, stepName];
    updateSetting('milestoneStepNames', updated);
  };

  return (
    <div className="space-y-6">
      {/* Recurring Client Check-in */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarClock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Recurring Client Check-in</CardTitle>
                <CardDescription className="text-sm">
                  Schedule recurring meetings with the client
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.checkInEnabled}
              onCheckedChange={(checked) => updateSetting('checkInEnabled', checked)}
            />
          </div>
        </CardHeader>
        {settings.checkInEnabled && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={settings.checkInFrequency}
                  onValueChange={(v) => updateSetting('checkInFrequency', v as 'weekly' | 'biweekly')}
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
                  value={settings.checkInWeekday}
                  onValueChange={(v) => updateSetting('checkInWeekday', v)}
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
                  value={settings.checkInTime}
                  onChange={(e) => updateSetting('checkInTime', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Duration (min)</Label>
                <Input
                  type="number"
                  min={15}
                  max={180}
                  step={15}
                  value={settings.checkInDuration}
                  onChange={(e) => updateSetting('checkInDuration', parseInt(e.target.value) || 30)}
                />
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.checkInTimezone}
                  onValueChange={(v) => updateSetting('checkInTimezone', v)}
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
                value={settings.checkInZoomLink}
                onChange={(e) => updateSetting('checkInZoomLink', e.target.value)}
                placeholder={defaultZoomLink || 'https://zoom.us/j/...'}
              />
              {defaultZoomLink && !settings.checkInZoomLink && (
                <p className="text-xs text-muted-foreground">
                  Will use project default: {defaultZoomLink}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Milestone Review Rules */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Flag className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base">Milestone Reviews</CardTitle>
              <CardDescription className="text-sm">
                Configure when milestone review meetings are created
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label>Create milestone at end of each phase</Label>
              <p className="text-xs text-muted-foreground">
                Automatically add a review milestone after each phase completes
              </p>
            </div>
            <Switch
              checked={settings.milestoneAtPhaseEnd}
              onCheckedChange={(checked) => updateSetting('milestoneAtPhaseEnd', checked)}
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Create reviews at end of selected steps</Label>
                <p className="text-xs text-muted-foreground">
                  Add review meetings after specific steps
                </p>
              </div>
              <Switch
                checked={settings.milestoneAtSelectedSteps}
                onCheckedChange={(checked) => updateSetting('milestoneAtSelectedSteps', checked)}
              />
            </div>

            {settings.milestoneAtSelectedSteps && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                {availableStepNames.map(stepName => (
                  <label
                    key={stepName}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={settings.milestoneStepNames.includes(stepName)}
                      onCheckedChange={() => toggleMilestoneStep(stepName)}
                    />
                    <span className="text-sm truncate">{stepName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Generation Behavior */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <RotateCcw className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-base">Rework Buffer</CardTitle>
              <CardDescription className="text-sm">
                Add buffer time after review meetings for revisions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label>Add rework buffer after reviews</Label>
              <p className="text-xs text-muted-foreground">
                The schedule engine will allocate time for revisions after each review
              </p>
            </div>
            <Switch
              checked={settings.reworkBufferEnabled}
              onCheckedChange={(checked) => updateSetting('reworkBufferEnabled', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border/50">
        <Calendar className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How this affects your schedule</p>
          <p>
            These settings tell the schedule engine how to generate meetings (type=meeting), 
            milestones (type=milestone), and optional rework buffers. The actual dates will 
            be calculated when you finalize the project.
          </p>
        </div>
      </div>
    </div>
  );
}

export const DEFAULT_FEEDBACK_SETTINGS: FeedbackSettings = {
  checkInEnabled: true,
  checkInFrequency: 'weekly',
  checkInWeekday: 'wednesday',
  checkInTime: '10:00',
  checkInDuration: 30,
  checkInTimezone: 'UTC',
  checkInZoomLink: '',
  milestoneAtPhaseEnd: true,
  milestoneAtSelectedSteps: true,
  milestoneStepNames: DEFAULT_REVIEW_STEPS,
  reworkBufferEnabled: true,
};
