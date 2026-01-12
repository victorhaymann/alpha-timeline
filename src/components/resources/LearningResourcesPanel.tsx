import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BookOpen,
  Layers,
  Users,
  Video,
  FileText,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  GraduationCap,
  Lightbulb,
  Compass,
  Upload,
  Download,
  Eye,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LearningResource {
  id: string;
  title: string;
  description: string;
  url: string | null;
  icon_type: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
}

interface LearningResourcesPanelProps {
  readOnly?: boolean;
}

const ICON_OPTIONS = [
  { value: 'book', label: 'Book', icon: BookOpen },
  { value: 'layers', label: 'Layers', icon: Layers },
  { value: 'users', label: 'Users', icon: Users },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'file', label: 'Document', icon: FileText },
  { value: 'graduation', label: 'Graduation', icon: GraduationCap },
  { value: 'lightbulb', label: 'Lightbulb', icon: Lightbulb },
  { value: 'compass', label: 'Compass', icon: Compass },
];

const getIconComponent = (iconType: string) => {
  const iconOption = ICON_OPTIONS.find(opt => opt.value === iconType);
  return iconOption?.icon || BookOpen;
};

// Placeholder resource templates - these can be uploaded to
const PLACEHOLDER_RESOURCES = [
  {
    key: 'getting-started',
    title: 'Getting Started Guide',
    description: 'Learn the basics of timeline management and project setup.',
    icon: BookOpen,
    icon_type: 'book',
  },
  {
    key: 'phase-management',
    title: 'Phase Management',
    description: 'Understanding phase weights and task distribution.',
    icon: Layers,
    icon_type: 'layers',
  },
  {
    key: 'client-collaboration',
    title: 'Client Collaboration',
    description: 'Share projects and manage client feedback effectively.',
    icon: Users,
    icon_type: 'users',
  },
];

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function LearningResourcesPanel({ readOnly = false }: LearningResourcesPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    icon_type: 'book',
  });

  const fetchResources = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('learning_resources')
        .select('*')
        .order('sort_order')
        .order('created_at');

      if (error) throw error;
      setResources((data as LearningResource[]) || []);
    } catch (error) {
      console.error('Error fetching learning resources:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleAdd = async () => {
    if (!formData.title.trim() || !formData.description.trim() || !user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('learning_resources')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim(),
          url: formData.url.trim() || null,
          icon_type: formData.icon_type,
          sort_order: resources.length,
          created_by: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Resource added',
        description: 'The learning resource has been created.',
      });

      setFormData({ title: '', description: '', url: '', icon_type: 'book' });
      setDialogOpen(false);
      fetchResources();
    } catch (error: any) {
      console.error('Error adding resource:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to add resource.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const resource = resources.find(r => r.id === id);
    setDeletingId(id);
    try {
      // Delete file from storage if exists
      if (resource?.file_path) {
        await supabase.storage
          .from('learning-resources')
          .remove([resource.file_path]);
      }

      const { error } = await supabase
        .from('learning_resources')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Resource deleted',
        description: 'The learning resource has been removed.',
      });

      fetchResources();
    } catch (error: any) {
      console.error('Error deleting resource:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete resource.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Handle file upload for placeholder resources
  const handlePlaceholderUpload = async (placeholderKey: string, file: File) => {
    if (!user) return;

    const placeholder = PLACEHOLDER_RESOURCES.find(p => p.key === placeholderKey);
    if (!placeholder) return;

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF or PPTX file.',
        variant: 'destructive',
      });
      return;
    }

    setUploadingKey(placeholderKey);
    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `${placeholderKey}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('learning-resources')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Check if resource already exists for this placeholder
      const existingResource = resources.find(r => 
        r.title === placeholder.title && r.icon_type === placeholder.icon_type
      );

      if (existingResource) {
        // Delete old file if exists
        if (existingResource.file_path) {
          await supabase.storage
            .from('learning-resources')
            .remove([existingResource.file_path]);
        }

        // Update existing resource
        const { error } = await supabase
          .from('learning_resources')
          .update({
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          })
          .eq('id', existingResource.id);

        if (error) throw error;
      } else {
        // Create new resource
        const { error } = await supabase
          .from('learning_resources')
          .insert({
            title: placeholder.title,
            description: placeholder.description,
            icon_type: placeholder.icon_type,
            sort_order: PLACEHOLDER_RESOURCES.findIndex(p => p.key === placeholderKey),
            created_by: user.id,
            file_path: filePath,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
          });

        if (error) throw error;
      }

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      });

      fetchResources();
    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload file.',
        variant: 'destructive',
      });
    } finally {
      setUploadingKey(null);
    }
  };

  const handleFileChange = (placeholderKey: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePlaceholderUpload(placeholderKey, file);
    }
    // Reset input
    e.target.value = '';
  };

  const handleRemoveFile = async (resourceId: string, filePath: string) => {
    try {
      // Remove from storage
      await supabase.storage
        .from('learning-resources')
        .remove([filePath]);

      // Update resource to remove file info
      const { error } = await supabase
        .from('learning_resources')
        .update({
          file_path: null,
          file_name: null,
          file_size: null,
          mime_type: null,
        })
        .eq('id', resourceId);

      if (error) throw error;

      toast({
        title: 'File removed',
        description: 'The file has been removed.',
      });

      fetchResources();
    } catch (error: any) {
      console.error('Error removing file:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove file.',
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async (filePath: string, fileName: string) => {
    try {
      const { data } = supabase.storage
        .from('learning-resources')
        .getPublicUrl(filePath);

      setPreviewUrl(data.publicUrl);
      setPreviewName(fileName);
    } catch (error) {
      console.error('Error getting preview URL:', error);
    }
  };

  const handleDownload = (filePath: string) => {
    const { data } = supabase.storage
      .from('learning-resources')
      .getPublicUrl(filePath);

    window.open(data.publicUrl, '_blank');
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Learning Resources</CardTitle>
          <CardDescription>
            Helpful guides and materials to support your project workflow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Build display items: merge placeholders with actual resources
  const displayItems = PLACEHOLDER_RESOURCES.map(placeholder => {
    const existingResource = resources.find(r => 
      r.title === placeholder.title && r.icon_type === placeholder.icon_type
    );
    return {
      ...placeholder,
      resource: existingResource || null,
    };
  });

  // Get additional custom resources (not matching placeholders)
  const customResources = resources.filter(r => 
    !PLACEHOLDER_RESOURCES.some(p => p.title === r.title && p.icon_type === r.icon_type)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Learning Resources</CardTitle>
            <CardDescription>
              Helpful guides and materials to support your project workflow.
            </CardDescription>
          </div>
          {!readOnly && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Resource
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Learning Resource</DialogTitle>
                  <DialogDescription>
                    Create a new learning resource that will be visible across all projects.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="resource-title">Title</Label>
                    <Input
                      id="resource-title"
                      placeholder="e.g., Getting Started Guide"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resource-description">Description</Label>
                    <Textarea
                      id="resource-description"
                      placeholder="A brief description of the resource..."
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="resource-url">URL (optional)</Label>
                    <Input
                      id="resource-url"
                      type="url"
                      placeholder="https://..."
                      value={formData.url}
                      onChange={(e) => setFormData(prev => ({ ...prev, url: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Icon</Label>
                    <Select
                      value={formData.icon_type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, icon_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ICON_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            <div className="flex items-center gap-2">
                              <opt.icon className="w-4 h-4" />
                              <span>{opt.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    disabled={saving || !formData.title.trim() || !formData.description.trim()}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Add Resource'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Placeholder-based items */}
          {displayItems.map((item) => {
            const hasFile = !!item.resource?.file_path;
            const isUploading = uploadingKey === item.key;
            
            return (
              <div
                key={item.key}
                className="relative group p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                {/* Hidden file input */}
                {!readOnly && (
                  <input
                    type="file"
                    ref={(el) => { fileInputRefs.current[item.key] = el; }}
                    onChange={handleFileChange(item.key)}
                    accept=".pdf,.pptx,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="hidden"
                  />
                )}

                {/* Delete/Remove buttons for admin */}
                {!readOnly && hasFile && item.resource && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveFile(item.resource!.id, item.resource!.file_path!)}
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}

                <item.icon className={`w-8 h-8 mb-3 ${hasFile ? 'text-primary' : 'text-muted-foreground'}`} />
                <h4 className={`font-semibold mb-1 ${hasFile ? '' : 'text-muted-foreground'}`}>
                  {item.title}
                </h4>
                <p className="text-sm text-muted-foreground">{item.description}</p>

                {hasFile && item.resource?.file_name && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {item.resource.file_name} ({formatFileSize(item.resource.file_size)})
                  </p>
                )}

                <div className="mt-3 flex items-center gap-2">
                  {hasFile ? (
                    <>
                      {/* View/Download buttons */}
                      {item.resource?.mime_type === 'application/pdf' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => handlePreview(item.resource!.file_path!, item.resource!.file_name!)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => handleDownload(item.resource!.file_path!)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      )}
                      {/* Replace button for admin */}
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => fileInputRefs.current[item.key]?.click()}
                          disabled={isUploading}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Replace
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      {!readOnly ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => fileInputRefs.current[item.key]?.click()}
                          disabled={isUploading}
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              Upload PDF/PPTX
                            </>
                          )}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {/* Custom resources (not matching placeholders) */}
          {customResources.map((resource) => {
            const IconComponent = getIconComponent(resource.icon_type);
            const hasFile = !!resource.file_path;
            
            return (
              <div
                key={resource.id}
                className="relative group p-4 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(resource.id)}
                    disabled={deletingId === resource.id}
                  >
                    {deletingId === resource.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                )}
                <IconComponent className="w-8 h-8 text-primary mb-3" />
                <h4 className="font-semibold mb-1">{resource.title}</h4>
                <p className="text-sm text-muted-foreground">{resource.description}</p>
                
                {hasFile && resource.file_name && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {resource.file_name} ({formatFileSize(resource.file_size)})
                  </p>
                )}

                <div className="mt-3">
                  {hasFile ? (
                    <div className="flex items-center gap-2">
                      {resource.mime_type === 'application/pdf' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => handlePreview(resource.file_path!, resource.file_name!)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 h-7 text-xs"
                          onClick={() => handleDownload(resource.file_path!)}
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </Button>
                      )}
                    </div>
                  ) : resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </a>
                  ) : (
                    <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* PDF Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewName(null); }}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle>{previewName}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 p-4">
            {previewUrl && (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-lg border-0"
                title={previewName || 'PDF Preview'}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
