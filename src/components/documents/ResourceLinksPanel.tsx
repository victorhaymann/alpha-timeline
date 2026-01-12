import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileText,
  Loader2,
  Trash2,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  Figma,
  FileSpreadsheet,
  Presentation,
  Video,
  Music,
  FolderOpen,
  Globe,
  MessageSquare,
  Trello,
  Github,
  Gitlab,
  PenTool,
  Box,
  Database,
  Cloud,
} from 'lucide-react';
import { toast } from 'sonner';

// Software detection helper - returns icon and color based on software name or URL
const getSoftwareIcon = (softwareName: string, url: string) => {
  const name = softwareName.toLowerCase();
  const urlLower = url.toLowerCase();
  
  // Figma
  if (name.includes('figma') || urlLower.includes('figma.com')) {
    return { icon: Figma, color: 'text-[#F24E1E]', bg: 'bg-[#F24E1E]/10' };
  }
  // Google Drive
  if (name.includes('drive') || name.includes('google') || urlLower.includes('drive.google') || urlLower.includes('docs.google')) {
    return { icon: FolderOpen, color: 'text-[#4285F4]', bg: 'bg-[#4285F4]/10' };
  }
  // Google Sheets
  if (name.includes('sheet') || urlLower.includes('sheets.google')) {
    return { icon: FileSpreadsheet, color: 'text-[#0F9D58]', bg: 'bg-[#0F9D58]/10' };
  }
  // Google Slides
  if (name.includes('slide') || urlLower.includes('slides.google')) {
    return { icon: Presentation, color: 'text-[#F4B400]', bg: 'bg-[#F4B400]/10' };
  }
  // Notion
  if (name.includes('notion') || urlLower.includes('notion.so') || urlLower.includes('notion.site')) {
    return { icon: FileText, color: 'text-foreground', bg: 'bg-foreground/10' };
  }
  // Slack
  if (name.includes('slack') || urlLower.includes('slack.com')) {
    return { icon: MessageSquare, color: 'text-[#4A154B]', bg: 'bg-[#4A154B]/10' };
  }
  // Trello
  if (name.includes('trello') || urlLower.includes('trello.com')) {
    return { icon: Trello, color: 'text-[#0079BF]', bg: 'bg-[#0079BF]/10' };
  }
  // GitHub
  if (name.includes('github') || urlLower.includes('github.com')) {
    return { icon: Github, color: 'text-foreground', bg: 'bg-foreground/10' };
  }
  // GitLab
  if (name.includes('gitlab') || urlLower.includes('gitlab.com')) {
    return { icon: Gitlab, color: 'text-[#FC6D26]', bg: 'bg-[#FC6D26]/10' };
  }
  // YouTube / Vimeo
  if (name.includes('youtube') || name.includes('vimeo') || urlLower.includes('youtube.com') || urlLower.includes('vimeo.com')) {
    return { icon: Video, color: 'text-[#FF0000]', bg: 'bg-[#FF0000]/10' };
  }
  // Dropbox
  if (name.includes('dropbox') || urlLower.includes('dropbox.com')) {
    return { icon: Box, color: 'text-[#0061FF]', bg: 'bg-[#0061FF]/10' };
  }
  // Adobe Creative Cloud
  if (name.includes('adobe') || name.includes('creative cloud') || urlLower.includes('adobe.com')) {
    return { icon: PenTool, color: 'text-[#FF0000]', bg: 'bg-[#FF0000]/10' };
  }
  // Miro
  if (name.includes('miro') || urlLower.includes('miro.com')) {
    return { icon: Box, color: 'text-[#FFD02F]', bg: 'bg-[#FFD02F]/10' };
  }
  // Airtable
  if (name.includes('airtable') || urlLower.includes('airtable.com')) {
    return { icon: Database, color: 'text-[#18BFFF]', bg: 'bg-[#18BFFF]/10' };
  }
  // WeTransfer
  if (name.includes('wetransfer') || urlLower.includes('wetransfer.com') || urlLower.includes('we.tl')) {
    return { icon: Cloud, color: 'text-[#409FFF]', bg: 'bg-[#409FFF]/10' };
  }
  // Spotify / SoundCloud (audio)
  if (name.includes('spotify') || name.includes('soundcloud') || urlLower.includes('spotify.com') || urlLower.includes('soundcloud.com')) {
    return { icon: Music, color: 'text-[#1DB954]', bg: 'bg-[#1DB954]/10' };
  }
  // Default - generic link
  return { icon: Globe, color: 'text-muted-foreground', bg: 'bg-muted' };
};

export interface ResourceLink {
  id: string;
  project_id: string;
  software_name: string;
  file_name: string;
  url: string;
  created_by: string;
  created_at: string;
}

interface ResourceLinksPanelProps {
  projectId: string;
  resourceLinks: ResourceLink[];
  readOnly?: boolean;
  onRefresh: () => void;
}

export function ResourceLinksPanel({
  projectId,
  resourceLinks,
  readOnly = false,
  onRefresh,
}: ResourceLinksPanelProps) {
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ softwareName: '', fileName: '', url: '' });
  const [addingLink, setAddingLink] = useState(false);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);

  const handleAddLink = async () => {
    if (!linkForm.softwareName.trim() || !linkForm.fileName.trim() || !linkForm.url.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    
    // Validate URL
    try {
      new URL(linkForm.url.trim());
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    
    setAddingLink(true);
    
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error('Not authenticated');
      
      const { error } = await (supabase as any)
        .from('project_resource_links')
        .insert({
          project_id: projectId,
          software_name: linkForm.softwareName.trim(),
          file_name: linkForm.fileName.trim(),
          url: linkForm.url.trim(),
          created_by: userData.user.id,
        });
      
      if (error) throw error;
      
      toast.success('Link added successfully');
      setAddLinkOpen(false);
      setLinkForm({ softwareName: '', fileName: '', url: '' });
      onRefresh();
    } catch (error: any) {
      console.error('Add link error:', error);
      toast.error(error.message || 'Failed to add link');
    } finally {
      setAddingLink(false);
    }
  };
  
  const handleDeleteLink = async (linkId: string) => {
    if (readOnly) return;
    setDeletingLink(linkId);
    
    try {
      const { error } = await (supabase as any)
        .from('project_resource_links')
        .delete()
        .eq('id', linkId);
      
      if (error) throw error;
      
      toast.success('Link deleted');
      onRefresh();
    } catch (error: any) {
      console.error('Delete link error:', error);
      toast.error(error.message || 'Failed to delete link');
    } finally {
      setDeletingLink(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <LinkIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Resource Links</CardTitle>
                <CardDescription className="text-xs">Quick access to project files and tools</CardDescription>
              </div>
            </div>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddLinkOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Link
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {resourceLinks.length === 0 ? (
            <div className="text-center py-8">
              <LinkIcon className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {readOnly ? 'No resource links available' : 'Add links to project files like Figma, Google Drive, Notion, etc.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {resourceLinks.map((link) => {
                const { icon: SoftwareIcon, color, bg } = getSoftwareIcon(link.software_name, link.url);
                return (
                  <div
                    key={link.id}
                    className="flex items-center gap-4 py-3 group"
                  >
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center shrink-0`}>
                      <SoftwareIcon className={`w-5 h-5 ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{link.file_name}</p>
                      <p className="text-xs text-muted-foreground">{link.software_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gap-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open
                        </a>
                      </Button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          disabled={deletingLink === link.id}
                          onClick={() => handleDeleteLink(link.id)}
                        >
                          {deletingLink === link.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Link Dialog */}
      <Dialog open={addLinkOpen} onOpenChange={setAddLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Resource Link</DialogTitle>
            <DialogDescription>
              Add a link to an external resource like Figma, Google Drive, or Notion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="software-name">Software / Platform</Label>
              <Input
                id="software-name"
                placeholder="e.g., Figma, Google Drive, Notion"
                value={linkForm.softwareName}
                onChange={(e) => setLinkForm(f => ({ ...f, softwareName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-name">File / Document Name</Label>
              <Input
                id="file-name"
                placeholder="e.g., Main Design File, Project Assets"
                value={linkForm.fileName}
                onChange={(e) => setLinkForm(f => ({ ...f, fileName: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                type="url"
                placeholder="https://..."
                value={linkForm.url}
                onChange={(e) => setLinkForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLink} disabled={addingLink}>
              {addingLink && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
