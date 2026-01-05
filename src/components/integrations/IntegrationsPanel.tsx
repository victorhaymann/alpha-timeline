import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  MessageSquare,
  FolderOpen,
  Video,
  Link2,
  ExternalLink,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IntegrationsPanelProps {
  projectId: string;
  zoomLink?: string | null;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: 'available' | 'connected' | 'coming_soon';
  category: 'calendar' | 'communication' | 'storage';
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync meetings and milestones to Google Calendar',
    icon: Calendar,
    status: 'available',
    category: 'calendar',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications for client change requests',
    icon: MessageSquare,
    status: 'available',
    category: 'communication',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Link folders for asset delivery',
    icon: FolderOpen,
    status: 'available',
    category: 'storage',
  },
  {
    id: 'frame-io',
    name: 'Frame.io',
    description: 'Link review sessions for client feedback',
    icon: Video,
    status: 'available',
    category: 'storage',
  },
];

export function IntegrationsPanel({ projectId, zoomLink }: IntegrationsPanelProps) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<Set<string>>(new Set());

  const handleConnect = async (integrationId: string) => {
    setConnecting(integrationId);
    
    // Simulate connection process (MVP stub)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    if (integrationId === 'google-calendar') {
      toast({
        title: 'Google Calendar',
        description: 'Google Calendar integration coming soon. For now, use the iCal export to import events.',
      });
    } else if (integrationId === 'slack') {
      toast({
        title: 'Slack',
        description: 'Slack integration coming soon. We\'ll notify you when change requests are submitted.',
      });
    } else {
      setConnected(new Set([...connected, integrationId]));
      toast({
        title: 'Integration ready',
        description: 'You can now add links to tasks. Use the Links tab in task details.',
      });
    }
    
    setConnecting(null);
  };

  const handleDisconnect = (integrationId: string) => {
    const newConnected = new Set(connected);
    newConnected.delete(integrationId);
    setConnected(newConnected);
    toast({
      title: 'Disconnected',
      description: 'Integration has been removed.',
    });
  };

  const getIntegrationStatus = (integration: Integration) => {
    if (connected.has(integration.id)) return 'connected';
    return integration.status;
  };

  return (
    <div className="space-y-6">
      {/* Zoom Link */}
      {zoomLink && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Video className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Zoom Meeting Link</CardTitle>
                  <CardDescription className="text-xs">
                    Default meeting room for this project
                  </CardDescription>
                </div>
              </div>
              <Badge variant="secondary" className="bg-green-500/10 text-green-500">
                Configured
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{zoomLink}</span>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0"
                onClick={() => window.open(zoomLink, '_blank')}
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Integrations */}
      <div className="grid gap-4">
        {INTEGRATIONS.map((integration) => {
          const status = getIntegrationStatus(integration);
          const isConnected = status === 'connected';
          const isConnecting = connecting === integration.id;

          return (
            <Card key={integration.id}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className={cn(
                  "p-3 rounded-lg",
                  isConnected ? "bg-green-500/10" : "bg-muted"
                )}>
                  <integration.icon className={cn(
                    "w-5 h-5",
                    isConnected ? "text-green-500" : "text-muted-foreground"
                  )} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{integration.name}</h3>
                    {isConnected && (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-500 text-xs">
                        <Check className="w-3 h-3 mr-1" />
                        Connected
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {integration.description}
                  </p>
                </div>

                {status === 'coming_soon' ? (
                  <Badge variant="outline">Coming Soon</Badge>
                ) : isConnected ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnect(integration.id)}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConnect(integration.id)}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      'Connect'
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Note about link-based integrations */}
      <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
        <h4 className="font-medium text-sm mb-1">Link-Based Integrations</h4>
        <p className="text-sm text-muted-foreground">
          Google Drive, Frame.io, and ShotGrid work via links. Once connected, you can add 
          links to individual tasks using the Links tab in task details. Clients can view 
          these links for tasks marked as client-visible.
        </p>
      </div>
    </div>
  );
}
