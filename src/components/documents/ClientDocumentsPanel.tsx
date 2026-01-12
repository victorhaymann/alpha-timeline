import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  BookOpen,
  Image,
  Type,
  Palette,
  FileText,
  Sparkles,
  Upload,
  Loader2,
  Download,
  Eye,
  Trash2,
  Plus,
  Link as LinkIcon,
  ExternalLink,
  File,
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

// Document categories - updated Templates -> Client Brief, Photography -> Artistic Direction
const DOCUMENT_CATEGORIES = [
  { id: 'brandbook', label: 'Brandbook', icon: BookOpen, accept: '.pdf,.pptx', description: 'Brand guidelines and style guides' },
  { id: 'logos', label: 'Logos', icon: Image, accept: '.png,.jpg,.jpeg,.svg,.pdf', description: 'Logo files in various formats' },
  { id: 'fonts', label: 'Fonts', icon: Type, accept: '.otf,.ttf,.woff,.woff2', description: 'Typography files' },
  { id: 'color_palettes', label: 'Color Palettes', icon: Palette, accept: '.pdf,.png,.jpg,.jpeg', description: 'Color specifications' },
  { id: 'client_brief', label: 'Client Brief', icon: FileText, accept: '.pdf,.docx,.pptx,.txt', description: 'Project briefs and requirements' },
  { id: 'artistic_direction', label: 'Artistic Direction', icon: Sparkles, accept: '.pdf,.png,.jpg,.jpeg,.pptx', description: 'Visual direction and moodboards' },
] as const;

type CategoryId = typeof DOCUMENT_CATEGORIES[number]['id'];

export interface ClientDocument {
  id: string;
  project_id: string;
  category: string;
  name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ResourceLink {
  id: string;
  project_id: string;
  software_name: string;
  file_name: string;
  url: string;
  created_by: string;
  created_at: string;
}

interface ClientDocumentsPanelProps {
  projectId: string;
  documents: ClientDocument[];
  resourceLinks?: ResourceLink[];
  readOnly?: boolean;
  canUpload?: boolean; // Allow uploads even when readOnly (for clients via share link)
  onRefresh: () => void;
  onRefreshLinks?: () => void;
  shareToken?: string;
}

export function ClientDocumentsPanel({
  projectId,
  documents,
  resourceLinks = [],
  readOnly = false,
  canUpload = true, // Default to true - uploads allowed unless explicitly disabled
  onRefresh,
  onRefreshLinks,
}: ClientDocumentsPanelProps) {
  const [uploading, setUploading] = useState<CategoryId | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<ClientDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  // Add link dialog state
  const [addLinkOpen, setAddLinkOpen] = useState(false);
  const [linkForm, setLinkForm] = useState({ softwareName: '', fileName: '', url: '' });
  const [addingLink, setAddingLink] = useState(false);
  const [deletingLink, setDeletingLink] = useState<string | null>(null);

  const getDocumentsByCategory = (categoryId: string) => {
    return documents.filter(doc => doc.category === categoryId);
  };

  const isPreviewable = (mimeType: string | null, name: string): boolean => {
    if (mimeType?.startsWith('image/')) return true;
    if (mimeType === 'application/pdf') return true;
    const ext = name.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'svg', 'pdf'].includes(ext || '');
  };

  const handleFileSelect = async (category: CategoryId, files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(category);

    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${projectId}/${category}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('client-documents')
          .upload(filePath, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        const { data: { user } } = await supabase.auth.getUser();

        const { error: dbError } = await (supabase as any)
          .from('client_documents')
          .insert({
            project_id: projectId,
            category,
            name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user?.id || null,
          });

        if (dbError) {
          console.error('DB error:', dbError);
          await supabase.storage.from('client-documents').remove([filePath]);
          toast.error(`Failed to save ${file.name}: ${dbError.message}`);
          continue;
        }

        toast.success(`Uploaded ${file.name}`);
      }

      onRefresh();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file(s)');
    } finally {
      setUploading(null);
      const input = fileInputRefs.current[category];
      if (input) input.value = '';
    }
  };

  const handleDelete = async (doc: ClientDocument) => {
    if (!confirm(`Delete "${doc.name}"? This cannot be undone.`)) return;

    setDeleting(doc.id);

    try {
      const { error: storageError } = await supabase.storage
        .from('client-documents')
        .remove([doc.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
      }

      const { error: dbError } = await (supabase as any)
        .from('client_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) {
        console.error('DB delete error:', dbError);
        toast.error(`Failed to delete: ${dbError.message}`);
        return;
      }

      toast.success('File deleted');
      onRefresh();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async (doc: ClientDocument) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);

    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 3600);

      if (error) {
        console.error('Preview URL error:', error);
        toast.error('Failed to load preview');
        setPreviewDoc(null);
        return;
      }

      setPreviewUrl(data.signedUrl);
    } catch (err) {
      console.error('Preview error:', err);
      toast.error('Failed to load preview');
      setPreviewDoc(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleDownload = async (doc: ClientDocument) => {
    try {
      const { data, error } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(doc.file_path, 60);

      if (error) {
        console.error('Download URL error:', error);
        toast.error('Failed to generate download link');
        return;
      }

      const link = document.createElement('a');
      link.href = data.signedUrl;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    }
  };

  const closePreview = () => {
    setPreviewDoc(null);
    setPreviewUrl(null);
  };
  
  // Resource Links handlers
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
      onRefreshLinks?.();
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
      onRefreshLinks?.();
    } catch (error: any) {
      console.error('Delete link error:', error);
      toast.error(error.message || 'Failed to delete link');
    } finally {
      setDeletingLink(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Document Categories */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {DOCUMENT_CATEGORIES.map((category) => {
          const categoryDocs = getDocumentsByCategory(category.id);
          const Icon = category.icon;
          const isUploading = uploading === category.id;

          return (
            <Card key={category.id} className={categoryDocs.length === 0 ? "border-dashed" : ""}>
              {/* Hidden file input */}
              <input
                type="file"
                ref={(el) => { fileInputRefs.current[category.id] = el; }}
                accept={category.accept}
                multiple
                className="hidden"
                onChange={(e) => handleFileSelect(category.id, e.target.files)}
              />

              {categoryDocs.length === 0 ? (
                /* Empty state */
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <Icon className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1">{category.label}</h3>
                  <p className="text-xs text-muted-foreground text-center mb-4 max-w-[180px]">
                    {category.description}
                  </p>
                  {canUpload && (
                    <Button 
                      size="sm" 
                      onClick={() => fileInputRefs.current[category.id]?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Import
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              ) : (
                /* Has documents */
                <>
                  <CardHeader className="flex flex-row items-center justify-between py-3 px-4">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      {category.label}
                    </CardTitle>
                    {canUpload && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => fileInputRefs.current[category.id]?.click()}
                        disabled={isUploading}
                        className="h-7 text-xs"
                      >
                        {isUploading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Upload className="w-3 h-3 mr-1" />
                            Import
                          </>
                        )}
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0 px-4 pb-4">
                    <div className="space-y-1">
                      {categoryDocs.map((doc) => {
                        const canPreview = isPreviewable(doc.mime_type, doc.name);
                        const isDeleting = deleting === doc.id;

                        return (
                          <div 
                            key={doc.id} 
                            className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
                          >
                            <File className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="flex-1 text-sm truncate" title={doc.name}>
                              {doc.name}
                            </span>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canPreview && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7"
                                  onClick={() => handlePreview(doc)}
                                  title="Preview"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7"
                                onClick={() => handleDownload(doc)}
                                title="Download"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                              {!readOnly && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDelete(doc)}
                                  disabled={isDeleting}
                                  title="Delete"
                                >
                                  {isDeleting ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </>
              )}
            </Card>
          );
        })}
      </div>

      {/* Resource Links Section */}
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
                          className="h-8 w-8 text-destructive hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
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

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 border-b flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="truncate pr-4">
                {previewDoc?.name}
              </DialogTitle>
              <div className="flex items-center gap-2">
                {previewDoc && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(previewDoc)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-muted/30">
            {loadingPreview ? (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            ) : previewUrl ? (
              previewDoc?.name.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-full border-0 rounded"
                  title={previewDoc?.name}
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={previewDoc?.name}
                  className="max-w-full max-h-full object-contain rounded"
                />
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
