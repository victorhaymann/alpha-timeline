import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Phase, Task, Dependency } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  Building2,
  Loader2,
  BarChart3,
  FileText,
  Download,
  BookOpen,
  Layers,
  Users,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { GanttChart } from '@/components/timeline/GanttChart';

interface ProjectDocument {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

export default function ClientProjectView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [quotations, setQuotations] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id || !user) return;

    try {
      // Check if user has client access to this project
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*, client_id')
        .eq('id', id)
        .single();

      if (projectError) throw projectError;

      // Verify user is a client user for this project's client
      if (projectData.client_id) {
        const { data: clientUser } = await supabase
          .from('client_users')
          .select('id')
          .eq('client_id', projectData.client_id)
          .eq('user_id', user.id)
          .single();

        if (!clientUser) {
          setHasAccess(false);
          setLoading(false);
          return;
        }
      } else {
        setHasAccess(false);
        setLoading(false);
        return;
      }

      setHasAccess(true);
      setProject(projectData as Project);

      // Fetch phases
      const { data: phasesData } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', id)
        .order('order_index');

      setPhases((phasesData as Phase[]) || []);

      // Fetch tasks
      if (phasesData && phasesData.length > 0) {
        const phaseIds = phasesData.map((p) => p.id);
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .in('phase_id', phaseIds)
          .order('order_index');

        const tasksResult = (tasksData as Task[]) || [];
        setTasks(tasksResult);

        // Fetch dependencies
        if (tasksResult.length > 0) {
          const taskIds = tasksResult.map((t) => t.id);
          const { data: depsData } = await supabase
            .from('dependencies')
            .select('*')
            .or(
              `predecessor_task_id.in.(${taskIds.join(',')}),successor_task_id.in.(${taskIds.join(',')})`
            );

          setDependencies((depsData as Dependency[]) || []);
        }
      }

      // Fetch quotations
      const { data: quotationsData } = await supabase
        .from('quotations')
        .select('*')
        .eq('project_id', id)
        .order('created_at', { ascending: false });

      setQuotations((quotationsData as ProjectDocument[]) || []);
    } catch (error) {
      console.error('Error fetching project:', error);
      navigate('/portal');
    } finally {
      setLoading(false);
    }
  }, [id, user, navigate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess || !project) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-destructive" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-6">
              You don't have access to view this project.
            </p>
            <Button onClick={() => navigate('/portal')}>Back to Portal</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalDays = differenceInDays(new Date(project.end_date), new Date(project.start_date));
  const daysElapsed = differenceInDays(new Date(), new Date(project.start_date));
  const progress = Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/portal')}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge
              variant="outline"
              className={cn(
                project.status === 'active' &&
                  'bg-status-in-progress/20 text-status-in-progress border-status-in-progress/30',
                project.status === 'draft' &&
                  'bg-status-pending/20 text-status-pending border-status-pending/30',
                project.status === 'completed' &&
                  'bg-status-completed/20 text-status-completed border-status-completed/30'
              )}
            >
              {project.status}
            </Badge>
          </div>
          {project.description && (
            <p className="text-muted-foreground ml-11">{project.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
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
              <div className="p-2 rounded-lg bg-phase-delivery/10">
                <FileText className="w-5 h-5 text-phase-delivery" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Quotations</p>
                <p className="text-lg font-semibold">{quotations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between text-sm mb-2">
            <span>{format(new Date(project.start_date), 'MMM d, yyyy')}</span>
            <span>{format(new Date(project.end_date), 'MMM d, yyyy')}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                progress < 50 && 'bg-destructive',
                progress >= 50 && progress < 90 && 'bg-orange-500',
                progress >= 90 && 'bg-status-completed'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-6">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="documents" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Quotations & Invoices
          </TabsTrigger>
          <TabsTrigger value="resources" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Resources
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <GanttChart
            projectId={project.id}
            projectStartDate={new Date(project.start_date)}
            projectEndDate={new Date(project.end_date)}
            phases={phases}
            tasks={tasks}
            workingDaysMask={project.working_days_mask || 31}
            checkinTime={project.checkin_time}
            checkinDuration={project.checkin_duration}
            checkinTimezone={project.checkin_timezone}
            onTaskUpdate={() => {}}
            onTaskReorder={() => {}}
            onAddTask={() => {}}
            onAddReviewRound={() => {}}
            readOnly={true}
          />
        </TabsContent>

        <TabsContent value="documents">
          <ReadOnlyDocuments documents={quotations} />
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
                <div className="block p-4 rounded-lg border border-border bg-muted/30">
                  <BookOpen className="w-8 h-8 text-muted-foreground mb-3" />
                  <h4 className="font-semibold mb-1 text-muted-foreground">Getting Started Guide</h4>
                  <p className="text-sm text-muted-foreground">Learn the basics of timeline management and project setup.</p>
                  <Badge variant="outline" className="mt-3 text-xs">Coming Soon</Badge>
                </div>
                <div className="block p-4 rounded-lg border border-border bg-muted/30">
                  <Layers className="w-8 h-8 text-muted-foreground mb-3" />
                  <h4 className="font-semibold mb-1 text-muted-foreground">Phase Management</h4>
                  <p className="text-sm text-muted-foreground">Understanding phase weights and task distribution.</p>
                  <Badge variant="outline" className="mt-3 text-xs">Coming Soon</Badge>
                </div>
                <div className="block p-4 rounded-lg border border-border bg-muted/30">
                  <Users className="w-8 h-8 text-muted-foreground mb-3" />
                  <h4 className="font-semibold mb-1 text-muted-foreground">Client Collaboration</h4>
                  <p className="text-sm text-muted-foreground">Share projects and manage client feedback effectively.</p>
                  <Badge variant="outline" className="mt-3 text-xs">Coming Soon</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Read-only document viewer for client portal
function ReadOnlyDocuments({ documents }: { documents: ProjectDocument[] }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const handlePreview = async (doc: ProjectDocument) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);

    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error('Preview error:', error);
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };

  if (documents.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No Quotations</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            No quotations have been uploaded for this project yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {documents.map((doc) => (
          <Card
            key={doc.id}
            className="hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => handlePreview(doc)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <FileText className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(doc.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <Badge variant="outline">Click to view</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* PDF Preview Dialog */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-background border rounded-lg shadow-lg w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="font-semibold truncate pr-4">{previewDoc.name}</h3>
              <Button variant="ghost" size="sm" onClick={closePreview}>
                Close
              </Button>
            </div>
            <div className="flex-1 min-h-0">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : previewUrl ? (
                <iframe src={previewUrl} className="w-full h-full border-0" title={previewDoc.name} />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </>
  );
}