import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Project, Phase, Task, Dependency } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import tnfLogoSquare from '@/assets/tnf-logo-square.png';

// Timeout helper - wraps a promise with a timeout
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`Timeout: ${label} took longer than ${ms}ms`)), ms)
    )
  ]);
}

// Type for Supabase query results
interface QueryResult<T> {
  data: T | null;
  error: { message: string } | null;
}

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
  password_hash: string | null;
}

interface ProjectDocument {
  id: string;
  name: string;
  file_path: string;
  file_size: number | null;
  created_at: string;
}

interface LoadError {
  step: string;
  message: string;
}

const REQUEST_TIMEOUT_MS = 15000; // 15 second timeout per request

export default function SharedProjectView() {
  const { token } = useParams<{ token: string }>();
  const { user, loading: authLoading } = useAuth();
  
  // Boot stages: 'init' -> 'resolving-share' -> 'loading-data' -> 'done'
  const [bootStage, setBootStage] = useState<'init' | 'resolving-share' | 'loading-data' | 'done'>('init');
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [debugSteps, setDebugSteps] = useState<string[]>([]);
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
  
  // Diagnostics UI state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // Boot watchdog - if still loading after 10 seconds, show diagnostics
  const [bootWatchdogTriggered, setBootWatchdogTriggered] = useState(false);
  
  // Prevent concurrent runs
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const bootStartRef = useRef(Date.now());

  const addDebugStep = useCallback((step: string) => {
    const elapsed = Date.now() - bootStartRef.current;
    const logLine = `[+${elapsed}ms] ${step}`;
    console.log('[SharedProjectView]', logLine);
    setDebugSteps(prev => [...prev, logLine]);
  }, []);

  // Step 1: Immediately resolve share by token (no auth dependency)
  const resolveShare = useCallback(async () => {
    if (!token) {
      addDebugStep('No token in URL');
      setAccessDenied(true);
      setLoading(false);
      setBootStage('done');
      return null;
    }
    
    setBootStage('resolving-share');
    addDebugStep('Resolving share by token...');
    
    try {
      const shareResult = await withTimeout(
        supabase
          .from('project_shares')
          .select('*')
          .eq('token', token)
          .eq('is_active', true)
          .single(),
        REQUEST_TIMEOUT_MS,
        'Resolve share'
      );

      if (shareResult.error || !shareResult.data) {
        addDebugStep(`Share not found: ${shareResult.error?.message || 'No data'}`);
        setAccessDenied(true);
        setLoading(false);
        setBootStage('done');
        return null;
      }

      const shareInfo = shareResult.data as ProjectShare;
      addDebugStep(`Share resolved: type=${shareInfo.share_type}, hasPassword=${!!shareInfo.password_hash}`);
      setShare(shareInfo);

      // Check password immediately
      if (shareInfo.password_hash) {
        const verifiedKey = `share_verified_${token}`;
        const isVerified = sessionStorage.getItem(verifiedKey) === 'true';
        
        if (!isVerified) {
          addDebugStep('Password required - showing prompt');
          setNeedsPassword(true);
          setLoading(false);
          setBootStage('done');
          return null;
        }
        addDebugStep('Password verified from session');
      }

      return shareInfo;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      addDebugStep(`Share resolution failed: ${msg}`);
      setLoadError({ step: 'Resolve share', message: msg });
      setLoading(false);
      setBootStage('done');
      return null;
    }
  }, [token, addDebugStep]);

  // Step 2: Load project data (may require auth for invite shares)
  const loadProjectData = useCallback(async (shareInfo: ProjectShare, currentUser: typeof user) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    
    const thisRequestId = ++requestIdRef.current;
    setBootStage('loading-data');
    addDebugStep(`Loading project data (user=${currentUser ? 'authenticated' : 'anonymous'})`);

    try {
      // For invite-only shares, we need auth
      if (shareInfo.share_type === 'invite') {
        addDebugStep('Invite share - checking auth...');
        if (!currentUser) {
          addDebugStep('No user authenticated, redirecting to auth');
          setNeedsAuth(true);
          setLoading(false);
          setBootStage('done');
          inFlightRef.current = false;
          return;
        }

        addDebugStep('Fetching user profile...');
        const profileResult = await withTimeout(
          supabase
            .from('profiles')
            .select('email')
            .eq('id', currentUser.id)
            .single(),
          REQUEST_TIMEOUT_MS,
          'Fetch profile'
        );

        if (thisRequestId !== requestIdRef.current) {
          inFlightRef.current = false;
          return;
        }

        if (!profileResult.data) {
          addDebugStep('Profile not found');
          setAccessDenied(true);
          setLoading(false);
          setBootStage('done');
          inFlightRef.current = false;
          return;
        }

        addDebugStep(`Checking invite for email: ${profileResult.data.email}`);
        const inviteResult = await withTimeout(
          supabase
            .from('share_invites')
            .select('id')
            .eq('share_id', shareInfo.id)
            .eq('email', profileResult.data.email)
            .single(),
          REQUEST_TIMEOUT_MS,
          'Fetch invite'
        );

        if (thisRequestId !== requestIdRef.current) {
          inFlightRef.current = false;
          return;
        }

        if (!inviteResult.data) {
          addDebugStep('User not in invite list');
          setAccessDenied(true);
          setLoading(false);
          setBootStage('done');
          inFlightRef.current = false;
          return;
        }
        addDebugStep('User is invited, access granted');
      } else {
        addDebugStep('Public share - no auth required');
      }

      // Fetch project data
      addDebugStep('Fetching project...');
      const projectResult = await withTimeout(
        supabase
          .from('projects')
          .select('*')
          .eq('id', shareInfo.project_id)
          .single(),
        REQUEST_TIMEOUT_MS,
        'Fetch project'
      );

      if (thisRequestId !== requestIdRef.current) {
        inFlightRef.current = false;
        return;
      }

      if (projectResult.error || !projectResult.data) {
        addDebugStep(`Project fetch failed: ${projectResult.error?.message || 'No data'}`);
        setAccessDenied(true);
        setLoading(false);
        setBootStage('done');
        inFlightRef.current = false;
        return;
      }

      addDebugStep(`Project loaded: ${projectResult.data.name}`);
      setProject(projectResult.data as Project);

      // Fetch phases
      addDebugStep('Fetching phases...');
      const phasesResult = await withTimeout(
        supabase
          .from('phases')
          .select('*')
          .eq('project_id', shareInfo.project_id)
          .order('order_index'),
        REQUEST_TIMEOUT_MS,
        'Fetch phases'
      );

      if (thisRequestId !== requestIdRef.current) {
        inFlightRef.current = false;
        return;
      }

      const phasesData = (phasesResult.data as Phase[]) || [];
      addDebugStep(`Phases loaded: ${phasesData.length}`);
      setPhases(phasesData);

      // Fetch tasks
      if (phasesData.length > 0) {
        const phaseIds = phasesData.map(p => p.id);
        addDebugStep('Fetching tasks...');
        const tasksResult = await withTimeout(
          supabase
            .from('tasks')
            .select('*')
            .in('phase_id', phaseIds)
            .eq('client_visible', true)
            .order('order_index'),
          REQUEST_TIMEOUT_MS,
          'Fetch tasks'
        );

        if (thisRequestId !== requestIdRef.current) {
          inFlightRef.current = false;
          return;
        }

        const tasksList = (tasksResult.data as Task[]) || [];
        addDebugStep(`Tasks loaded: ${tasksList.length}`);
        setTasks(tasksList);

        // Fetch dependencies
        if (tasksList.length > 0) {
          const taskIds = tasksList.map(t => t.id);
          addDebugStep('Fetching dependencies...');
          const depsResult = await withTimeout(
            supabase
              .from('dependencies')
              .select('*')
              .or(`predecessor_task_id.in.(${taskIds.join(',')}),successor_task_id.in.(${taskIds.join(',')})`),
            REQUEST_TIMEOUT_MS,
            'Fetch dependencies'
          );

          if (thisRequestId !== requestIdRef.current) {
            inFlightRef.current = false;
            return;
          }

          addDebugStep(`Dependencies loaded: ${depsResult.data?.length || 0}`);
          setDependencies((depsResult.data as Dependency[]) || []);
        }
      } else {
        addDebugStep('No phases, skipping tasks');
        setTasks([]);
      }

      // Fetch documents
      addDebugStep('Fetching documents...');
      const [quotationsRes, invoicesRes] = await Promise.all([
        withTimeout(
          supabase.from('quotations').select('*').eq('project_id', shareInfo.project_id).order('created_at', { ascending: false }),
          REQUEST_TIMEOUT_MS,
          'Fetch quotations'
        ),
        withTimeout(
          supabase.from('invoices').select('*').eq('project_id', shareInfo.project_id).order('created_at', { ascending: false }),
          REQUEST_TIMEOUT_MS,
          'Fetch invoices'
        ),
      ]);

      if (thisRequestId !== requestIdRef.current) {
        inFlightRef.current = false;
        return;
      }

      addDebugStep(`Quotations: ${quotationsRes.data?.length || 0}, Invoices: ${invoicesRes.data?.length || 0}`);
      setQuotations((quotationsRes.data as ProjectDocument[]) || []);
      setInvoices((invoicesRes.data as ProjectDocument[]) || []);

      addDebugStep('All data loaded successfully');
      setLoading(false);
      setBootStage('done');
      inFlightRef.current = false;
    } catch (error) {
      if (thisRequestId !== requestIdRef.current) {
        inFlightRef.current = false;
        return;
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugStep(`Error: ${errorMessage}`);
      
      if (errorMessage.startsWith('Timeout:')) {
        setLoadError({
          step: errorMessage.split(':')[1]?.trim() || 'Unknown step',
          message: errorMessage,
        });
      } else {
        setLoadError({
          step: 'Unknown',
          message: errorMessage,
        });
      }
      setLoading(false);
      setBootStage('done');
      inFlightRef.current = false;
    }
  }, [addDebugStep]);

  // Boot sequence: resolve share immediately, then load data
  // For PUBLIC shares: don't wait for auth at all
  // For INVITE shares: wait for auth (with timeout)
  useEffect(() => {
    let cancelled = false;
    bootStartRef.current = Date.now();
    
    const boot = async () => {
      // Step 1: Resolve share immediately (no auth needed)
      const shareInfo = await resolveShare();
      if (cancelled || !shareInfo) return;
      
      // Step 2: For public shares, load data immediately
      if (shareInfo.share_type === 'public') {
        loadProjectData(shareInfo, null);
        return;
      }
      
      // Step 3: For invite shares, wait for auth (with 3s timeout)
      if (authLoading) {
        addDebugStep('Invite share - waiting for auth...');
        const authTimeout = setTimeout(() => {
          if (!cancelled) {
            addDebugStep('Auth timeout - prompting login');
            setNeedsAuth(true);
            setLoading(false);
            setBootStage('done');
          }
        }, 3000);
        
        // Clean up will handle this
        return () => clearTimeout(authTimeout);
      }
      
      // Auth is ready, proceed
      loadProjectData(shareInfo, user);
    };
    
    boot();
    
    return () => {
      cancelled = true;
    };
  }, [token]); // Only run on mount / token change
  
  // For invite shares: react to auth state changes
  useEffect(() => {
    if (!share || share.share_type !== 'invite') return;
    if (bootStage !== 'resolving-share' && bootStage !== 'init') return;
    
    // Auth settled after share was resolved
    if (!authLoading && share) {
      loadProjectData(share, user);
    }
  }, [authLoading, user, share, bootStage, loadProjectData]);
  
  // Boot watchdog - show diagnostics if stuck too long
  useEffect(() => {
    if (!loading) return;
    
    const watchdog = setTimeout(() => {
      if (loading) {
        setBootWatchdogTriggered(true);
        addDebugStep('WATCHDOG: Still loading after 10 seconds');
      }
    }, 10000);
    
    return () => clearTimeout(watchdog);
  }, [loading, addDebugStep]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    setAccessDenied(false);
    setNeedsAuth(false);
    setNeedsPassword(false);
    setLoadError(null);
    setDebugSteps([]);
    setBootStage('init');
    setBootWatchdogTriggered(false);
    inFlightRef.current = false;
    bootStartRef.current = Date.now();
    
    // Re-trigger boot by forcing re-mount effect
    window.location.reload();
  }, []);

  // Simple password verification
  const verifyPassword = useCallback(async () => {
    if (!share || !passwordInput.trim()) return;
    
    setVerifyingPassword(true);
    setPasswordError(false);
    
    try {
      if (share.password_hash === passwordInput) {
        sessionStorage.setItem(`share_verified_${token}`, 'true');
        setNeedsPassword(false);
        setPasswordInput('');
        inFlightRef.current = false;
        // Load project data after password verification
        loadProjectData(share, user);
      } else {
        setPasswordError(true);
      }
    } finally {
      setVerifyingPassword(false);
    }
  }, [share, passwordInput, token, loadProjectData, user]);

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

  // Show loading state with optional diagnostics
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <SharedProjectSkeleton />
        {/* Diagnostics overlay when boot watchdog triggers */}
        {bootWatchdogTriggered && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <Card className="max-w-lg shadow-lg border-orange-500/50">
              <CardContent className="pt-4 pb-3 space-y-3">
                <div className="flex items-center gap-2 text-orange-600">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm font-medium">Loading is taking longer than expected</span>
                </div>
                <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                      {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      {showDiagnostics ? 'Hide' : 'Show'} Diagnostics ({debugSteps.length} steps)
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-1 max-h-48 overflow-auto">
                      <div className="text-muted-foreground">Boot stage: {bootStage}</div>
                      {debugSteps.map((step, i) => (
                        <div key={i} className="text-muted-foreground">{step}</div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
                <Button onClick={handleRetry} size="sm" variant="outline" className="w-full gap-2">
                  <RefreshCw className="w-3 h-3" />
                  Reload Page
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // If invite-only share requires login, redirect to auth with return URL
  if (needsAuth) {
    const returnUrl = encodeURIComponent(`/share/${token}`);
    return <Navigate to={`/auth?redirect=${returnUrl}`} replace />;
  }

  // Password prompt screen
  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Password Protected</h2>
                <p className="text-sm text-muted-foreground">
                  This project requires a password to view.
                </p>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="share-password">Enter password</Label>
              <Input
                id="share-password"
                type="password"
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  setPasswordError(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && verifyPassword()}
                placeholder="Enter project password"
                className={cn(passwordError && 'border-destructive')}
              />
              {passwordError && (
                <p className="text-sm text-destructive">Incorrect password</p>
              )}
            </div>
            
            <Button 
              onClick={verifyPassword} 
              disabled={verifyingPassword || !passwordInput.trim()}
              className="w-full"
            >
              {verifyingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error state with diagnostics
  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Failed to Load Project</h2>
                <p className="text-sm text-muted-foreground">
                  {loadError.message}
                </p>
              </div>
            </div>
            
            <Button onClick={handleRetry} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            
            <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                  {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-1 max-h-48 overflow-auto">
                  {debugSteps.map((step, i) => (
                    <div key={i} className="text-muted-foreground">{step}</div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    );
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

  // No project loaded but also no error - show error state
  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Project Not Found</h2>
                <p className="text-sm text-muted-foreground">
                  The project could not be loaded. Please try again.
                </p>
              </div>
            </div>
            
            <Button onClick={handleRetry} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
            
            {debugSteps.length > 0 && (
              <Collapsible open={showDiagnostics} onOpenChange={setShowDiagnostics}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-muted-foreground">
                    {showDiagnostics ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    {showDiagnostics ? 'Hide' : 'Show'} Diagnostics
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 p-3 rounded-lg bg-muted/50 text-xs font-mono space-y-1 max-h-48 overflow-auto">
                    {debugSteps.map((step, i) => (
                      <div key={i} className="text-muted-foreground">{step}</div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

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
