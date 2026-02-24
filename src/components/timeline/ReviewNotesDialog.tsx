import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ReviewNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentId: string;
  taskName: string;
  initialNotes: string;
  onSaved: (segmentId: string, notes: string) => void;
}

export function ReviewNotesDialog({
  open,
  onOpenChange,
  segmentId,
  taskName,
  initialNotes,
  onSaved,
}: ReviewNotesDialogProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNotes(initialNotes);
  }, [open, initialNotes]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('task_segments')
      .update({ review_notes: notes || null } as any)
      .eq('id', segmentId);

    setSaving(false);
    if (error) {
      toast.error('Failed to save review notes');
      return;
    }
    toast.success('Review notes saved');
    onSaved(segmentId, notes);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Instructions</DialogTitle>
          <DialogDescription>
            Write what the client should review for "{taskName}"
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Please review the 3D model textures and provide feedback on lighting and color grading..."
          className="min-h-[120px]"
        />
        <div className="text-xs text-muted-foreground text-right">
          {notes.length} characters
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
