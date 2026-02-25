import React from 'react';
import { Task, TaskSegment } from '@/types/database';
import { Trash2, FileText, Plus } from 'lucide-react';

interface TaskPopoverMenuProps {
  task: Task;
  taskSegments: TaskSegment[];
  hoveredSegmentId: string | null;
  onDeleteTask?: (taskId: string) => void;
  onDeleteReviewSegment?: (segmentId: string) => void;
  onEditReviewNotes?: (segmentId: string, taskName: string, currentNotes: string) => void;
  onAddReview?: (taskId: string) => void;
  onClose: () => void;
}

export function TaskPopoverMenu({
  task,
  taskSegments,
  hoveredSegmentId,
  onDeleteTask,
  onDeleteReviewSegment,
  onEditReviewNotes,
  onAddReview,
  onClose,
}: TaskPopoverMenuProps) {
  // Determine if we're hovering a review segment
  const hoveredSeg = hoveredSegmentId ? taskSegments.find(s => s.id === hoveredSegmentId) : null;
  const isReviewHovered = hoveredSeg?.segment_type === 'review';

  return (
    <div className="flex flex-col">
      {/* Edit Review Notes - only for review segments */}
      {onEditReviewNotes && (() => {
        const targetSeg = hoveredSegmentId 
          ? taskSegments.find(s => s.id === hoveredSegmentId)
          : taskSegments.find(s => s.segment_type === 'review');
        if (!targetSeg || targetSeg.segment_type !== 'review') return null;
        return (
          <button
            onClick={() => {
              onEditReviewNotes(targetSeg.id, task.name, targetSeg.review_notes || '');
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
          >
            <FileText className="w-4 h-4" />
            Edit Review Notes...
          </button>
        );
      })()}

      {/* Add Review - shown when not hovering a review segment */}
      {onAddReview && (
        <button
          onClick={() => {
            onAddReview(task.id);
            onClose();
          }}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
        >
          <Plus className="w-4 h-4" />
          Add Review
        </button>
      )}

      {/* Delete Review - only when hovering a review segment */}
      {isReviewHovered && onDeleteReviewSegment && hoveredSeg && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => {
              onDeleteReviewSegment(hoveredSeg.id);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-destructive/10 text-destructive transition-colors text-left w-full"
          >
            <Trash2 className="w-4 h-4" />
            Delete Review
          </button>
        </>
      )}

      {/* Delete Task - only when NOT hovering a review segment */}
      {!isReviewHovered && onDeleteTask && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => {
              onDeleteTask(task.id);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-destructive/10 text-destructive transition-colors text-left w-full"
          >
            <Trash2 className="w-4 h-4" />
            Delete Task
          </button>
        </>
      )}
    </div>
  );
}
