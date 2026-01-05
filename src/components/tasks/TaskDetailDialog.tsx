import { useState, useEffect } from 'react';
import { Task, Phase } from '@/types/database';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AttachmentLinksEditor } from './AttachmentLinksEditor';
import { generateNarrative } from '@/lib/narrativeGenerator';
import { 
  Loader2, 
  Sparkles, 
  Flag, 
  Users, 
  Calendar,
  Link2,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TaskDetailDialogProps {
  task: Task | null;
  phase: Phase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TaskDetailDialog({
  task,
  phase,
  open,
  onOpenChange,
  onUpdate,
}: TaskDetailDialogProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [narrativeText, setNarrativeText] = useState('');
  const [clientVisible, setClientVisible] = useState(true);
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (task) {
      setNarrativeText(task.narrative_text || '');
      setClientVisible(task.client_visible);
      setDescription(task.description || '');
    }
  }, [task]);

  const handleGenerateNarrative = () => {
    if (!task || !phase) return;

    const durationDays = task.start_date && task.end_date
      ? Math.max(1, Math.ceil(
          (new Date(task.end_date).getTime() - new Date(task.start_date).getTime()) / (1000 * 60 * 60 * 24)
        ) + 1)
      : 1;

    const narrative = generateNarrative({
      stepName: task.name,
      phaseCategory: phase.name as any,
      taskType: task.task_type as 'task' | 'milestone' | 'meeting',
      reviewRounds: task.review_rounds || 0,
      durationDays,
      isClientVisible: clientVisible,
    });

    setNarrativeText(narrative.fullNarrative);
  };

  const handleSave = async () => {
    if (!task) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          narrative_text: narrativeText,
          client_visible: clientVisible,
          description,
        })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: 'Task updated',
        description: 'Changes saved successfully.',
      });

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {task.task_type === 'milestone' && (
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Flag className="w-5 h-5 text-amber-500" />
              </div>
            )}
            {task.task_type === 'meeting' && (
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="w-5 h-5 text-primary" />
              </div>
            )}
            {task.task_type === 'task' && (
              <div className="p-2 rounded-lg bg-muted">
                <Calendar className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              <DialogTitle className="text-xl">{task.name}</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                {phase && (
                  <Badge variant="outline" className="text-xs">
                    {phase.name}
                  </Badge>
                )}
                <Badge variant="secondary" className="text-xs capitalize">
                  {task.task_type}
                </Badge>
                {task.start_date && task.end_date && (
                  <span className="text-xs">
                    {format(new Date(task.start_date), 'MMM d')} - {format(new Date(task.end_date), 'MMM d, yyyy')}
                  </span>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details" className="gap-2">
              <FileText className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-2">
              <Link2 className="w-4 h-4" />
              Links
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto mt-4">
            <TabsContent value="details" className="space-y-4 mt-0">
              {/* Client Visibility Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <Label className="font-medium">Client Visible</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Show this task in the client portal
                  </p>
                </div>
                <Switch
                  checked={clientVisible}
                  onCheckedChange={setClientVisible}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Internal Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Internal notes about this task..."
                  className="min-h-[80px]"
                />
              </div>

              {/* Narrative Text */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="narrative">Client Narrative</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateNarrative}
                    className="gap-1.5 text-xs"
                  >
                    <Sparkles className="w-3 h-3" />
                    Auto-generate
                  </Button>
                </div>
                <Textarea
                  id="narrative"
                  value={narrativeText}
                  onChange={(e) => setNarrativeText(e.target.value)}
                  placeholder="What clients will see about this step..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This text is shown to clients explaining the objective, what they need to provide, and expected turnaround.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="links" className="mt-0">
              <AttachmentLinksEditor taskId={task.id} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
