import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Building2,
  FolderOpen,
  Users,
  Loader2,
  Plus,
  Trash2,
  Mail,
  Calendar,
  FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Client {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  created_at: string;
}

interface Project {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  description: string | null;
}

interface ClientUser {
  id: string;
  user_id: string;
  created_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientUsers, setClientUsers] = useState<ClientUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingUser, setRemovingUser] = useState<string | null>(null);

  const fetchClientData = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch projects for this client
      const { data: projectsData } = await supabase
        .from('projects')
        .select('id, name, status, start_date, end_date, description')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      setProjects(projectsData || []);

      // Fetch client users
      const { data: usersData } = await supabase
        .from('client_users')
        .select('id, user_id, created_at')
        .eq('client_id', id);

      if (usersData && usersData.length > 0) {
        // Fetch profiles for each user
        const userIds = usersData.map((u) => u.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        const usersWithProfiles = usersData.map((u) => ({
          ...u,
          profile: profilesData?.find((p) => p.id === u.user_id),
        }));

        setClientUsers(usersWithProfiles);
      } else {
        setClientUsers([]);
      }
    } catch (error) {
      console.error('Error fetching client:', error);
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchClientData();
  }, [fetchClientData]);

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !id) return;

    setInviting(true);
    try {
      // Find user by email
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim().toLowerCase())
        .single();

      if (profileError || !profileData) {
        toast({
          title: 'User not found',
          description: 'No user with this email exists. They need to sign up first.',
          variant: 'destructive',
        });
        return;
      }

      // Add user to client
      const { error } = await supabase.from('client_users').insert({
        client_id: id,
        user_id: profileData.id,
      });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: 'Already added',
            description: 'This user is already a member of this client.',
            variant: 'destructive',
          });
        } else {
          throw error;
        }
        return;
      }

      toast({ title: 'User added', description: `${inviteEmail} now has access to this client.` });
      setInviteEmail('');
      setAddUserDialogOpen(false);
      fetchClientData();
    } catch (error: any) {
      toast({
        title: 'Error adding user',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveUser = async (clientUser: ClientUser) => {
    setRemovingUser(clientUser.id);
    try {
      const { error } = await supabase.from('client_users').delete().eq('id', clientUser.id);

      if (error) throw error;

      toast({ title: 'User removed', description: 'User access has been revoked.' });
      fetchClientData();
    } catch (error: any) {
      toast({
        title: 'Error removing user',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRemovingUser(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-status-in-progress/20 text-status-in-progress border-status-in-progress/30';
      case 'completed':
        return 'bg-status-completed/20 text-status-completed border-status-completed/30';
      case 'draft':
        return 'bg-status-pending/20 text-status-pending border-status-pending/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!client) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/clients')}
              className="h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
          </div>
          {client.description && (
            <p className="text-muted-foreground ml-[4.5rem]">{client.description}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Projects</p>
                <p className="text-2xl font-semibold">{projects.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-phase-production/10">
                <Users className="w-5 h-5 text-phase-production" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-semibold">{clientUsers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-phase-delivery/10">
                <Calendar className="w-5 h-5 text-phase-delivery" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="text-2xl font-semibold">
                  {format(new Date(client.created_at), 'MMM yyyy')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projects" className="gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Team
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <FolderOpen className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  Create a project and assign it to this client.
                </p>
                <Button className="gap-2" onClick={() => navigate('/projects/new')}>
                  <Plus className="w-4 h-4" />
                  Create Project
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {projects.map((project) => (
                <Card
                  key={project.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-muted">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{project.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(project.start_date), 'MMM d')} –{' '}
                            {format(new Date(project.end_date), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={getStatusColor(project.status)}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <div className="flex justify-end">
            <Button className="gap-2" onClick={() => setAddUserDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              Add Team Member
            </Button>
          </div>

          {clientUsers.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No team members</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  Add users to give them portal access to view projects and timelines.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {clientUsers.map((cu) => (
                <Card key={cu.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold">
                            {cu.profile?.full_name?.[0] || cu.profile?.email?.[0]?.toUpperCase() || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">
                            {cu.profile?.full_name || 'Unknown User'}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                            <Mail className="w-3 h-3" />
                            {cu.profile?.email || 'No email'}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveUser(cu)}
                        disabled={removingUser === cu.id}
                      >
                        {removingUser === cu.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-destructive" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add User Dialog */}
      <Dialog open={addUserDialogOpen} onOpenChange={setAddUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a user by their email address. They must have an existing account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleInviteUser} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}