import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Phase, Task, Dependency } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GanttChart } from '@/components/timeline/GanttChart';
import { 
  Calendar, 
  Loader2, 
  Building2,
  BarChart3,
  FileText,
  Download,
  Eye,
  Lock,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface ProjectShare {
  id: string;
  project_id: string;
  share_type: 'public' | 'invite';
  is_active: boolean;
}

interface ProjectDocument {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

export default function SharedProjectView() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [share, setShare] = useState<ProjectShare | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<Dependency[]>([]);
  const [quotations, setQuotations] = useState<ProjectDocument[]>([]);
  const [invoices, setInvoices] = useState<ProjectDocument[]>([]);
  
  // PDF Preview state
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!token) return;

    try {
      // Fetch the share by token
      const { data: shareData, error: shareError } = await supabase
        .from('project_shares')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (shareError || !shareData) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      const shareInfo = shareData as ProjectShare;
      setShare(shareInfo);

      // If it's invite-only, check if user is logged in and invited
      if (shareInfo.share_type === 'invite') {
        if (!user) {
          // Wait for auth to finish loading
          if (authLoading) return;
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        // Check if user's email is in the invite list
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .single();

        if (!profile) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        const { data: inviteData } = await supabase
          .from('share_invites')
          .select('id')
          .eq('share_id', shareInfo.id)
          .eq('email', profile.email)
          .single();

        if (!inviteData) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }
      }

      // Fetch project data
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', shareInfo.project_id)
        .single();

      if (projectError || !projectData) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setProject(projectData as Project);

      // Fetch phases
      const { data: phasesData } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', shareInfo.project_id)
        .order('order_index');

      setPhases((phasesData as Phase[]) || []);

      // Fetch tasks
      if (phasesData && phasesData.length > 0) {
        const phaseIds = phasesData.map(p => p.id);
        const { data: tasksData } = await supabase
          .from('tasks')
          .select('*')
          .in('phase_id', phaseIds)
          .eq('client_visible', true)
          .order('order_index');

        const tasksList = (tasksData as Task[]) || [];
        setTasks(tasksList);

        // Fetch dependencies
        if (tasksList.length > 0) {
          const taskIds = tasksList.map(t => t.id);
          const { data: depsData } = await supabase
            .from('dependencies')
            .select('*')
            .or(`predecessor_task_id.in.(${taskIds.join(',')}),successor_task_id.in.(${taskIds.join(',')})`);

          setDependencies((depsData as Dependency[]) || []);
        }
      }

      // Fetch documents
      const [quotationsRes, invoicesRes] = await Promise.all([
        supabase.from('quotations').select('*').eq('project_id', shareInfo.project_id).order('created_at', { ascending: false }),
        supabase.from('invoices').select('*').eq('project_id', shareInfo.project_id).order('created_at', { ascending: false }),
      ]);

      setQuotations((quotationsRes.data as ProjectDocument[]) || []);
      setInvoices((invoicesRes.data as ProjectDocument[]) || []);

    } catch (error) {
      console.error('Error checking access:', error);
      setAccessDenied(true);
    } finally {
      setLoading(false);
    }
  }, [token, user, authLoading]);

  useEffect(() => {
    if (!authLoading) {
      checkAccess();
    }
  }, [checkAccess, authLoading]);

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
      console.error('Error creating preview URL:', error);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (doc: ProjectDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('project-documents')
        .createSignedUrl(doc.file_path, 60);

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (error) {
      console.error('Error downloading:', error);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (accessDenied) {
    // If invite-only and not logged in, redirect to auth
    if (share?.share_type === 'invite' && !user) {
      return <Navigate to="/auth" replace />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">
              This link is invalid, expired, or you don't have permission to view this project.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!project) return null;

  const totalDays = differenceInDays(new Date(project.end_date), new Date(project.start_date));
  const daysElapsed = differenceInDays(new Date(), new Date(project.start_date));
  const progress = Math.max(0, Math.min(100, (daysElapsed / totalDays) * 100));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{project.name}</h1>
            <Badge variant="outline" className={cn(
              project.status === 'active' && 'bg-status-in-progress/20 text-status-in-progress border-status-in-progress/30',
              project.status === 'draft' && 'bg-status-pending/20 text-status-pending border-status-pending/30',
              project.status === 'completed' && 'bg-status-completed/20 text-status-completed border-status-completed/30'
            )}>
              {project.status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
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

        {/* Project Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Timeline</p>
                  <p className="font-medium">
                    {format(new Date(project.start_date), 'MMM d')} - {format(new Date(project.end_date), 'MMM d, yyyy')}
                  </p>
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
                  <p className="font-medium">{Math.round(progress)}% Complete</p>
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
                  <p className="text-sm text-muted-foreground">Documents</p>
                  <p className="font-medium">{quotations.length + invoices.length} files</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Timeline Progress Bar */}
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
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="quotations">Quotations</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle>Project Timeline</CardTitle>
                <CardDescription>
                  View the project schedule and milestones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {tasks.length > 0 ? (
                  <GanttChart
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
                    readOnly
                  />
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No timeline data available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotations">
            <Card>
              <CardHeader>
                <CardTitle>Quotations</CardTitle>
                <CardDescription>
                  Project quotations and proposals.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotations.length > 0 ? (
                  <div className="space-y-2">
                    {quotations.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {doc.name.toLowerCase().endsWith('.pdf') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreview(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No quotations available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
                <CardDescription>
                  Project invoices and billing documents.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <div className="space-y-2">
                    {invoices.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(doc.file_size)} • {format(new Date(doc.created_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {doc.name.toLowerCase().endsWith('.pdf') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handlePreview(doc)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No invoices available.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* PDF Preview Dialog */}
        <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
          <DialogContent className="max-w-4xl h-[80vh]">
            <DialogHeader>
              <DialogTitle>{previewDoc?.name}</DialogTitle>
            </DialogHeader>
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg"
                title={previewDoc?.name}
              />
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}