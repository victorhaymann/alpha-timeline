import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CanonicalStep, PHASE_CATEGORIES, PhaseCategory } from '@/types/database';
import { CustomStep } from '@/components/steps/AddCustomStepDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { StepLibrary } from '@/components/steps/StepLibrary';
import { DependencyEditor, LocalDependency } from '@/components/steps/DependencyEditor';
import { FeedbackConfig, FeedbackSettings, DEFAULT_FEEDBACK_SETTINGS } from '@/components/steps/FeedbackConfig';
import { PhaseWeightsConfig, PhaseWeightConfig, DEFAULT_PHASE_WEIGHTS } from '@/components/steps/PhaseWeightsConfig';
import { computeSchedule, ScheduleTask, ScheduleDependency } from '@/lib/scheduleEngine';
import { 
  Loader2, 
  ArrowLeft, 
  ArrowRight,
  Calendar, 
  Percent,
  Building2,
  Globe,
  Layers,
  Video,
  CalendarDays,
  RotateCcw,
  Link2,
  MessageSquare,
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

type WizardStep = 'basics' | 'phases' | 'steps' | 'feedback' | 'dependencies';

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('basics');
  const [canonicalSteps, setCanonicalSteps] = useState<CanonicalStep[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  const [customSteps, setCustomSteps] = useState<CustomStep[]>([]);
  const [dependencies, setDependencies] = useState<LocalDependency[]>([]);
  const [feedbackSettings, setFeedbackSettings] = useState<FeedbackSettings>(DEFAULT_FEEDBACK_SETTINGS);
  const [phaseWeights, setPhaseWeights] = useState<PhaseWeightConfig>({ ...DEFAULT_PHASE_WEIGHTS });
  
  const today = new Date();
  const defaultEndDate = addMonths(today, 3);
  
  const [formData, setFormData] = useState({
    name: '',
    client_name: '',
    start_date: format(today, 'yyyy-MM-dd'),
    end_date: format(defaultEndDate, 'yyyy-MM-dd'),
    timezone_pm: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_client: 'UTC',
    working_days_mask: 31, // Mon-Fri enabled (1+2+4+8+16), Sat/Sun disabled
    default_review_rounds: 2,
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

  useEffect(() => {
    fetchCanonicalSteps();
  }, []);

  // Sync check-in timezone with client timezone by default
  useEffect(() => {
    if (formData.timezone_client && feedbackSettings.checkInTimezone === 'UTC') {
      setFeedbackSettings(prev => ({
        ...prev,
        checkInTimezone: formData.timezone_client,
      }));
    }
  }, [formData.timezone_client]);

  const fetchCanonicalSteps = async () => {
    const { data, error } = await supabase
      .from('canonical_steps')
      .select('*')
      .order('sort_order');

    if (!error && data) {
      setCanonicalSteps(data as CanonicalStep[]);
      // Pre-select non-optional steps
      const defaultSelected = new Set(
        (data as CanonicalStep[])
          .filter(s => !s.is_optional)
          .map(s => s.id)
      );
      setSelectedStepIds(defaultSelected);
    }
  };

  const handleStepToggle = (stepId: string, included: boolean) => {
    setSelectedStepIds(prev => {
      const next = new Set(prev);
      if (included) {
        next.add(stepId);
      } else {
        next.delete(stepId);
      }
      return next;
    });
  };

  const handleUpdateCustomStep = (stepId: string, updates: Partial<CustomStep>) => {
    setCustomSteps(prev => prev.map(s => 
      s.id === stepId ? { ...s, ...updates } : s
    ));
  };

  const handleAddCustomStep = (step: CustomStep) => {
    setCustomSteps(prev => [...prev, step]);
  };

  const handleRemoveCustomStep = (stepId: string) => {
    setCustomSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create a project.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: 'Validation error',
        description: 'Project name is required.',
        variant: 'destructive',
      });
      setCurrentStep('basics');
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast({
        title: 'Validation error',
        description: 'End date must be after start date.',
        variant: 'destructive',
      });
      setCurrentStep('basics');
      return;
    }

    // Validate phase weights sum to 100%
    const weightablePhases = ['Pre-Production', 'Production', 'Post-Production', 'Delivery'] as const;
    const totalWeight = weightablePhases.reduce((sum, phase) => sum + (phaseWeights[phase] || 0), 0);
    if (totalWeight !== 100) {
      toast({
        title: 'Validation error',
        description: `Phase weights must sum to 100% (currently ${totalWeight}%).`,
        variant: 'destructive',
      });
      setCurrentStep('phases');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // 1. Prepare schedule input from selected steps
      const selectedCanonical = canonicalSteps.filter(s => selectedStepIds.has(s.id));
      
      const scheduleTasks: ScheduleTask[] = [
        // Canonical steps
        ...selectedCanonical.map(step => ({
          _stepId: step.id,
          name: step.name,
          phaseCategory: step.phase_category as PhaseCategory,
          taskType: step.task_type as 'task' | 'milestone' | 'meeting',
          weightPercent: step.default_weight_percent || 0,
          reviewRounds: step.default_review_rounds || formData.default_review_rounds,
          clientVisible: true,
        })),
        // Custom steps
        ...customSteps.map(step => ({
          _stepId: step.id,
          name: step.name,
          phaseCategory: step.phase_category as PhaseCategory,
          taskType: 'task' as const,
          weightPercent: step.weight_percent || 0,
          reviewRounds: step.review_rounds ?? formData.default_review_rounds,
          clientVisible: step.client_visible,
        })),
      ];

      const scheduleDependencies: ScheduleDependency[] = dependencies.map(dep => ({
        predecessorId: dep.predecessorId,
        successorId: dep.successorId,
      }));

      // 2. Run the schedule engine
      const scheduleOutput = computeSchedule({
        projectStartDate: parse(formData.start_date, 'yyyy-MM-dd', new Date()),
        projectEndDate: parse(formData.end_date, 'yyyy-MM-dd', new Date()),
        workingDaysMask: formData.working_days_mask,
        bufferPercentage: formData.buffer_percentage,
        tasks: scheduleTasks,
        dependencies: scheduleDependencies,
        feedbackSettings,
        phaseWeightOverrides: phaseWeights,
      });

      // Log warnings if any
      if (scheduleOutput.warnings.length > 0) {
        console.warn('Schedule warnings:', scheduleOutput.warnings);
      }

      // 3. Create project with check-in settings
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
          default_review_rounds: formData.default_review_rounds,
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

      // 4. Create project_steps for selected canonical steps
      if (selectedStepIds.size > 0) {
        const projectSteps = Array.from(selectedStepIds).map(stepId => ({
          project_id: project.id,
          canonical_step_id: stepId,
          is_included: true,
        }));

        const { error: stepsError } = await supabase
          .from('project_steps')
          .insert(projectSteps);

        if (stepsError) throw stepsError;
      }

      // 5. Determine all phases needed (including generated tasks)
      const allPhasesUsed = new Set<string>();
      scheduleOutput.scheduledTasks.forEach(task => {
        allPhasesUsed.add(task.phaseCategory);
      });

      const phaseRecords: { project_id: string; name: string; order_index: number }[] = [];
      PHASE_CATEGORIES.forEach((category, index) => {
        if (allPhasesUsed.has(category)) {
          phaseRecords.push({
            project_id: project.id,
            name: category,
            order_index: index,
          });
        }
      });

      let createdPhases: { id: string; name: string }[] = [];
      if (phaseRecords.length > 0) {
        const { data: phases, error: phasesError } = await supabase
          .from('phases')
          .insert(phaseRecords)
          .select('id, name');

        if (phasesError) throw phasesError;
        createdPhases = phases || [];
      }

      const phaseMap = new Map(createdPhases.map(p => [p.name, p.id]));

      // 6. Create tasks with scheduled dates
      const tasksToCreate: {
        project_id: string;
        phase_id: string;
        name: string;
        task_type: 'task' | 'milestone' | 'meeting';
        client_visible: boolean;
        weight_percent: number;
        review_rounds: number;
        order_index: number;
        start_date: string;
        end_date: string;
        _stepId?: string;
      }[] = [];

      let orderIndex = 0;
      scheduleOutput.scheduledTasks.forEach(scheduledTask => {
        const phaseId = phaseMap.get(scheduledTask.phaseCategory);
        if (phaseId) {
          tasksToCreate.push({
            project_id: project.id,
            phase_id: phaseId,
            name: scheduledTask.name,
            task_type: scheduledTask.taskType,
            client_visible: scheduledTask.clientVisible,
            weight_percent: scheduledTask.weightPercent,
            review_rounds: scheduledTask.reviewRounds,
            order_index: orderIndex++,
            start_date: format(scheduledTask.startDate, 'yyyy-MM-dd'),
            end_date: format(scheduledTask.endDate, 'yyyy-MM-dd'),
            _stepId: scheduledTask._stepId,
          });
        }
      });

      // Map step IDs to their index for dependency creation
      const stepIdToIndex = new Map<string, number>();
      tasksToCreate.forEach((task, idx) => {
        if (task._stepId) {
          stepIdToIndex.set(task._stepId, idx);
        }
      });

      // Remove temporary _stepId before inserting
      const tasksForInsert = tasksToCreate.map(({ _stepId, ...task }) => task);

      let createdTasks: { id: string }[] = [];
      if (tasksForInsert.length > 0) {
        const { data: insertedTasks, error: tasksError } = await supabase
          .from('tasks')
          .insert(tasksForInsert)
          .select('id');

        if (tasksError) throw tasksError;
        createdTasks = insertedTasks || [];
      }

      // 7. Create dependencies (original + generated from schedule engine)
      // Map step IDs to task IDs
      const stepIdToTaskId = new Map<string, string>();
      tasksToCreate.forEach((task, idx) => {
        if (task._stepId && createdTasks[idx]) {
          stepIdToTaskId.set(task._stepId, createdTasks[idx].id);
        }
      });

      // Include both original user dependencies and generated dependencies
      const allDependencies = [...dependencies];
      
      // Add dependencies for generated tasks (reviews depend on their parent, buffers depend on reviews)
      scheduleOutput.scheduledTasks.forEach(task => {
        if (task.isGenerated) {
          if (task.generatedType === 'step-review') {
            const parentStepId = task._stepId.replace('review-', '');
            if (stepIdToTaskId.has(parentStepId)) {
              allDependencies.push({
                id: `gen-${task._stepId}`,
                predecessorId: parentStepId,
                successorId: task._stepId,
              });
            }
          } else if (task.generatedType === 'rework-buffer') {
            const reviewId = task._stepId.replace('buffer-', '');
            if (stepIdToTaskId.has(reviewId)) {
              allDependencies.push({
                id: `gen-${task._stepId}`,
                predecessorId: reviewId,
                successorId: task._stepId,
              });
            }
          }
        }
      });

      const dependenciesToCreate = allDependencies
        .map(dep => ({
          predecessor_task_id: stepIdToTaskId.get(dep.predecessorId),
          successor_task_id: stepIdToTaskId.get(dep.successorId),
        }))
        .filter(dep => dep.predecessor_task_id && dep.successor_task_id) as {
          predecessor_task_id: string;
          successor_task_id: string;
        }[];

      if (dependenciesToCreate.length > 0) {
        const { error: depsError } = await supabase
          .from('dependencies')
          .insert(dependenciesToCreate);

        if (depsError) throw depsError;
      }

      const totalTasks = scheduleOutput.scheduledTasks.length;
      const generatedTasks = scheduleOutput.scheduledTasks.filter(t => t.isGenerated).length;

      toast({
        title: 'Project created!',
        description: `${formData.name} created with ${totalTasks} tasks (${generatedTasks} auto-generated). Schedule spans ${scheduleOutput.totalWorkingDays} working days with ${scheduleOutput.bufferDays} buffer days.`,
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
    { key: 'phases', label: 'Phase Weights', icon: <Clock className="w-4 h-4" /> },
    { key: 'steps', label: 'Select Steps', icon: <Layers className="w-4 h-4" /> },
    { key: 'feedback', label: 'Feedback', icon: <MessageSquare className="w-4 h-4" /> },
    { key: 'dependencies', label: 'Dependencies', icon: <Link2 className="w-4 h-4" /> },
  ];

  const currentStepIndex = wizardSteps.findIndex(s => s.key === currentStep);
  const canGoNext = currentStep !== 'dependencies';
  const canGoBack = currentStep !== 'basics';

  // Get available step names for milestone selection
  const availableStepNames = [
    ...canonicalSteps.filter(s => selectedStepIds.has(s.id)).map(s => s.name),
    ...customSteps.map(s => s.name),
  ];

  const handleAddDependency = (predecessorId: string, successorId: string) => {
    setDependencies(prev => [
      ...prev,
      {
        id: `dep-${Date.now()}`,
        predecessorId,
        successorId,
      }
    ]);
  };

  const handleRemoveDependency = (dependencyId: string) => {
    setDependencies(prev => prev.filter(d => d.id !== dependencyId));
  };

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
            {currentStep === 'phases' && 'Phase Time Allocation'}
            {currentStep === 'steps' && 'Select Steps'}
            {currentStep === 'feedback' && 'Feedback Configuration'}
            {currentStep === 'dependencies' && 'Task Dependencies'}
          </CardTitle>
          <CardDescription>
            {currentStep === 'basics' && 'Define your VFX project details and settings'}
            {currentStep === 'phases' && 'Configure how project time is distributed across phases'}
            {currentStep === 'steps' && 'Choose which steps to include from the library'}
            {currentStep === 'feedback' && 'Configure client check-ins, milestone reviews, and rework buffers'}
            {currentStep === 'dependencies' && 'Define which tasks must complete before others can start'}
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

              {/* Settings Row */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="review_rounds" className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                    Default Review Rounds
                  </Label>
                  <Input
                    id="review_rounds"
                    type="number"
                    min={0}
                    max={10}
                    value={formData.default_review_rounds}
                    onChange={(e) => setFormData({ ...formData, default_review_rounds: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default review cycles per task (default: 2)
                  </p>
                </div>

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
              </div>

              {/* Gmeet Link */}
              <div className="space-y-2">
                <Label htmlFor="gmeet_link" className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-muted-foreground" />
                  Default Google Meet Link (optional)
                </Label>
                <Input
                  id="gmeet_link"
                  value={formData.gmeet_link}
                  onChange={(e) => setFormData({ ...formData, gmeet_link: e.target.value })}
                  placeholder="https://meet.google.com/..."
                />
              </div>
            </div>
          )}

          {/* Phase Weights Configuration */}
          {currentStep === 'phases' && (
            <PhaseWeightsConfig
              weights={phaseWeights}
              onChange={setPhaseWeights}
              startDate={formData.start_date ? new Date(formData.start_date) : undefined}
              endDate={formData.end_date ? new Date(formData.end_date) : undefined}
            />
          )}

          {/* Steps Selection */}
          {currentStep === 'steps' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Select the steps to include in this project</span>
                <span className="font-medium text-foreground">
                  {selectedStepIds.size + customSteps.length} steps selected
                  {customSteps.length > 0 && (
                    <span className="text-primary ml-1">
                      ({customSteps.length} custom)
                    </span>
                  )}
                </span>
              </div>
              <StepLibrary 
                selectedSteps={selectedStepIds}
                onStepToggle={handleStepToggle}
                customSteps={customSteps}
                onAddCustomStep={handleAddCustomStep}
                onRemoveCustomStep={handleRemoveCustomStep}
                onUpdateCustomStep={handleUpdateCustomStep}
              />
            </div>
          )}

          {/* Feedback Configuration Step */}
          {currentStep === 'feedback' && (
            <FeedbackConfig
              settings={feedbackSettings}
              onChange={setFeedbackSettings}
              defaultZoomLink={formData.gmeet_link}
              clientTimezone={formData.timezone_client}
              availableStepNames={availableStepNames}
            />
          )}

          {/* Dependencies Step */}
          {currentStep === 'dependencies' && (
            <DependencyEditor
              canonicalSteps={canonicalSteps}
              selectedStepIds={selectedStepIds}
              customSteps={customSteps}
              dependencies={dependencies}
              onAddDependency={handleAddDependency}
              onRemoveDependency={handleRemoveDependency}
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
