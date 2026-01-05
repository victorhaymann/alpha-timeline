import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StepLibrary } from '@/components/steps/StepLibrary';
import { Library, FolderPlus } from 'lucide-react';

export default function Templates() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Step Library</h1>
        <p className="text-muted-foreground mt-1">
          Browse the canonical VFX production steps available for your projects
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
          <StepLibrary readOnly />
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
