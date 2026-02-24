import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { format } from 'date-fns';

interface ReviewNotesViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  reviewNotes: string;
  startDate?: string;
  endDate?: string;
}

export function ReviewNotesViewDialog({
  open,
  onOpenChange,
  taskName,
  reviewNotes,
  startDate,
  endDate,
}: ReviewNotesViewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Instructions</DialogTitle>
          <DialogDescription>
            {taskName}
            {startDate && endDate && (
              <span className="ml-2 text-xs">
                ({format(new Date(startDate), 'MMM d')} → {format(new Date(endDate), 'MMM d')})
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm text-foreground leading-relaxed py-2">
          {reviewNotes}
        </div>
        <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-2">
          If you have questions about this review, please contact your project manager.
        </p>
      </DialogContent>
    </Dialog>
  );
}
