import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, FolderOpen, Loader2, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ClientWithProjects {
  id: string;
  name: string;
  description: string | null;
  projects: {
    id: string;
    name: string;
    status: string;
    start_date: string;
    end_date: string;
  }[];
}

export default function ClientPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<ClientWithProjects[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!user) return;

      try {
        // Get clients the user belongs to
        const { data: clientUsers } = await supabase
          .from('client_users')
          .select('client_id')
          .eq('user_id', user.id);

        if (!clientUsers || clientUsers.length === 0) {
          setClients([]);
          setLoading(false);
          return;
        }

        const clientIds = clientUsers.map((cu) => cu.client_id);

        // Fetch client details
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name, description')
          .in('id', clientIds);

        // Fetch projects for each client
        const clientsWithProjects = await Promise.all(
          (clientsData || []).map(async (client) => {
            const { data: projects } = await supabase
              .from('projects')
              .select('id, name, status, start_date, end_date')
              .eq('client_id', client.id)
              .order('created_at', { ascending: false });

            return {
              ...client,
              projects: projects || [],
            };
          })
        );

        setClients(clientsWithProjects);
      } catch (error) {
        console.error('Error fetching client portal data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [user]);

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

  if (clients.length === 0) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
          <p className="text-muted-foreground">View your projects and timelines.</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Access</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              You haven't been added to any client portals yet. Contact your project manager to get access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
        <p className="text-muted-foreground">View your projects and timelines.</p>
      </div>

      {clients.map((client) => (
        <div key={client.id} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{client.name}</h2>
              {client.description && (
                <p className="text-sm text-muted-foreground">{client.description}</p>
              )}
            </div>
          </div>

          {client.projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                No projects available yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {client.projects.map((project) => (
                <Card
                  key={project.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/portal/projects/${project.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-muted">
                          <FolderOpen className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                      </div>
                      <Badge variant="outline" className={cn(getStatusColor(project.status))}>
                        {project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>
                        {format(new Date(project.start_date), 'MMM d')} –{' '}
                        {format(new Date(project.end_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}