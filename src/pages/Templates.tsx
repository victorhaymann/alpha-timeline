import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { StepTemplate } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  LayoutTemplate, 
  Search,
  Flag,
  Users,
  RotateCcw,
  Loader2,
  Trash2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  'Pre-Production': 'bg-phase-preproduction/20 text-phase-preproduction border-phase-preproduction/30',
  'Production': 'bg-phase-production/20 text-phase-production border-phase-production/30',
  'Post-Production': 'bg-phase-postproduction/20 text-phase-postproduction border-phase-postproduction/30',
  'Delivery': 'bg-phase-delivery/20 text-phase-delivery border-phase-delivery/30',
};

export default function Templates() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<StepTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    default_percentage: 0,
    category: 'Production',
    is_milestone: false,
    is_feedback_meeting: false,
    default_review_rounds: 0,
  });

  useEffect(() => {
    if (user) {
      fetchTemplates();
    }
  }, [user]);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('step_templates')
        .select('*')
        .order('category', { ascending: true });

      if (error) throw error;
      setTemplates((data as StepTemplate[]) || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!user || !newTemplate.name.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('step_templates')
        .insert({
          ...newTemplate,
          owner_id: user.id,
        });

      if (error) throw error;

      toast({
        title: 'Template created!',
        description: 'Your step template has been saved.',
      });

      setIsDialogOpen(false);
      setNewTemplate({
        name: '',
        description: '',
        default_percentage: 0,
        category: 'Production',
        is_milestone: false,
        is_feedback_meeting: false,
        default_review_rounds: 0,
      });
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedTemplates = filteredTemplates.reduce((acc, template) => {
    const category = template.category || 'Uncategorized';
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {} as Record<string, StepTemplate[]>);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Step Templates</h1>
          <p className="text-muted-foreground mt-1">
            Pre-registered steps for quick project setup
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Step Template</DialogTitle>
              <DialogDescription>
                Define a reusable step for your VFX projects.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Name *</Label>
                <Input
                  id="template-name"
                  placeholder="e.g., Concept Art Review"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template-desc">Description</Label>
                <Input
                  id="template-desc"
                  placeholder="Brief description..."
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="template-pct">Default %</Label>
                  <Input
                    id="template-pct"
                    type="number"
                    min={0}
                    max={100}
                    value={newTemplate.default_percentage}
                    onChange={(e) => setNewTemplate({ ...newTemplate, default_percentage: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="template-cat">Category</Label>
                  <select
                    id="template-cat"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  >
                    <option value="Pre-Production">Pre-Production</option>
                    <option value="Production">Production</option>
                    <option value="Post-Production">Post-Production</option>
                    <option value="Delivery">Delivery</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-milestone"
                    checked={newTemplate.is_milestone}
                    onCheckedChange={(checked) => 
                      setNewTemplate({ ...newTemplate, is_milestone: checked as boolean })
                    }
                  />
                  <Label htmlFor="is-milestone" className="flex items-center gap-2 cursor-pointer">
                    <Flag className="w-4 h-4 text-status-review" />
                    Mark as Milestone
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is-feedback"
                    checked={newTemplate.is_feedback_meeting}
                    onCheckedChange={(checked) => 
                      setNewTemplate({ ...newTemplate, is_feedback_meeting: checked as boolean })
                    }
                  />
                  <Label htmlFor="is-feedback" className="flex items-center gap-2 cursor-pointer">
                    <Users className="w-4 h-4 text-primary" />
                    Feedback Meeting
                  </Label>
                </div>
              </div>
              {newTemplate.is_feedback_meeting && (
                <div className="space-y-2">
                  <Label htmlFor="review-rounds" className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                    Default Review Rounds
                  </Label>
                  <Input
                    id="review-rounds"
                    type="number"
                    min={0}
                    max={10}
                    value={newTemplate.default_review_rounds}
                    onChange={(e) => setNewTemplate({ ...newTemplate, default_review_rounds: parseInt(e.target.value) || 0 })}
                  />
                </div>
              )}
              <Button 
                onClick={handleCreateTemplate} 
                disabled={isSubmitting || !newTemplate.name.trim()}
                className="w-full"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Template'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : Object.keys(groupedTemplates).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
            <div key={category} className="space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={cn(categoryColors[category] || 'bg-muted')}
                >
                  {category}
                </Badge>
                <span className="text-muted-foreground font-normal text-sm">
                  {categoryTemplates.length} template{categoryTemplates.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {categoryTemplates.map((template) => (
                  <Card key={template.id} className="group hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{template.name}</CardTitle>
                        <div className="flex gap-1">
                          {template.is_milestone && (
                            <Flag className="w-4 h-4 text-status-review" />
                          )}
                          {template.is_feedback_meeting && (
                            <Users className="w-4 h-4 text-primary" />
                          )}
                        </div>
                      </div>
                      {template.description && (
                        <CardDescription className="line-clamp-2">
                          {template.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {template.default_percentage}% allocation
                        </span>
                        {template.default_review_rounds > 0 && (
                          <span className="text-muted-foreground">
                            {template.default_review_rounds} review{template.default_review_rounds !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <LayoutTemplate className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-sm">
              Create reusable step templates for faster project setup.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Template
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
