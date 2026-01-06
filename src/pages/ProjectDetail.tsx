import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Project, Phase, Task, Dependency, CanonicalStep, ProjectStep, PhaseCategory } from '@/types/database';
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
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

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
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [projectSteps, setProjectSteps] = useState<ProjectStepWithCanonical[]>([]);
  const [quotations, setQuotations] = useState<ProjectDocument[]>([]);
  const [invoices, setInvoices] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Task detail dialog state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskPhase, setSelectedTaskPhase] = useState<Phase | null>(null);
  const [taskDetailOpen, setTaskDetailOpen] = useState(false);
  
  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  
  // Regenerate state (lifted from TimelineEditor)
  const [regenerateHandler, setRegenerateHandler] = useState<{ onClick: () => void; isLoading: boolean } | null>(null);

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

        tasksData = (data as Task[]) || [];
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
    } catch (error) {
      console.error('Error fetching project:', error);
      navigate('/projects');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchDocuments = useCallback(async () => {
    if (!id) return;

    const [quotationsRes, invoicesRes] = await Promise.all([
      supabase.from('quotations').select('*').eq('project_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('project_id', id).order('created_at', { ascending: false }),
    ]);

    setQuotations((quotationsRes.data as ProjectDocument[]) || []);
    setInvoices((invoicesRes.data as ProjectDocument[]) || []);
  }, [id]);

  const hasTriggeredConfetti = useRef(false);

  useEffect(() => {
    fetchProjectData();
    fetchDocuments();
  }, [fetchProjectData, fetchDocuments]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return null;
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
      <div className="flex items-start justify-between gap-4">
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
            <Badge variant="outline" className={cn(
              project.status === 'active' && 'bg-status-in-progress/20 text-status-in-progress border-status-in-progress/30',
              project.status === 'draft' && 'bg-status-pending/20 text-status-pending border-status-pending/30',
              project.status === 'completed' && 'bg-status-completed/20 text-status-completed border-status-completed/30'
            )}>
              {project.status}
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
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={() => setShareDialogOpen(true)}
          >
            <Share2 className="w-4 h-4" />
            Share
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Project Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="text-lg font-semibold">{totalDays} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-phase-production/10">
                <BarChart3 className="w-5 h-5 text-phase-production" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Progress</p>
                <p className="text-lg font-semibold">{Math.round(progress)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-phase-preproduction/10">
                <Layers className="w-5 h-5 text-phase-preproduction" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Steps</p>
                <p className="text-lg font-semibold">{projectSteps.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-sm text-muted-foreground">Project Manager</p>
                {project.pm_name ? (
                  <>
                    <p className="text-sm font-semibold truncate">{project.pm_name}</p>
                    {project.pm_email && (
                      <a 
                        href={`mailto:${project.pm_email}`}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{project.pm_email}</span>
                      </a>
                    )}
                    {project.pm_whatsapp && (
                      <a 
                        href={`https://wa.me/${project.pm_whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{project.pm_whatsapp}</span>
                      </a>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not assigned</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline Progress */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>{format(new Date(project.start_date), 'MMM d, yyyy')}</span>
            <span>{format(new Date(project.end_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-500",
                progress < 50 && "bg-destructive",
                progress >= 50 && progress < 90 && "bg-orange-500",
                progress >= 90 && "bg-status-completed"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="exports" className="gap-1.5">
              <Download className="w-3.5 h-3.5" />
              Exports
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Documents
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Resources
            </TabsTrigger>
          </TabsList>
          
          {regenerateHandler && (
            <Button
              variant="outline"
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

        <TabsContent value="timeline" className="space-y-4">
          <TimelineEditor
            project={project}
            phases={phases}
            tasks={tasks}
            dependencies={dependencies}
            onTasksChange={handleTasksChange}
            onRefresh={fetchProjectData}
            onTaskClick={handleTaskClick}
            renderRegenerateButton={(props) => {
              // Store the handler props to render in the tabs row
              if (!regenerateHandler || regenerateHandler.isLoading !== props.isLoading) {
                setTimeout(() => setRegenerateHandler(props), 0);
              }
              return null; // Don't render anything here
            }}
          />
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Export Timeline</CardTitle>
              <CardDescription>
                Download your timeline in various formats for sharing and archiving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ExportPanel 
                project={project}
                phases={phases}
                tasks={tasks}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-lg font-semibold mb-4">Quotations</h3>
              <DocumentUploader
                projectId={id!}
                type="quotations"
                documents={quotations}
                onUploadComplete={fetchDocuments}
              />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Invoices</h3>
              <DocumentUploader
                projectId={id!}
                type="invoices"
                documents={invoices}
                onUploadComplete={fetchDocuments}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Learning Resources</CardTitle>
              <CardDescription>
                Helpful guides and materials to support your project workflow.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <a 
                  href="https://docs.lovable.dev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <BookOpen className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold mb-1">Getting Started Guide</h4>
                  <p className="text-sm text-muted-foreground">Learn the basics of timeline management and project setup.</p>
                </a>
                <a 
                  href="https://docs.lovable.dev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <Layers className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold mb-1">Phase Management</h4>
                  <p className="text-sm text-muted-foreground">Understanding phase weights and task distribution.</p>
                </a>
                <a 
                  href="https://docs.lovable.dev" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <Users className="w-8 h-8 text-primary mb-3" />
                  <h4 className="font-semibold mb-1">Client Collaboration</h4>
                  <p className="text-sm text-muted-foreground">Share projects and manage client feedback effectively.</p>
                </a>
              </div>
            </CardContent>
          </Card>
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
    </div>
  );
}
