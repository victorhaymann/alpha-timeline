import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Project, Phase, Task, Dependency, CanonicalStep, ProjectStep, PhaseCategory, TaskSegment } from '@/types/database';
import { PHASE_CATEGORY_COLORS } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimelineEditor } from '@/components/timeline/TimelineEditor';
import { TaskDetailDialog } from '@/components/tasks/TaskDetailDialog';
import { ExportPanel } from '@/components/exports/ExportPanel';
import { DocumentUploader } from '@/components/documents/DocumentUploader';
import { ShareProjectDialog } from '@/components/shares/ShareProjectDialog';
import { ProjectSettingsDialog } from '@/components/projects/ProjectSettingsDialog';
import { ErrorCard } from '@/components/errors/ErrorCard';
import { ErrorBoundary } from '@/components/errors/ErrorBoundary';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Calendar, 
  Settings, 
  Share2,
  BarChart3,
  Loader2,
  Building2,
  Layers,
  Clock,
  Download,
  RefreshCw,
  FileText,
  BookOpen,
  User,
  Users,
  Mail,
  Phone,
  Pencil,
  Folder,
  FileSignature,
  Undo2,
  CalendarRange,
} from 'lucide-react';
import { RightsPanel } from '@/components/rights/RightsPanel';
import { exportTimelinePDF } from '@/components/exports/exportTimelinePDF';
import tnfLogoPurple from '@/assets/tnf-logo-purple.png';
import { ClientDocumentsPanel, ClientDocument as ClientDocType } from '@/components/documents/ClientDocumentsPanel';
import { ResourceLinksPanel, ResourceLink } from '@/components/documents/ResourceLinksPanel';
import { LearningResourcesPanel } from '@/components/resources/LearningResourcesPanel';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { useToast } from '@/hooks/use-toast';

interface ProjectStepWithCanonical extends ProjectStep {
  canonical_step: CanonicalStep;
}

interface ProjectDocument {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [segments, setSegments] = useState<TaskSegment[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [projectSteps, setProjectSteps] = useState<ProjectStepWithCanonical[]>([]);
  const [quotations, setQuotations] = useState<ProjectDocument[]>([]);
  const [invoices, setInvoices] = useState<ProjectDocument[]>([]);
  const [clientDocuments, setClientDocuments] = useState<ClientDocType[]>([]);
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Hidden meeting dates for client view
  const [hiddenMeetingDates, setHiddenMeetingDates] = useState<Set<string>>(new Set());
  
  // Task detail dialog state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskPhase, setSelectedTaskPhase] = useState<Phase | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  
  // PM Edit dialog state
  const [pmDialogOpen, setPmDialogOpen] = useState(false);
  const [pmForm, setPmForm] = useState({ name: '', email: '', whatsapp: '' });
  const [pmSaving, setPmSaving] = useState(false);
  const { toast } = useToast();
  
  // Regenerate state (lifted from TimelineEditor)
  const [regenerateHandler, setRegenerateHandler] = useState<{ onClick: () => void; isLoading: boolean } | null>(null);
  const [actionHandlers, setActionHandlers] = useState<{
    onUndo: () => void;
    undoDisabled: boolean;
    isUndoing: boolean;
    undoCount: number;
    onShiftTimeline: () => void;
  } | null>(null);

  const fetchProjectData = useCallback(async () => {
    if (!id) return;
    
    try {
      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData as Project);

      // Fetch phases
      const { data: phasesData } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', id)
        .order('order_index');

      setPhases((phasesData as Phase[]) || []);

      // Fetch tasks for all phases
      let tasksData: Task[] = [];
      if (phasesData && phasesData.length > 0) {
        const phaseIds = phasesData.map(p => p.id);
        const { data } = await supabase
          .from('tasks')
          .select('*')
          .in('phase_id', phaseIds)
          .order('order_index');

        // Filter out tasks with unreasonable dates to prevent chart crashes
        const rawTasks = (data as Task[]) || [];
        tasksData = rawTasks.filter(task => {
          const startYear = new Date(task.start_date).getFullYear();
          const endYear = new Date(task.end_date).getFullYear();
          if (startYear > 2125 || endYear > 2125 || startYear < 1950 || endYear < 1950) {
            console.warn(`Task "${task.name}" has unreasonable dates and will be skipped:`, {
              start_date: task.start_date,
              end_date: task.end_date,
            });
            return false;
          }
          return true;
        });
        setTasks(tasksData);
      }

      // Fetch dependencies for all tasks
      if (tasksData.length > 0) {
        const taskIds = tasksData.map(t => t.id);
        const { data: depsData } = await supabase
          .from('dependencies')
          .select('*')
          .or(`predecessor_task_id.in.(${taskIds.join(',')}),successor_task_id.in.(${taskIds.join(',')})`);

        setDependencies((depsData as Dependency[]) || []);

        // Fetch task segments
        const { data: segmentsData } = await supabase
          .from('task_segments')
          .select('*')
          .in('task_id', taskIds)
          .order('order_index');

        setSegments((segmentsData as TaskSegment[]) || []);
      }

      // Fetch project steps with canonical step data
      const { data: stepsData } = await supabase
        .from('project_steps')
        .select(`
          *,
          canonical_step:canonical_steps(*)
        `)
        .eq('project_id', id)
        .eq('is_included', true);

      if (stepsData) {
        setProjectSteps(stepsData as unknown as ProjectStepWithCanonical[]);
      }
    } catch (error: any) {
      console.error('Error fetching project:', error);
      setLoadError(error?.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;

    const [quotationsRes, invoicesRes, clientDocsRes, resourceLinksRes] = await Promise.all([
      supabase.from('quotations').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      (supabase as any).from('client_documents').select('*').eq('project_id', id).order('category').order('created_at', { ascending: false }),
      (supabase as any).from('project_resource_links').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ]);

    setQuotations((quotationsRes.data as ProjectDocument[]) || []);
    setInvoices((invoicesRes.data as ProjectDocument[]) || []);
    setClientDocuments((clientDocsRes.data as ClientDocType[]) || []);
    setResourceLinks((resourceLinksRes.data as ResourceLink[]) || []);
  }, [id]);

  const fetchHiddenMeetings = useCallback(async () => {
    if (!id) return;
    
    const { data } = await supabase
      .from('meeting_notes')
      .select('meeting_date')
      .eq('project_id', id)
      .eq('client_hidden', true);
    
    setHiddenMeetingDates(new Set((data || []).map(m => m.meeting_date)));
  }, [id]);

  const handleToggleMeetingVisibility = useCallback(async (dateStr: string, hidden: boolean) => {
    if (!id) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('meeting_notes')
      .upsert({
        project_id: id,
        meeting_date: dateStr,
        client_hidden: hidden,
        created_by: user.id,
      }, { onConflict: 'project_id,meeting_date' });

    if (error) {
      console.error('Error toggling meeting visibility:', error);
      toast({
        title: 'Error',
        description: 'Failed to update meeting visibility.',
        variant: 'destructive',
      });
      return;
    }

    // Update local state
    setHiddenMeetingDates(prev => {
      const next = new Set(prev);
      if (hidden) {
        next.add(dateStr);
      } else {
        next.delete(dateStr);
      }
      return next;
    });

    toast({
      title: hidden ? 'Hidden from clients' : 'Visible to clients',
      description: hidden 
        ? 'This meeting will not appear in shared views.' 
        : 'This meeting is now visible in shared views.',
    });
  }, [id, toast]);

  const hasTriggeredConfetti = useRef(false);

  useEffect(() => {
    fetchProjectData();
    fetchDocuments();
    fetchHiddenMeetings();
  }, [fetchProjectData, fetchDocuments, fetchHiddenMeetings]);

  // Trigger confetti when project is completed
  useEffect(() => {
    if (project?.status === 'completed' && !hasTriggeredConfetti.current) {
      hasTriggeredConfetti.current = true;
      const duration = 3000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#10b981', '#22c55e', '#4ade80', '#86efac']
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#10b981', '#22c55e', '#4ade80', '#86efac']
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [project?.status]);

  const handleTasksChange = (updatedTasks: Task[]) => {
    setTasks(updatedTasks);
  };

  const handleTaskClick = (task: Task) => {
    const phase = phases.find(p => p.id === task.phase_id) || null;
    setSelectedTask(task);
    setSelectedTaskPhase(phase);
    setTaskDetailOpen(true);
  };

  const openPmDialog = () => {
    setPmForm({
      name: project?.pm_name || '',
      email: project?.pm_email || '',
      whatsapp: project?.pm_whatsapp || '',
    });
    setPmDialogOpen(true);
  };

  const savePmDetails = async () => {
    if (!id) return;
    
    setPmSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          pm_name: pmForm.name.trim() || null,
          pm_email: pmForm.email.trim() || null,
          pm_whatsapp: pmForm.whatsapp.trim() || null,
        })
        .eq('id', id);

      if (error) throw error;

      setProject(prev => prev ? {
        ...prev,
        pm_name: pmForm.name.trim() || null,
        pm_email: pmForm.email.trim() || null,
        pm_whatsapp: pmForm.whatsapp.trim() || null,
      } : null);

      toast({
        title: 'Project Manager updated',
        description: 'Contact details have been saved.',
      });
      setPmDialogOpen(false);
    } catch (error) {
      console.error('Error updating PM details:', error);
      toast({
        title: 'Error',
        description: 'Failed to update Project Manager details.',
        variant: 'destructive',
      });
    } finally {
      setPmSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <ErrorCard
        title="Project not found"
        message={loadError || "The project could not be loaded. It may have been deleted or you don't have access."}
        onRetry={() => {
          setLoading(true);
          setLoadError(null);
          fetchProjectData();
        }}
      />
    );
  }

  const totalDays = differenceInDays(new Date(project.end_date), new Date(project.start_date));
  const daysElapsed = differenceInDays(new Date(), new Date(project.start_date));
  const progress = Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100));

  // Group project steps by phase category
  const stepsByPhase = projectSteps.reduce((acc, ps) => {
    const category = ps.canonical_step.phase_category;
    if (!acc[category]) acc[category] = [];
    acc[category].push(ps);
    return acc;
  }, {} as Record<string, ProjectStepWithCanonical[]>);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/projects')}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge
              variant="outline"
              className={cn(
                'cursor-pointer select-none transition-colors',
                project.status === 'active' && 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25',
                project.status === 'draft' && 'bg-amber-500/15 text-amber-600 border-amber-500/30',
                project.status === 'completed' && 'bg-sky-500/15 text-sky-600 border-sky-500/30 hover:bg-sky-500/25'
              )}
              onClick={async () => {
                if (project.status === 'draft') return; // Only toggle between active <-> completed
                const newStatus = project.status === 'active' ? 'completed' : 'active';
                const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', project.id);
                if (error) {
                  toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
                  return;
                }
                setProject(prev => prev ? { ...prev, status: newStatus } as Project : null);
                toast({
                  title: newStatus === 'completed' ? '🎉 Project delivered!' : 'Back in production',
                  description: newStatus === 'completed' ? 'Project marked as delivered.' : 'Project is back in production.',
                });
              }}
            >
              {project.status === 'active' ? 'In Production' : project.status === 'completed' ? 'Delivered' : 'Draft'}
            </Badge>
          </div>
          <div className="flex items-center gap-4 ml-11 text-sm text-muted-foreground">
            {project.client_name && (
              <span className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                {project.client_name}
              </span>
            )}
            {project.description && (
              <span>{project.description}</span>
            )}
          </div>
        </div>

        {/* Client Logo - Centered */}
        {project.client_logo_url && (
          <div className="absolute left-1/2 -translate-x-1/2 top-0">
            <img
              src={project.client_logo_url}
              alt="Client logo"
              className="h-9 w-auto object-contain"
            />
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportTimelinePDF(project, phases, tasks, segments, window.location.origin + tnfLogoPurple)}
          >
            <CalendarRange className="w-4 h-4" />
            Timeline PDF
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setSettingsDialogOpen(true)}
          >
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-[1fr_1fr_1.5fr]">
        <Card className="h-[88px]">
          <CardContent className="h-full flex items-center pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Delivery Date</p>
                <p className="text-lg font-semibold">{format(new Date(project.end_date), 'MMM d, yyyy')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="h-[88px]">
          <CardContent className="h-full flex items-center pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-review/10">
                <Clock className="w-5 h-5 text-status-review" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Buffer</p>
                <p className="text-lg font-semibold">{project.buffer_percentage}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card 
          className="h-[88px] cursor-pointer hover:shadow-md transition-shadow group"
          onClick={openPmDialog}
        >
          <CardContent className="h-full flex items-center pt-5 pb-4">
            <div className="flex items-center gap-3 w-full min-w-0">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 flex items-center justify-between">
                <div className="shrink-0">
                  <p className="text-sm text-muted-foreground">Project Manager</p>
                  <p className="text-sm font-semibold">{project.pm_name || <span className="italic font-normal text-muted-foreground">Not assigned</span>}</p>
                </div>
                {project.pm_name && (
                  <div className="flex flex-col gap-0.5 min-w-0">
                    {project.pm_email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                        <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate">{project.pm_email}</span>
                      </div>
                    )}
                    {project.pm_whatsapp && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{project.pm_whatsapp}</span>
                      </div>
                    )}
                  </div>
                )}
                <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Resources
            </TabsTrigger>
            <TabsTrigger value="client-documents" className="gap-1.5">
              <Folder className="w-3.5 h-3.5" />
              Client Documents
            </TabsTrigger>
            <TabsTrigger value="rights" className="gap-1.5">
              <FileSignature className="w-3.5 h-3.5" />
              Rights
            </TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2">
            {actionHandlers && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actionHandlers.onUndo}
                  disabled={actionHandlers.undoDisabled}
                  className="gap-2"
                  title={actionHandlers.undoCount > 0 ? `Undo (${actionHandlers.undoCount} changes)` : 'No changes to undo'}
                >
                  {actionHandlers.isUndoing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Undo2 className="w-4 h-4" />
                  )}
                  Undo
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={actionHandlers.onShiftTimeline}
                  className="gap-2"
                  title="Shift all tasks forward or backward"
                >
                  <CalendarRange className="w-4 h-4" />
                  Shift Timeline
                </Button>
              </>
            )}
            {regenerateHandler && (
              <Button
                variant="outline"
                size="sm"
                onClick={regenerateHandler.onClick}
                disabled={regenerateHandler.isLoading}
                className="gap-2"
              >
                {regenerateHandler.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Regenerate Schedule
              </Button>
            )}
          </div>
        </div>

        <TabsContent value="timeline" className="space-y-4">
          <ErrorBoundary
            fallback={
              <ErrorCard
                title="Unable to load timeline"
                message="An error occurred while rendering the project timeline. Please try refreshing."
                showHomeButton={false}
                onRetry={() => window.location.reload()}
              />
            }
          >
            <TimelineEditor
              project={project}
              phases={phases}
              tasks={tasks}
              dependencies={dependencies}
              segments={segments}
              onTasksChange={handleTasksChange}
              onSegmentsChange={setSegments}
              onRefresh={fetchProjectData}
              onTaskClick={handleTaskClick}
              hiddenMeetingDates={hiddenMeetingDates}
              onToggleMeetingVisibility={handleToggleMeetingVisibility}
              renderRegenerateButton={(props) => {
                // Store the handler props to render in the tabs row
                if (!regenerateHandler || regenerateHandler.isLoading !== props.isLoading) {
                  setTimeout(() => setRegenerateHandler(props), 0);
                }
                return null; // Don't render anything here
              }}
              renderActionButtons={(props) => {
                if (
                  !actionHandlers ||
                  actionHandlers.undoDisabled !== props.undoDisabled ||
                  actionHandlers.isUndoing !== props.isUndoing ||
                  actionHandlers.undoCount !== props.undoCount
                ) {
                  setTimeout(() => setActionHandlers(props), 0);
                }
                return null;
              }}
            />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <ResourceLinksPanel
            projectId={id!}
            resourceLinks={resourceLinks}
            readOnly={false}
            onRefresh={fetchDocuments}
          />
          
          <LearningResourcesPanel readOnly={false} />
        </TabsContent>

        <TabsContent value="client-documents">
          <ClientDocumentsPanel
            projectId={id!}
            documents={clientDocuments}
            readOnly={false}
            onRefresh={fetchDocuments}
            quotations={quotations}
            invoices={invoices}
            onQuotationsRefresh={fetchDocuments}
            showQuotationsInvoices={true}
          />
        </TabsContent>

        <TabsContent value="rights">
          <RightsPanel
            projectId={id!}
            project={project}
            readOnly={false}
          />
        </TabsContent>
      </Tabs>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        phase={selectedTaskPhase}
        open={taskDetailOpen}
        onOpenChange={setTaskDetailOpen}
        onUpdate={fetchProjectData}
      />

      {/* Share Dialog */}
      <ShareProjectDialog
        projectId={id!}
        projectName={project.name}
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
      />

      {/* PM Edit Dialog */}
      <Dialog open={pmDialogOpen} onOpenChange={setPmDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project Manager</DialogTitle>
            <DialogDescription>
              Update the project manager contact details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Name</Label>
              <Input
                id="pm-name"
                placeholder="John Smith"
                value={pmForm.name}
                onChange={(e) => setPmForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-email">Email</Label>
              <Input
                id="pm-email"
                type="email"
                placeholder="john@example.com"
                value={pmForm.email}
                onChange={(e) => setPmForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pm-whatsapp">WhatsApp</Label>
              <Input
                id="pm-whatsapp"
                placeholder="+1 234 567 8900"
                value={pmForm.whatsapp}
                onChange={(e) => setPmForm(prev => ({ ...prev, whatsapp: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPmDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePmDetails} disabled={pmSaving}>
              {pmSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Settings Dialog */}
      <ProjectSettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
        projectId={project.id}
        projectName={project.name}
        projectEndDate={project.end_date}
        clientLogoUrl={project.client_logo_url || null}
        onSave={(updates) => {
          setProject(prev => prev ? {
            ...prev,
            name: updates.name,
            end_date: updates.end_date,
            client_logo_url: updates.client_logo_url,
          } : null);
        }}
      />
    </div>
  );
}
