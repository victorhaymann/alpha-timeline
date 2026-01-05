import { useRef, useState, useCallback, useEffect } from 'react';
import { PHASE_CATEGORY_COLORS, PhaseCategory } from '@/types/database';
import { cn } from '@/lib/utils';
import { format, addDays, differenceInDays, eachDayOfInterval, isWeekend } from 'date-fns';
import { Flag } from 'lucide-react';

// Phases in order (left to right on the bar)
// Only show weightable phases - Delivery is just the end date of Post-Production
const PHASES: PhaseCategory[] = ['Pre-Production', 'Production', 'Post-Production'];

export type PhaseWeightConfig = Record<PhaseCategory, number>;

interface PhaseTimelineSliderProps {
  weights: PhaseWeightConfig;
  onChange: (weights: PhaseWeightConfig) => void;
  startDate?: Date;
  endDate?: Date;
}

// Minimum percentage for any phase
const MIN_PHASE_PERCENT = 1;

export function PhaseTimelineSlider({ 
  weights, 
  onChange,
  startDate,
  endDate 
}: PhaseTimelineSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [draggingHandle, setDraggingHandle] = useState<number | null>(null);
  const [hoverHandle, setHoverHandle] = useState<number | null>(null);

  // Calculate handle positions from weights
  // Handle 0: end of Pre-Production (cumulative: Pre-Production)
  // Handle 1: end of Production (cumulative: Pre-Production + Production)
  // Handle 2: end of Post-Production (cumulative: Pre-Production + Production + Post-Production)
  const getHandlePositions = useCallback(() => {
    let cumulative = 0;
    const positions: number[] = [];
    
    for (let i = 0; i < PHASES.length - 1; i++) {
      cumulative += weights[PHASES[i]] || 0;
      positions.push(cumulative);
    }
    
    return positions;
  }, [weights]);

  const [handlePositions, setHandlePositions] = useState(getHandlePositions);

  // Sync positions when weights change externally
  useEffect(() => {
    if (draggingHandle === null) {
      setHandlePositions(getHandlePositions());
    }
  }, [weights, draggingHandle, getHandlePositions]);

  // Convert handle positions back to weights
  const positionsToWeights = useCallback((positions: number[]): PhaseWeightConfig => {
    const newWeights = { ...weights };
    
    newWeights['Pre-Production'] = Math.max(MIN_PHASE_PERCENT, Math.round(positions[0]));
    newWeights['Production'] = Math.max(MIN_PHASE_PERCENT, Math.round(positions[1] - positions[0]));
    newWeights['Post-Production'] = Math.max(MIN_PHASE_PERCENT, Math.round(100 - positions[1]));
    // Delivery is 0% as it's just a date marker (end of Post-Production)
    newWeights['Delivery'] = 0;
    
    return newWeights;
  }, [weights]);

  // Calculate date for a given percentage position
  const getDateAtPosition = useCallback((percent: number): Date | null => {
    if (!startDate || !endDate) return null;
    const totalDays = differenceInDays(endDate, startDate);
    const daysFromStart = Math.round((percent / 100) * totalDays);
    return addDays(startDate, daysFromStart);
  }, [startDate, endDate]);

  // Handle mouse/touch drag
  const handleDrag = useCallback((clientX: number) => {
    if (draggingHandle === null || !trackRef.current) return;

    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

    setHandlePositions(prev => {
      const newPositions = [...prev];
      
      // Calculate boundaries for this handle
      const minPos = draggingHandle === 0 
        ? MIN_PHASE_PERCENT 
        : prev[draggingHandle - 1] + MIN_PHASE_PERCENT;
      
      // With only 2 handles, handle 1 max is 100 - min
      const maxPos = draggingHandle === 1 
        ? 100 - MIN_PHASE_PERCENT 
        : prev[draggingHandle + 1] - MIN_PHASE_PERCENT;

      newPositions[draggingHandle] = Math.max(minPos, Math.min(maxPos, percent));
      
      return newPositions;
    });
  }, [draggingHandle]);

  // Commit changes on drag end
  const handleDragEnd = useCallback(() => {
    if (draggingHandle !== null) {
      onChange(positionsToWeights(handlePositions));
      setDraggingHandle(null);
    }
  }, [draggingHandle, handlePositions, onChange, positionsToWeights]);

  // Mouse event handlers
  useEffect(() => {
    if (draggingHandle === null) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      handleDrag(e.clientX);
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingHandle, handleDrag, handleDragEnd]);

  // Touch event handlers
  useEffect(() => {
    if (draggingHandle === null) return;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleDrag(e.touches[0].clientX);
      }
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggingHandle, handleDrag, handleDragEnd]);

  // Calculate working days between two dates (Mon-Fri)
  const getWorkingDays = (start: Date | null, end: Date | null): number => {
    if (!start || !end) return 0;
    const days = eachDayOfInterval({ start, end });
    return days.filter(day => !isWeekend(day)).length;
  };

  // Calculate segment widths and dates
  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) : 0;
  
  const segments = PHASES.map((phase, index) => {
    const startPercent = index === 0 ? 0 : handlePositions[index - 1];
    const endPercent = index === PHASES.length - 1 ? 100 : handlePositions[index];
    const width = endPercent - startPercent;
    
    // Calculate dates for this segment
    const segmentStartDate = startDate ? addDays(startDate, Math.round((startPercent / 100) * totalDays)) : null;
    const segmentEndDate = endDate ? addDays(startDate!, Math.round((endPercent / 100) * totalDays)) : null;
    
    // Calculate working days
    const workingDays = getWorkingDays(segmentStartDate, segmentEndDate);
    
    return {
      phase,
      width,
      startPercent,
      endPercent,
      color: PHASE_CATEGORY_COLORS[phase],
      segmentStartDate,
      segmentEndDate,
      workingDays,
    };
  });

  // Format date range for display
  const formatDateRange = (start: Date | null, end: Date | null, workingDays: number, width: number): string => {
    if (!start || !end) return '';
    
    // For narrow segments, show abbreviated format
    if (width < 20) {
      return `${format(start, 'MMM d')} (${workingDays}d)`;
    }
    
    // For wider segments, show full range with working days
    return `${format(start, 'MMM d')} – ${format(end, 'MMM d')} (${workingDays}d)`;
  };

  return (
    <div className="space-y-4">
      {/* Date labels */}
      {startDate && endDate && (
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{format(startDate, 'MMM d, yyyy')}</span>
          <span>{format(endDate, 'MMM d, yyyy')}</span>
        </div>
      )}

      {/* Main slider track */}
      <div className="relative pt-6 pb-8">
        {/* Transition date tooltips */}
        {handlePositions.map((pos, index) => {
          const isActive = draggingHandle === index || hoverHandle === index;
          const transitionDate = getDateAtPosition(pos);
          
          return (
            <div
              key={`tooltip-${index}`}
              className={cn(
                "absolute -top-1 transform -translate-x-1/2 transition-opacity duration-150 z-20",
                isActive ? "opacity-100" : "opacity-0"
              )}
              style={{ left: `${pos}%` }}
            >
              <div className="bg-foreground text-background text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                {transitionDate ? format(transitionDate, 'MMM d') : `${Math.round(pos)}%`}
              </div>
              <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-foreground mx-auto" />
            </div>
          );
        })}

        {/* Track */}
        <div 
          ref={trackRef}
          className="relative h-12 rounded-lg overflow-hidden flex cursor-pointer"
          style={{ touchAction: 'none' }}
        >
          {segments.map((segment) => (
            <div
              key={segment.phase}
              className="h-full flex flex-col items-center justify-center transition-all duration-150 relative"
              style={{ 
                width: `${segment.width}%`,
                backgroundColor: segment.color,
                minWidth: segment.width > 0 ? '2px' : 0,
              }}
            >
              {segment.width > 8 && (
                <span className="text-[10px] font-medium text-white/90 drop-shadow-sm truncate px-1 leading-tight">
                  {formatDateRange(segment.segmentStartDate, segment.segmentEndDate, segment.workingDays, segment.width)}
                </span>
              )}
            </div>
          ))}

          {/* Draggable handles */}
          {handlePositions.map((pos, index) => (
            <div
              key={`handle-${index}`}
              className={cn(
                "absolute top-0 bottom-0 w-4 -ml-2 cursor-ew-resize z-10",
                "flex items-center justify-center",
                "group"
              )}
              style={{ left: `${pos}%` }}
              onMouseDown={(e) => {
                e.preventDefault();
                setDraggingHandle(index);
              }}
              onTouchStart={() => {
                setDraggingHandle(index);
              }}
              onMouseEnter={() => setHoverHandle(index)}
              onMouseLeave={() => setHoverHandle(null)}
            >
              {/* Handle visual */}
              <div 
                className={cn(
                  "w-1.5 h-full bg-white/90 shadow-md transition-all",
                  "group-hover:w-2 group-hover:bg-white",
                  draggingHandle === index && "w-2 bg-white ring-2 ring-primary ring-offset-1"
                )}
              />
              {/* Grip dots */}
              <div className="absolute flex flex-col gap-0.5 pointer-events-none">
                <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                <div className="w-1 h-1 rounded-full bg-muted-foreground/50" />
              </div>
            </div>
          ))}

          {/* Delivery date flag marker at the end */}
          <div
            className="absolute top-0 bottom-0 right-0 flex items-center justify-center z-10"
            title={endDate ? `Delivery: ${format(endDate, 'MMM d, yyyy')}` : 'Delivery Date'}
          >
            <div className="relative h-full flex items-center">
              <div className="absolute right-0 top-0 h-full w-0.5 bg-emerald-600" />
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 bg-emerald-600 text-white rounded-full p-1 shadow-lg">
                <Flag className="w-3 h-3" fill="currentColor" />
              </div>
            </div>
          </div>
        </div>

        {/* Phase labels below */}
        <div className="absolute left-0 right-0 flex" style={{ top: 'calc(100% + 4px)' }}>
          {segments.map((segment) => (
            <div
              key={`label-${segment.phase}`}
              className="flex flex-col items-center transition-all duration-150"
              style={{ width: `${segment.width}%` }}
            >
              {segment.width > 8 && (
                <>
                  <div 
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: segment.color }}
                  />
                  <span className="text-xs text-muted-foreground mt-0.5 truncate max-w-full px-0.5 text-center leading-tight">
                    {segment.width > 15 ? segment.phase : segment.phase.substring(0, 3)}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
