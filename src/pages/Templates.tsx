import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepLibrary } from '@/components/steps/StepLibrary';
import { AddCanonicalStepDialog } from '@/components/steps/AddCanonicalStepDialog';
import { EditCanonicalStepDialog } from '@/components/steps/EditCanonicalStepDialog';
import { Library, FolderPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CanonicalStep, PhaseCategory } from '@/types/database';

export default function Templates() {
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogPhase, setAddDialogPhase] = useState<PhaseCategory>('Production');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<CanonicalStep | null>(null);

  const handleDeleteCanonicalStep = async (stepId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this step from the library? This will affect all future projects.');
    if (!confirmed) return;

    const { error } = await supabase
      .from('canonical_steps')
      .delete()
      .eq('id', stepId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete step: ' + error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Step deleted',
        description: 'The step has been removed from the library.',
      });
      setRefreshKey(k => k + 1);
    }
  };

  const handleAddCanonicalStep = async (step: {
    name: string;
    description: string;
    phase_category: PhaseCategory;
    task_type: 'task' | 'milestone' | 'meeting';
    is_optional: boolean;
  }) => {
    // Get max sort_order for the phase
    const { data: existingSteps } = await supabase
      .from('canonical_steps')
      .select('sort_order')
      .eq('phase_category', step.phase_category)
      .order('sort_order', { ascending: false })
      .limit(1);

    const maxSortOrder = existingSteps?.[0]?.sort_order ?? 0;

    const { error } = await supabase
      .from('canonical_steps')
      .insert({
        name: step.name,
        description: step.description || null,
        phase_category: step.phase_category,
        task_type: step.task_type,
        is_optional: step.is_optional,
        sort_order: maxSortOrder + 1,
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add step: ' + error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Step added',
        description: `${step.name} has been added to ${step.phase_category}.`,
      });
      setRefreshKey(k => k + 1);
    }
  };

  const handleEditCanonicalStep = async (stepId: string, updates: {
    name: string;
    description: string | null;
    phase_category: PhaseCategory;
    task_type: 'task' | 'milestone' | 'meeting';
    is_optional: boolean;
  }) => {
    const { error } = await supabase
      .from('canonical_steps')
      .update(updates)
      .eq('id', stepId);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to update step: ' + error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Step updated',
        description: 'The step has been updated.',
      });
      setRefreshKey(k => k + 1);
    }
  };

  const openAddDialog = (phase: PhaseCategory) => {
    setAddDialogPhase(phase);
    setAddDialogOpen(true);
  };

  const openEditDialog = (step: CanonicalStep) => {
    setEditingStep(step);
    setEditDialogOpen(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Step Library</h1>
        <p className="text-muted-foreground mt-1">
          Manage the canonical VFX production steps available for your projects
        </p>
      </div>

      <Tabs defaultValue="library" className="space-y-6">
        <TabsList>
          <TabsTrigger value="library" className="gap-2">
            <Library className="w-4 h-4" />
            Canonical Library
          </TabsTrigger>
          <TabsTrigger value="custom" className="gap-2">
            <FolderPlus className="w-4 h-4" />
            Custom Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <StepLibrary 
            key={refreshKey}
            readOnly 
            allowLibraryEdit 
            onDeleteCanonicalStep={handleDeleteCanonicalStep}
            onEditCanonicalStep={openEditDialog}
            onAddCanonicalStep={openAddDialog}
          />
        </TabsContent>

        <TabsContent value="custom">
          <div className="text-center py-16 text-muted-foreground">
            <p>Custom project templates coming soon.</p>
            <p className="text-sm mt-2">
              You'll be able to save project configurations as reusable templates.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      <AddCanonicalStepDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={handleAddCanonicalStep}
        defaultPhase={addDialogPhase}
      />

      <EditCanonicalStepDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        step={editingStep}
        onSave={handleEditCanonicalStep}
      />
    </div>
  );
}
