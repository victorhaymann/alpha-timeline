import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepLibrary } from '@/components/steps/StepLibrary';
import { Library, FolderPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Templates() {
  const { toast } = useToast();
  const [refreshKey, setRefreshKey] = useState(0);

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
    </div>
  );
}
