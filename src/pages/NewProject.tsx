import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PHASE_CATEGORIES, PhaseCategory, PHASE_CATEGORY_COLORS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FeedbackSettings, DEFAULT_FEEDBACK_SETTINGS } from '@/components/steps/FeedbackConfig';
import { PhaseWeightsConfig, PhaseWeightConfig, DEFAULT_PHASE_WEIGHTS, PhaseFeedbackRounds, DEFAULT_PHASE_FEEDBACK_ROUNDS } from '@/components/steps/PhaseWeightsConfig';
import { addWorkingDays, countWorkingDays, convertLegacyMaskToLibFormat, nextWorkingDay } from '@/lib/workingDays';
import { 
  Loader2, 
  ArrowLeft, 
  ArrowRight,
  Calendar, 
  Percent,
  Building2,
  Globe,
  Video,
  CalendarDays,
  Clock
} from 'lucide-react';
import { format, addMonths, parse } from 'date-fns';

const WEEKDAYS = [
  { key: 0, label: 'Mon', bit: 1 },
  { key: 1, label: 'Tue', bit: 2 },
  { key: 2, label: 'Wed', bit: 4 },
  { key: 3, label: 'Thu', bit: 8 },
  { key: 4, label: 'Fri', bit: 16 },
  { key: 5, label: 'Sat', bit: 32 },
  { key: 6, label: 'Sun', bit: 64 },
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

type WizardStep = 'basics' | 'phases';

const WEIGHTABLE_PHASES = ['Pre-Production', 'Production', 'Post-Production', 'Delivery'] as const;

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
  const [feedbackSettings, setFeedbackSettings] = useState<FeedbackSettings>(DEFAULT_FEEDBACK_SETTINGS);
  const [phaseWeights, setPhaseWeights] = useState<PhaseWeightConfig>({ ...DEFAULT_PHASE_WEIGHTS });
  const [phaseFeedbackRounds, setPhaseFeedbackRounds] = useState<PhaseFeedbackRounds>({ ...DEFAULT_PHASE_FEEDBACK_ROUNDS });
  
  const today = new Date();
  const defaultEndDate = addMonths(today, 3);
  
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    start_date: format(today, 'yyyy-MM-dd'),
    end_date: format(defaultEndDate, 'yyyy-MM-dd'),
    timezone_pm: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_client: 'UTC',
    working_days_mask: 31, // Mon-Fri
    buffer_percentage: 12,
    gmeet_link: '',
  });

  const toggleWorkingDay = (bit: number) => {
    setFormData(prev => ({
      ...prev,
      working_days_mask: prev.working_days_mask ^ bit,
    }));
  };

  const isDayEnabled = (bit: number) => (formData.working_days_mask & bit) !== 0;

  // Sync check-in timezone with client timezone by default
  useEffect(() => {
    if (formData.timezone_client && feedbackSettings.checkInTimezone === 'UTC') {
      setFeedbackSettings(prev => ({
        ...prev,
        checkInTimezone: formData.timezone_client,
      }));
    }
  }, [formData.timezone_client]);

  const handleSubmit = async () => {
    if (!user) {
      toast({ title: 'Error', description: 'You must be logged in to create a project.', variant: 'destructive' });
      return;
    }

    if (!formData.name.trim()) {
      toast({ title: 'Validation error', description: 'Project name is required.', variant: 'destructive' });
      setCurrentStep('basics');
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast({ title: 'Validation error', description: 'End date must be after start date.', variant: 'destructive' });
      setCurrentStep('basics');
      return;
    }

    const totalWeight = WEIGHTABLE_PHASES.reduce((sum, phase) => sum + (phaseWeights[phase] || 0), 0);
    if (totalWeight !== 100) {
      toast({ title: 'Validation error', description: `Phase weights must sum to 100% (currently ${totalWeight}%).`, variant: 'destructive' });
      setCurrentStep('phases');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const libMask = convertLegacyMaskToLibFormat(formData.working_days_mask);
      const projectStart = parse(formData.start_date, 'yyyy-MM-dd', new Date());
      const projectEnd = parse(formData.end_date, 'yyyy-MM-dd', new Date());
      const totalWorkingDays = countWorkingDays(projectStart, projectEnd, libMask);
      const bufferDays = Math.floor(totalWorkingDays * formData.buffer_percentage / 100);
      const availableDays = totalWorkingDays - bufferDays;

      // 1. Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          client_name: formData.client_name || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          timezone_pm: formData.timezone_pm,
          timezone_client: formData.timezone_client,
          working_days_mask: formData.working_days_mask,
          default_review_rounds: 0,
          buffer_percentage: formData.buffer_percentage,
          zoom_link_default: formData.gmeet_link || null,
          checkin_time: feedbackSettings.checkInEnabled ? feedbackSettings.checkInTime : null,
          checkin_duration: feedbackSettings.checkInEnabled ? feedbackSettings.checkInDuration : null,
          checkin_timezone: feedbackSettings.checkInEnabled ? feedbackSettings.checkInTimezone : null,
          checkin_frequency: feedbackSettings.checkInEnabled ? feedbackSettings.checkInFrequency : null,
          checkin_weekday: feedbackSettings.checkInEnabled ? feedbackSettings.checkInWeekday : null,
          owner_id: user.id,
          status: 'draft',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Create 4 phases
      const phaseRecords = WEIGHTABLE_PHASES.map((name, index) => ({
        project_id: project.id,
        name,
        order_index: index,
        percentage_allocation: phaseWeights[name] || 0,
        color: PHASE_CATEGORY_COLORS[name] || '#3B82F6',
      }));

      const { data: createdPhases, error: phasesError } = await supabase
        .from('phases')
        .insert(phaseRecords)
        .select('id, name');

      if (phasesError) throw phasesError;

      const phaseMap = new Map((createdPhases || []).map(p => [p.name, p.id]));

      // 3. Compute dates and create tasks + segments
      let cursor = nextWorkingDay(projectStart, libMask);
      const tasksToCreate: {
        project_id: string;
        phase_id: string;
        name: string;
        task_type: 'task';
        client_visible: boolean;
        weight_percent: number;
        review_rounds: number;
        order_index: number;
        start_date: string;
        end_date: string;
      }[] = [];

      // Store segment info per task index
      const segmentPlans: { taskIndex: number; segments: { start: Date; end: Date; type: 'work' | 'review'; order: number }[] }[] = [];

      WEIGHTABLE_PHASES.forEach((phase, idx) => {
        const phaseId = phaseMap.get(phase);
        if (!phaseId) return;

        const weight = phaseWeights[phase] || 0;
        const phaseDays = Math.max(1, Math.round(availableDays * weight / 100));
        const phaseStart = cursor;
        const phaseEnd = addWorkingDays(phaseStart, phaseDays - 1, libMask);

        tasksToCreate.push({
          project_id: project.id,
          phase_id: phaseId,
          name: phase,
          task_type: 'task',
          client_visible: true,
          weight_percent: weight,
          review_rounds: phaseFeedbackRounds[phase] ?? 0,
          order_index: idx,
          start_date: format(phaseStart, 'yyyy-MM-dd'),
          end_date: format(phaseEnd, 'yyyy-MM-dd'),
        });

        // Plan segments
        const N = phaseFeedbackRounds[phase] ?? 0;
        if (N > 0) {
          const workCount = N + 1;
          const reviewCount = N;
          const reviewTotalDays = Math.max(reviewCount, Math.round(phaseDays * 0.2));
          const workTotalDays = Math.max(workCount, phaseDays - reviewTotalDays);

          const workDaysEach = Math.floor(workTotalDays / workCount);
          const reviewDaysEach = Math.floor(reviewTotalDays / reviewCount);

          const segments: { start: Date; end: Date; type: 'work' | 'review'; order: number }[] = [];
          let segCursor = phaseStart;
          let orderIdx = 0;

          for (let i = 0; i < workCount; i++) {
            // Work segment
            const isLast = i === workCount - 1;
            const wDays = isLast
              ? (i < reviewCount ? workDaysEach : Math.max(1, phaseDays - (workDaysEach * (workCount - 1)) - (reviewDaysEach * reviewCount)))
              : workDaysEach;
            const segEnd = addWorkingDays(segCursor, Math.max(1, wDays) - 1, libMask);
            segments.push({ start: segCursor, end: segEnd, type: 'work', order: orderIdx++ });
            segCursor = addWorkingDays(segEnd, 1, libMask);

            // Review segment (if not the last work segment)
            if (i < reviewCount) {
              const rDays = reviewDaysEach;
              const rEnd = addWorkingDays(segCursor, Math.max(1, rDays) - 1, libMask);
              segments.push({ start: segCursor, end: rEnd, type: 'review', order: orderIdx++ });
              segCursor = addWorkingDays(rEnd, 1, libMask);
            }
          }

          segmentPlans.push({ taskIndex: tasksToCreate.length - 1, segments });
        }

        // Advance cursor past this phase
        cursor = addWorkingDays(phaseEnd, 1, libMask);
      });

      // Insert tasks
      const { data: createdTasks, error: tasksError } = await supabase
        .from('tasks')
        .insert(tasksToCreate)
        .select('id');

      if (tasksError) throw tasksError;

      // 4. Create segments
      const segmentsToCreate: {
        task_id: string;
        start_date: string;
        end_date: string;
        segment_type: string;
        order_index: number;
      }[] = [];

      segmentPlans.forEach(({ taskIndex, segments }) => {
        const taskId = createdTasks?.[taskIndex]?.id;
        if (!taskId) return;
        segments.forEach(seg => {
          segmentsToCreate.push({
            task_id: taskId,
            start_date: format(seg.start, 'yyyy-MM-dd'),
            end_date: format(seg.end, 'yyyy-MM-dd'),
            segment_type: seg.type,
            order_index: seg.order,
          });
        });
      });

      if (segmentsToCreate.length > 0) {
        const { error: segmentsError } = await supabase
          .from('task_segments')
          .insert(segmentsToCreate);

        if (segmentsError) {
          console.warn('Failed to create segments:', segmentsError);
        }
      }

      // 5. Create check-in phase + task if enabled
      if (feedbackSettings.checkInEnabled) {
        const { data: checkinPhase } = await supabase
          .from('phases')
          .insert({
            project_id: project.id,
            name: 'Client Check-ins',
            order_index: -1,
            percentage_allocation: 0,
            color: PHASE_CATEGORY_COLORS['Client Check-ins'] || '#9CA3AF',
            collapsed_by_default: true,
          })
          .select('id')
          .single();

        if (checkinPhase) {
          await supabase.from('tasks').insert({
            project_id: project.id,
            phase_id: checkinPhase.id,
            name: `${feedbackSettings.checkInFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly'} Client Call`,
            task_type: 'meeting',
            client_visible: true,
            weight_percent: 0,
            review_rounds: 0,
            order_index: 0,
            start_date: formData.start_date,
            end_date: formData.end_date,
            is_feedback_meeting: true,
          });
        }
      }

      toast({
        title: 'Project created!',
        description: `${formData.name} created with ${WEIGHTABLE_PHASES.length} phases and ${segmentsToCreate.length} segments.`,
      });

      navigate(`/projects/${project.id}`);
    } catch (error: any) {
      console.error('Error creating project:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create project.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const wizardSteps: { key: WizardStep; label: string; icon: React.ReactNode }[] = [
    { key: 'basics', label: 'Basics', icon: <Building2 className="w-4 h-4" /> },
    { key: 'phases', label: 'Phases & Check-ins', icon: <Clock className="w-4 h-4" /> },
  ];

  const currentStepIndex = wizardSteps.findIndex(s => s.key === currentStep);
  const canGoNext = currentStep !== 'phases';
  const canGoBack = currentStep !== 'basics';

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Back button */}
      <Button
        variant="ghost"
        onClick={() => navigate('/projects')}
        className="gap-2 -ml-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Projects
      </Button>

      {/* Wizard Progress */}
      <div className="flex items-center justify-between mb-8">
        {wizardSteps.map((step, index) => (
          <div key={step.key} className="flex items-center flex-1">
            <button
              onClick={() => setCurrentStep(step.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === step.key 
                  ? 'bg-primary text-primary-foreground' 
                  : index < currentStepIndex
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {step.icon}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {index < wizardSteps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 ${
                index < currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`} />
            )}
          </div>
        ))}
      </div>

      <Card className="glass-surface">
        <CardHeader>
          <CardTitle className="text-2xl">
            {currentStep === 'basics' && 'Project Basics'}
            {currentStep === 'phases' && 'Phases, Feedbacks & Check-ins'}
          </CardTitle>
          <CardDescription>
            {currentStep === 'basics' && 'Define your project details and settings'}
            {currentStep === 'phases' && 'Configure phase durations, feedback rounds, and client check-ins'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Basics Step */}
          {currentStep === 'basics' && (
            <div className="space-y-8">
              {/* Project Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Project Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Marvel VFX Sequence 42"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="text-lg"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="client_name">Client Name</Label>
                  <Input
                    id="client_name"
                    placeholder="e.g., Marvel Studios"
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Start Date *
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    End Date *
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Timezones */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone_pm" className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    PM Timezone
                  </Label>
                  <Select 
                    value={formData.timezone_pm} 
                    onValueChange={(value) => setFormData({ ...formData, timezone_pm: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone_client" className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Client Timezone
                  </Label>
                  <Select 
                    value={formData.timezone_client} 
                    onValueChange={(value) => setFormData({ ...formData, timezone_client: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Working Days */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  Working Days
                </Label>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => toggleWorkingDay(day.bit)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isDayEnabled(day.bit)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select the days when work is scheduled
                </p>
              </div>

              {/* Buffer */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="buffer" className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    Buffer Percentage
                  </Label>
                  <Input
                    id="buffer"
                    type="number"
                    min={0}
                    max={20}
                    value={formData.buffer_percentage}
                    onChange={(e) => {
                      const val = Math.min(20, Math.max(0, parseInt(e.target.value) || 0));
                      setFormData({ ...formData, buffer_percentage: val });
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Reserved buffer time (0-20%, default: 12%)
                  </p>
                </div>

                {/* Gmeet Link */}
                <div className="space-y-2">
                  <Label htmlFor="gmeet_link" className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-muted-foreground" />
                    Default Meet Link (optional)
                  </Label>
                  <Input
                    id="gmeet_link"
                    value={formData.gmeet_link}
                    onChange={(e) => setFormData({ ...formData, gmeet_link: e.target.value })}
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Phase Weights + Feedback Rounds + Check-in Settings */}
          {currentStep === 'phases' && (
            <PhaseWeightsConfig
              weights={phaseWeights}
              onChange={setPhaseWeights}
              startDate={formData.start_date ? new Date(formData.start_date) : undefined}
              endDate={formData.end_date ? new Date(formData.end_date) : undefined}
              phaseFeedbackRounds={phaseFeedbackRounds}
              onFeedbackRoundsChange={setPhaseFeedbackRounds}
              feedbackSettings={feedbackSettings}
              onFeedbackChange={setFeedbackSettings}
              defaultZoomLink={formData.gmeet_link}
            />
          )}

          {/* Navigation */}
          <div className="flex gap-4 pt-8 border-t mt-8">
            {canGoBack && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(wizardSteps[currentStepIndex - 1].key)}
                className="gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            )}
            <div className="flex-1" />
            {canGoNext ? (
              <Button
                onClick={() => setCurrentStep(wizardSteps[currentStepIndex + 1].key)}
                className="gap-2"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Project'
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
