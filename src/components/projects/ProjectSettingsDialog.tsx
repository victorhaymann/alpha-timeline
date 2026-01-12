import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Image } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ProjectSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  projectEndDate: string;
  clientLogoUrl: string | null;
  onSave: (updates: {
    name: string;
    end_date: string;
    client_logo_url: string | null;
  }) => void;
}

export function ProjectSettingsDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  projectEndDate,
  clientLogoUrl,
  onSave,
}: ProjectSettingsDialogProps) {
  const [name, setName] = useState(projectName);
  const [endDate, setEndDate] = useState(projectEndDate);
  const [logoUrl, setLogoUrl] = useState<string | null>(clientLogoUrl);
  const [logoPreview, setLogoPreview] = useState<string | null>(clientLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setName(projectName);
      setEndDate(projectEndDate);
      setLogoUrl(clientLogoUrl);
      setLogoPreview(clientLogoUrl);
    }
    onOpenChange(isOpen);
  };

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (PNG only for transparency)
    if (!file.type.includes('png')) {
      toast.error('Please upload a PNG file for transparency support');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo must be under 2MB');
      return;
    }

    setUploading(true);
    try {
      // Create preview
      const reader = new FileReader();
      reader.onload = (event) => {
        setLogoPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);

      // Upload to storage
      const fileName = `${projectId}/client-logo-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('project-documents')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('project-documents')
        .getPublicUrl(fileName);

      setLogoUrl(urlData.publicUrl);
      toast.success('Logo uploaded');
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast.error('Failed to upload logo');
      setLogoPreview(clientLogoUrl);
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = () => {
    setLogoUrl(null);
    setLogoPreview(null);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (!endDate) {
      toast.error('Deadline is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: name.trim(),
          end_date: endDate,
          client_logo_url: logoUrl,
        })
        .eq('id', projectId);

      if (error) throw error;

      onSave({
        name: name.trim(),
        end_date: endDate,
        client_logo_url: logoUrl,
      });

      toast.success('Project settings saved');
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving project settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Project Settings</DialogTitle>
          <DialogDescription>
            Update project name, deadline, and client logo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
            />
          </div>

          {/* Deadline */}
          <div className="space-y-2">
            <Label htmlFor="project-deadline">Deadline</Label>
            <Input
              id="project-deadline"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Client Logo */}
          <div className="space-y-2">
            <Label>Client Logo (PNG with transparency)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png"
              onChange={handleLogoSelect}
              className="hidden"
            />

            {logoPreview ? (
              <div className="relative w-32 h-32 border border-border rounded-lg overflow-hidden bg-muted/30">
                <img
                  src={logoPreview}
                  alt="Client logo preview"
                  className="w-full h-full object-contain p-2"
                />
                <button
                  onClick={removeLogo}
                  className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                  title="Remove logo"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full h-24 border-dashed flex flex-col items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-sm">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Image className="w-6 h-6 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Click to upload PNG logo
                    </span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
