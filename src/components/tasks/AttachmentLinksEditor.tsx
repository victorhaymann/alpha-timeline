import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Link2,
  ExternalLink,
  Trash2,
  Loader2,
  FileVideo,
  FolderOpen,
  Image,
  File
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttachmentLink {
  id: string;
  task_id: string;
  url: string;
  title: string | null;
  created_at: string;
  created_by: string;
}

interface AttachmentLinksEditorProps {
  taskId: string;
  readOnly?: boolean;
}

// Icon mapping based on URL patterns
function getLinkIcon(url: string) {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('frame.io')) return FileVideo;
  if (lowerUrl.includes('drive.google') || lowerUrl.includes('docs.google')) return FolderOpen;
  if (lowerUrl.includes('shotgrid') || lowerUrl.includes('shotgun')) return Image;
  return File;
}

// Label suggestions based on URL patterns
function getSuggestedLabel(url: string): string {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('frame.io')) return 'Frame.io Review';
  if (lowerUrl.includes('drive.google')) return 'Google Drive Folder';
  if (lowerUrl.includes('docs.google')) return 'Google Doc';
  if (lowerUrl.includes('shotgrid') || lowerUrl.includes('shotgun')) return 'ShotGrid Link';
  if (lowerUrl.includes('dropbox')) return 'Dropbox Folder';
  if (lowerUrl.includes('figma')) return 'Figma Design';
  if (lowerUrl.includes('notion')) return 'Notion Doc';
  return '';
}

export function AttachmentLinksEditor({ taskId, readOnly = false }: AttachmentLinksEditorProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [links, setLinks] = useState<AttachmentLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Only PMs can edit (role === 'pm' and not readOnly)
  const canEdit = role === 'pm' && !readOnly;

  // Fetch links
  useEffect(() => {
    const fetchLinks = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('attachment_links')
          .select('*')
          .eq('task_id', taskId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setLinks((data as AttachmentLink[]) || []);
      } catch (error) {
        console.error('Error fetching links:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLinks();
  }, [taskId]);

  // Auto-suggest title when URL changes
  useEffect(() => {
    if (newUrl && !newTitle) {
      const suggested = getSuggestedLabel(newUrl);
      if (suggested) {
        setNewTitle(suggested);
      }
    }
  }, [newUrl, newTitle]);

  const handleAddLink = async () => {
    if (!newUrl.trim() || !user) return;

    setIsAdding(true);
    try {
      const { data, error } = await supabase
        .from('attachment_links')
        .insert({
          task_id: taskId,
          url: newUrl.trim(),
          title: newTitle.trim() || null,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      setLinks([...links, data as AttachmentLink]);
      setNewUrl('');
      setNewTitle('');
      setShowAddForm(false);

      toast({
        title: 'Link added',
        description: 'Attachment link has been added.',
      });
    } catch (error: any) {
      console.error('Error adding link:', error);
      toast({
        title: 'Error',
        description: 'Failed to add link.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    try {
      const { error } = await supabase
        .from('attachment_links')
        .delete()
        .eq('id', linkId);

      if (error) throw error;

      setLinks(links.filter(l => l.id !== linkId));

      toast({
        title: 'Link removed',
        description: 'Attachment link has been removed.',
      });
    } catch (error: any) {
      console.error('Error deleting link:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove link.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Links list */}
      {links.length === 0 && !showAddForm ? (
        <div className="text-center py-8 text-muted-foreground">
          <Link2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No attachment links yet</p>
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="w-4 h-4" />
              Add Link
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => {
            const Icon = getLinkIcon(link.url);
            return (
              <div
                key={link.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 group"
              >
                <div className="p-2 rounded-lg bg-background">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {link.title || 'Untitled Link'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {link.url}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => window.open(link.url, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteLink(link.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add link form */}
      {showAddForm && canEdit && (
        <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="linkUrl">URL</Label>
            <Input
              id="linkUrl"
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkTitle">Label (optional)</Label>
            <Input
              id="linkTitle"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Frame.io Review, Google Drive Folder"
            />
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowAddForm(false);
                setNewUrl('');
                setNewTitle('');
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAddLink}
              disabled={!newUrl.trim() || isAdding}
            >
              {isAdding ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                'Add Link'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Add button when links exist */}
      {links.length > 0 && !showAddForm && canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="w-4 h-4" />
          Add Link
        </Button>
      )}
    </div>
  );
}
