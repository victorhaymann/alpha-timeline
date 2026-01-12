import React from 'react';
import { Task, TaskSegment, SegmentType } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, Layers, Trash2 } from 'lucide-react';

interface TaskPopoverMenuProps {
  task: Task;
  taskSegments: TaskSegment[];
  hoveredSegmentId: string | null;
  onAddSegment?: (taskId: string, position: 'before' | 'after', segmentType?: SegmentType) => void;
  onEditSegments?: (task: Task) => void;
  onConvertSegmentType?: (segmentId: string, newType: SegmentType) => void;
  onDeleteSegment?: (segmentId: string, taskId: string) => void;
  onDeleteTask?: (taskId: string) => void;
  onClose: () => void;
}

export function TaskPopoverMenu({
  task,
  taskSegments,
  hoveredSegmentId,
  onAddSegment,
  onEditSegments,
  onConvertSegmentType,
  onDeleteSegment,
  onDeleteTask,
  onClose,
}: TaskPopoverMenuProps) {
  // Helper to render the convert option
  const renderConvertOption = () => {
    if (!onConvertSegmentType && !onAddSegment) return null;
    
    // Priority: hovered segment > first segment > create initial segment
    const targetSeg = hoveredSegmentId 
      ? taskSegments.find(s => s.id === hoveredSegmentId)
      : taskSegments[0];
    
    if (targetSeg && onConvertSegmentType) {
      const isReview = targetSeg.segment_type === 'review';
      return (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => {
              onConvertSegmentType(targetSeg.id, isReview ? 'work' : 'review');
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
          >
            <RefreshCw className="w-4 h-4" />
            {isReview ? 'Convert to Work Period' : 'Convert to Review'}
          </button>
        </>
      );
    }
    
    // No segments exist - use onAddSegment with 'review' type
    if (onAddSegment) {
      return (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => {
              onAddSegment(task.id, 'after', 'review');
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
          >
            <RefreshCw className="w-4 h-4" />
            Convert to Review
          </button>
        </>
      );
    }
    
    return null;
  };

  return (
    <div className="flex flex-col">
      {onAddSegment && (
        <>
          <button
            onClick={() => {
              onAddSegment(task.id, 'after');
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
          >
            <Plus className="w-4 h-4" />
            Add Period After
          </button>
          <button
            onClick={() => {
              onAddSegment(task.id, 'before');
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
          >
            <Plus className="w-4 h-4" />
            Add Period Before
          </button>
        </>
      )}
      
      {onEditSegments && (
        <>
          <div className="h-px bg-border my-1" />
          <button
            onClick={() => {
              onEditSegments(task);
              onClose();
            }}
            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent hover:text-accent-foreground transition-colors text-left w-full"
          >
            <Layers className="w-4 h-4" />
            Edit Periods...
            <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
              {taskSegments.length}
            </Badge>
          </button>
        </>
      )}
      
      {renderConvertOption()}
      
      {/* Delete Period option - only if multiple segments and one is hovered */}
      {onDeleteSegment && taskSegments.length > 1 && hoveredSegmentId && (
        <button
          onClick={() => {
            onDeleteSegment(hoveredSegmentId, task.id);
            onClose();
          }}
          className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-destructive/10 text-destructive transition-colors text-left w-full"
        >
          <Trash2 className="w-4 h-4" />
          Delete Period
        </button>
      )}
      
      {onDeleteTask && (
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
