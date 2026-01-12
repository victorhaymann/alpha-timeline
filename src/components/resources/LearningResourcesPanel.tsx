import { useState, useEffect, useCallback } from 'react';
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

// Static placeholder resources shown when no dynamic resources exist
const PLACEHOLDER_RESOURCES = [
  {
    title: 'Getting Started Guide',
    description: 'Learn the basics of timeline management and project setup.',
    icon: BookOpen,
  },
  {
    title: 'Phase Management',
    description: 'Understanding phase weights and task distribution.',
    icon: Layers,
  },
  {
    title: 'Client Collaboration',
    description: 'Share projects and manage client feedback effectively.',
    icon: Users,
  },
];

export function LearningResourcesPanel({ readOnly = false }: LearningResourcesPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
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
    setDeletingId(id);
    try {
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

  // Show placeholder cards if no resources exist
  const showPlaceholders = resources.length === 0;

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
          {showPlaceholders ? (
            // Show placeholder cards with "Coming Soon"
            PLACEHOLDER_RESOURCES.map((placeholder, index) => (
              <div 
                key={index}
                className="block p-4 rounded-lg border border-border bg-muted/30"
              >
                <placeholder.icon className="w-8 h-8 text-muted-foreground mb-3" />
                <h4 className="font-semibold mb-1 text-muted-foreground">{placeholder.title}</h4>
                <p className="text-sm text-muted-foreground">{placeholder.description}</p>
                <Badge variant="outline" className="mt-3 text-xs">Coming Soon</Badge>
              </div>
            ))
          ) : (
            // Show actual resources
            resources.map((resource) => {
              const IconComponent = getIconComponent(resource.icon_type);
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
                  {resource.url ? (
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </a>
                  ) : (
                    <Badge variant="outline" className="mt-3 text-xs">Coming Soon</Badge>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
