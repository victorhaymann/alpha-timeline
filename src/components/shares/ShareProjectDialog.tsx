import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy, Link, Mail, Trash2, Loader2, Globe, Lock } from 'lucide-react';

interface ProjectShare {
  id: string;
  token: string;
  share_type: 'public' | 'invite';
  is_active: boolean;
  created_at: string;
}

interface ShareInvite {
  id: string;
  email: string;
  created_at: string;
}

interface ShareProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareProjectDialog({ projectId, projectName, open, onOpenChange }: ShareProjectDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [publicShare, setPublicShare] = useState<ProjectShare | null>(null);
  const [inviteShare, setInviteShare] = useState<ProjectShare | null>(null);
  const [invites, setInvites] = useState<ShareInvite[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [addingInvite, setAddingInvite] = useState(false);

  const baseUrl = window.location.origin;

  const fetchShares = async () => {
    try {
      const { data: shares, error } = await supabase
        .from('project_shares')
        .select('*')
        .eq('project_id', projectId);

      if (error) throw error;

      const publicS = shares?.find(s => s.share_type === 'public') || null;
      const inviteS = shares?.find(s => s.share_type === 'invite') || null;

      setPublicShare(publicS as ProjectShare | null);
      setInviteShare(inviteS as ProjectShare | null);

      // Fetch invites if invite share exists
      if (inviteS) {
        const { data: invitesData } = await supabase
          .from('share_invites')
          .select('*')
          .eq('share_id', inviteS.id)
          .order('created_at', { ascending: false });

        setInvites((invitesData as ShareInvite[]) || []);
      } else {
        setInvites([]);
      }
    } catch (error) {
      console.error('Error fetching shares:', error);
      toast.error('Failed to load sharing settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchShares();
    }
  }, [open, projectId]);

  const togglePublicShare = async (enabled: boolean) => {
    if (!user) return;

    try {
      if (enabled && !publicShare) {
        // Create public share
        const { error } = await supabase
          .from('project_shares')
          .insert({
            project_id: projectId,
            share_type: 'public',
            created_by: user.id,
          });

        if (error) throw error;
        toast.success('Public link created');
      } else if (!enabled && publicShare) {
        // Delete public share
        const { error } = await supabase
          .from('project_shares')
          .delete()
          .eq('id', publicShare.id);

        if (error) throw error;
        toast.success('Public link removed');
      }
      await fetchShares();
    } catch (error) {
      console.error('Error toggling public share:', error);
      toast.error('Failed to update sharing settings');
    }
  };

  const ensureInviteShare = async (): Promise<string | null> => {
    if (!user) return null;

    if (inviteShare) return inviteShare.id;

    try {
      const { data, error } = await supabase
        .from('project_shares')
        .insert({
          project_id: projectId,
          share_type: 'invite',
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Error creating invite share:', error);
      return null;
    }
  };

  const addInvite = async () => {
    if (!newEmail.trim() || !user) return;

    const email = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Please enter a valid email');
      return;
    }

    setAddingInvite(true);
    try {
      let shareId = inviteShare?.id;
      if (!shareId) {
        shareId = await ensureInviteShare();
        if (!shareId) throw new Error('Failed to create share');
      }

      const { error } = await supabase
        .from('share_invites')
        .insert({
          share_id: shareId,
          email,
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('This email is already invited');
        } else {
          throw error;
        }
      } else {
        toast.success(`Invited ${email}`);
        setNewEmail('');
      }
      await fetchShares();
    } catch (error) {
      console.error('Error adding invite:', error);
      toast.error('Failed to add invite');
    } finally {
      setAddingInvite(false);
    }
  };

  const removeInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('share_invites')
        .delete()
        .eq('id', inviteId);

      if (error) throw error;
      toast.success('Invite removed');
      await fetchShares();
    } catch (error) {
      console.error('Error removing invite:', error);
      toast.error('Failed to remove invite');
    }
  };

  const copyLink = (token: string) => {
    const link = `${baseUrl}/share/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  if (loading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="w-5 h-5" />
            Share Project
          </DialogTitle>
          <DialogDescription>
            Share "{projectName}" with clients or stakeholders. They can view the timeline, quotations, and invoices.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Public Link Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <Label className="font-medium">Public Link</Label>
              </div>
              <Switch
                checked={!!publicShare}
                onCheckedChange={togglePublicShare}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view the project without logging in.
            </p>
            {publicShare && (
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${baseUrl}/share/${publicShare.token}`}
                  className="text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyLink(publicShare.token)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* Invite by Email Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <Label className="font-medium">Invite by Email</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Only invited users can access (login required).
            </p>
            
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Enter email address"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addInvite()}
              />
              <Button onClick={addInvite} disabled={addingInvite || !newEmail.trim()}>
                {addingInvite ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
              </Button>
            </div>

            {invites.length > 0 && (
              <div className="space-y-2">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="text-sm">{invite.email}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeInvite(invite.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {inviteShare && invites.length > 0 && (
              <div className="pt-2">
                <p className="text-xs text-muted-foreground mb-2">Share this link with invited users:</p>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={`${baseUrl}/share/${inviteShare.token}`}
                    className="text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyLink(inviteShare.token)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}