import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Copy, Link2, Loader2, Globe, Check } from 'lucide-react';

interface ShareProjectDialogProps {
  projectId: string;
  projectName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareProjectDialog({ projectId, projectName, open, onOpenChange }: ShareProjectDialogProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareId, setShareId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toggling, setToggling] = useState(false);

  const baseUrl = window.location.origin;
  const shareLink = shareToken ? `${baseUrl}/share/${shareToken}` : '';

  const fetchShare = async () => {
    try {
      const { data, error } = await supabase
        .from('project_shares')
        .select('id, token')
        .eq('project_id', projectId)
        .eq('share_type', 'public')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;

      setShareToken(data?.token || null);
      setShareId(data?.id || null);
    } catch (error) {
      console.error('Error fetching share:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchShare();
    }
  }, [open, projectId]);

  const createShare = async () => {
    if (!user) return;
    
    setToggling(true);
    try {
      const { data, error } = await supabase
        .from('project_shares')
        .insert({
          project_id: projectId,
          share_type: 'public',
          created_by: user.id,
          is_active: true,
        })
        .select('id, token')
        .single();

      if (error) throw error;

      setShareToken(data.token);
      setShareId(data.id);
      toast.success('Link created');
    } catch (error) {
      console.error('Error creating share:', error);
      toast.error('Failed to create link');
    } finally {
      setToggling(false);
    }
  };

  const deleteShare = async () => {
    if (!shareId) return;
    
    setToggling(true);
    try {
      const { error } = await supabase
        .from('project_shares')
        .delete()
        .eq('id', shareId);

      if (error) throw error;

      setShareToken(null);
      setShareId(null);
      toast.success('Link disabled');
    } catch (error) {
      console.error('Error deleting share:', error);
      toast.error('Failed to disable link');
    } finally {
      setToggling(false);
    }
  };

  const copyLink = async () => {
    if (!shareLink) return;
    
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Link2 className="w-5 h-5" />
            Share "{projectName}"
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : shareToken ? (
            /* Link exists - show link and copy button */
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <Globe className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Anyone with the link</p>
                  <p className="text-xs text-muted-foreground">Can view timeline, documents, and invoices</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Input
                  readOnly
                  value={shareLink}
                  className="text-sm font-mono"
                  onClick={(e) => e.currentTarget.select()}
                />
                <Button onClick={copyLink} className="shrink-0 gap-2">
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </Button>
              </div>

              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-destructive"
                onClick={deleteShare}
                disabled={toggling}
              >
                {toggling ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Disable link
              </Button>
            </div>
          ) : (
            /* No link - show create button */
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Globe className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Create a shareable link</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Anyone with the link can view this project without signing in
                </p>
              </div>
              <Button onClick={createShare} disabled={toggling} className="gap-2">
                {toggling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4" />
                )}
                Create link
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
