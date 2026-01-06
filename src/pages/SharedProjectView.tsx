import { useState, useEffect, useCallback } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Phase, Task, Dependency } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GanttChart } from '@/components/timeline/GanttChart';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Calendar, 
  Loader2, 
  Building2,
  FileText,
  Download,
  Eye,
  Lock,
  User,
  Mail,
  Phone,
  BookOpen,
  Layers,
  Users,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import tnfLogoSquare from '@/assets/tnf-logo-square.png';

// Loading skeleton component
function SharedProjectSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6 space-y-6 animate-pulse">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        {/* Stats cards skeleton */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Skeleton className="w-9 h-9 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Progress bar skeleton */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between mb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </CardContent>
        </Card>

        {/* Tabs skeleton */}
        <div className="space-y-6">
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-40 rounded-md" />
            <Skeleton className="h-9 w-28 rounded-md" />
          </div>

          {/* Gantt chart skeleton */}
          <div className="space-y-4">
            {/* Controls bar */}
            <Card className="p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-32" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-32 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-40 rounded" />
                </div>
                <Skeleton className="h-6 w-24" />
              </div>
            </Card>

            {/* Timeline skeleton */}
            <Card>
              <div className="p-0">
                {/* Header row */}
                <div className="flex border-b border-border">
                  <div className="w-40 md:w-80 shrink-0 p-4 border-r border-border">
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <div className="flex-1 p-4 flex gap-2">
                    {[...Array(8)].map((_, i) => (
                      <Skeleton key={i} className="h-5 w-10" />
                    ))}
                  </div>
                </div>
                
                {/* Task rows */}
                {[...Array(6)].map((_, sectionIndex) => (
                  <div key={sectionIndex}>
                    {/* Section header */}
                    <div className="flex border-b border-border bg-muted/30">
                      <div className="w-40 md:w-80 shrink-0 p-3 border-r border-border">
                        <div className="flex items-center gap-2">
                          <Skeleton className="h-4 w-4 rounded-full" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </div>
                      <div className="flex-1 p-3" />
                    </div>
                    
                    {/* Task rows in section */}
                    {[...Array(2)].map((_, rowIndex) => (
                      <div key={rowIndex} className="flex border-b border-border last:border-b-0">
                        <div className="w-40 md:w-80 shrink-0 p-3 border-r border-border">
                          <div className="flex items-center gap-2">
                            <Skeleton className="h-3.5 w-3.5" />
                            <Skeleton className="h-3.5 w-32" />
                          </div>
                        </div>
                        <div className="flex-1 p-3 flex items-center">
                          <Skeleton 
                            className="h-6 rounded" 
                            style={{ 
                              width: `${Math.random() * 30 + 15}%`,
                              marginLeft: `${Math.random() * 40}%`
                            }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [needsAuth, setNeedsAuth] = useState(false);
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

  const checkAccess = useCallback(async (currentUser: typeof user) => {
    if (!token) {
      setAccessDenied(true);
      setLoading(false);
      return;
    }

    try {
      // Step 1: Fetch the share by token first (this works without auth)
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

      // Step 2: For invite-only shares, we need auth
      if (shareInfo.share_type === 'invite') {
        if (!currentUser) {
          // User needs to log in - show auth redirect
          setNeedsAuth(true);
          setLoading(false);
          return;
        }

        // Check if user's email is in the invite list
        const { data: profile } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', currentUser.id)
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
      const { data: phasesData, error: phasesError } = await supabase
        .from('phases')
        .select('*')
        .eq('project_id', shareInfo.project_id)
        .order('order_index');

      setPhases((phasesData as Phase[]) || []);

      // Fetch tasks
      if (phasesData && phasesData.length > 0) {
        const phaseIds = phasesData.map(p => p.id);
        const { data: tasksData, error: tasksError } = await supabase
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

      setLoading(false);
    } catch (error) {
      setAccessDenied(true);
      setLoading(false);
    }
  }, [token]);

  // For public shares: run immediately
  // For invite-only shares: wait for auth to settle, then run with current user
  useEffect(() => {
    // Don't wait for auth if we haven't fetched share info yet
    // The checkAccess function handles the auth requirement internally
    if (!authLoading || share?.share_type === 'public') {
      checkAccess(user);
    }
  }, [authLoading, user, checkAccess, share?.share_type]);

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

  // Show skeleton only when loading data (not when waiting for auth)
  if (loading) {
    return <SharedProjectSkeleton />;
  }

  // If invite-only share requires login, redirect to auth
  if (needsAuth) {
    return <Navigate to="/auth" replace />;
  }

  if (accessDenied) {
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
      {/* TNF Logo - Fixed top right */}
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50">
        <img 
          src={tnfLogoSquare} 
          alt="The New Face" 
          className="h-10 md:h-14 w-auto object-contain"
        />
      </div>
      
      <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6 space-y-6">
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

        {/* Project Stats - Duration and Project Manager only */}
        <div className="grid gap-4 md:grid-cols-2">
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
                          <Mail className="w-3.5 h-3.5 text-[#0078D4]" />
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
                          <Phone className="w-3.5 h-3.5 text-[#25D366]" />
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
            <TabsTrigger value="documents" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Quotations & Invoices
            </TabsTrigger>
            <TabsTrigger value="resources" className="gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Resources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timeline">
            {tasks.length > 0 ? (
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
                readOnly
              />
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <p className="text-muted-foreground">No timeline data available.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-lg font-semibold mb-4">Quotations</h3>
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
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No quotations available.
                    </CardContent>
                  </Card>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Invoices</h3>
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
                  <Card className="border-dashed">
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No invoices available.
                    </CardContent>
                  </Card>
                )}
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

        {/* PDF Preview Dialog */}
        <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
          <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle>{previewDoc?.name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 min-h-0 p-4">
              {loadingPreview ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-8 h-8 animate-spin" />
                </div>
              ) : previewUrl ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full rounded-lg border-0"
                  title={previewDoc?.name}
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}