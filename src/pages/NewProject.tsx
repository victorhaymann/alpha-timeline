import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CanonicalStep } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { StepLibrary } from '@/components/steps/StepLibrary';
import { 
  Loader2, 
  ArrowLeft, 
  ArrowRight,
  Calendar, 
  Percent,
  Building2,
  Globe,
  Settings2,
  Layers
} from 'lucide-react';
import { format, addMonths } from 'date-fns';

type WizardStep = 'details' | 'steps' | 'settings';

export default function NewProject() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('details');
  const [canonicalSteps, setCanonicalSteps] = useState<CanonicalStep[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<Set<string>>(new Set());
  
  const today = new Date();
  const defaultEndDate = addMonths(today, 3);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_name: '',
    start_date: format(today, 'yyyy-MM-dd'),
    end_date: format(defaultEndDate, 'yyyy-MM-dd'),
    buffer_percentage: 10,
    default_review_rounds: 2,
    timezone_pm: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_client: 'UTC',
    zoom_link_default: '',
  });

  useEffect(() => {
    fetchCanonicalSteps();
  }, []);

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
      setCurrentStep('details');
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast({
        title: 'Validation error',
        description: 'End date must be after start date.',
        variant: 'destructive',
      });
      setCurrentStep('details');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Create project
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: formData.name,
          description: formData.description || null,
          client_name: formData.client_name || null,
          start_date: formData.start_date,
          end_date: formData.end_date,
          buffer_percentage: formData.buffer_percentage,
          default_review_rounds: formData.default_review_rounds,
          timezone_pm: formData.timezone_pm,
          timezone_client: formData.timezone_client,
          zoom_link_default: formData.zoom_link_default || null,
          owner_id: user.id,
          status: 'draft',
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // Create project_steps for selected canonical steps
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

      toast({
        title: 'Project created!',
        description: `${formData.name} has been created with ${selectedStepIds.size} steps.`,
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
    { key: 'details', label: 'Project Details', icon: <Building2 className="w-4 h-4" /> },
    { key: 'steps', label: 'Select Steps', icon: <Layers className="w-4 h-4" /> },
    { key: 'settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" /> },
  ];

  const currentStepIndex = wizardSteps.findIndex(s => s.key === currentStep);
  const canGoNext = currentStep !== 'settings';
  const canGoBack = currentStep !== 'details';

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
            {currentStep === 'details' && 'Project Details'}
            {currentStep === 'steps' && 'Select Steps'}
            {currentStep === 'settings' && 'Project Settings'}
          </CardTitle>
          <CardDescription>
            {currentStep === 'details' && 'Basic information about your VFX project'}
            {currentStep === 'steps' && 'Choose which steps to include from the library'}
            {currentStep === 'settings' && 'Configure timezones, buffers, and defaults'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Details Step */}
          {currentStep === 'details' && (
            <div className="space-y-6">
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

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the project scope..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

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
            </div>
          )}

          {/* Steps Selection */}
          {currentStep === 'steps' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Select the steps to include in this project</span>
                <span className="font-medium text-foreground">
                  {selectedStepIds.size} steps selected
                </span>
              </div>
              <StepLibrary 
                selectedSteps={selectedStepIds}
                onStepToggle={handleStepToggle}
              />
            </div>
          )}

          {/* Settings Step */}
          {currentStep === 'settings' && (
            <div className="space-y-6">
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
                    max={50}
                    value={formData.buffer_percentage}
                    onChange={(e) => setFormData({ ...formData, buffer_percentage: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Reserved time for unexpected changes
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="review_rounds">Default Review Rounds</Label>
                  <Input
                    id="review_rounds"
                    type="number"
                    min={0}
                    max={10}
                    value={formData.default_review_rounds}
                    onChange={(e) => setFormData({ ...formData, default_review_rounds: parseInt(e.target.value) || 0 })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default review cycles per task
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone_pm" className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Your Timezone
                  </Label>
                  <Input
                    id="timezone_pm"
                    value={formData.timezone_pm}
                    onChange={(e) => setFormData({ ...formData, timezone_pm: e.target.value })}
                    placeholder="e.g., America/New_York"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timezone_client" className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    Client Timezone
                  </Label>
                  <Input
                    id="timezone_client"
                    value={formData.timezone_client}
                    onChange={(e) => setFormData({ ...formData, timezone_client: e.target.value })}
                    placeholder="e.g., Europe/London"
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="zoom_link">Default Meeting Link</Label>
                  <Input
                    id="zoom_link"
                    value={formData.zoom_link_default}
                    onChange={(e) => setFormData({ ...formData, zoom_link_default: e.target.value })}
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              </div>
            </div>
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
