import { useMemo } from 'react';
import { format, addDays, differenceInDays, max as maxDate, min as minDate } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Assignment {
  staffName: string;
  staffId: string;
  projectName: string;
  projectId: string;
  phaseName: string;
  startDate: Date;
  endDate: Date;
  color: string;
}

interface StaffAllocationChartProps {
  assignments: Assignment[];
}

const PROJECT_COLORS = [
  'hsl(38 92% 50%)',    // amber
  'hsl(196 80% 50%)',   // cyan
  'hsl(142 71% 45%)',   // green
  'hsl(280 65% 55%)',   // purple
  'hsl(0 84% 60%)',     // red
  'hsl(210 75% 55%)',   // blue
];

export function StaffAllocationChart({ assignments }: StaffAllocationChartProps) {
  // Calculate timeline range: 2 weeks back to 6 weeks ahead
  const today = new Date();
  const timelineStart = addDays(today, -14);
  const timelineEnd = addDays(today, 42);
  const totalDays = differenceInDays(timelineEnd, timelineStart);

  // Group by staff
  const staffGroups = useMemo(() => {
    const grouped = new Map<string, Assignment[]>();
    assignments.forEach(a => {
      const list = grouped.get(a.staffId) || [];
      list.push(a);
      grouped.set(a.staffId, list);
    });
    return grouped;
  }, [assignments]);

  // Assign colors to projects
  const projectColors = useMemo(() => {
    const colors = new Map<string, string>();
    const uniqueProjects = [...new Set(assignments.map(a => a.projectId))];
    uniqueProjects.forEach((id, i) => {
      colors.set(id, PROJECT_COLORS[i % PROJECT_COLORS.length]);
    });
    return colors;
  }, [assignments]);

  // Detect conflicts
  const conflicts = useMemo(() => {
    const result: { staffName: string; overlap: string }[] = [];
    staffGroups.forEach((staffAssignments, staffId) => {
      for (let i = 0; i < staffAssignments.length; i++) {
        for (let j = i + 1; j < staffAssignments.length; j++) {
          const a = staffAssignments[i];
          const b = staffAssignments[j];
          if (a.startDate <= b.endDate && b.startDate <= a.endDate) {
            const overlapStart = maxDate([a.startDate, b.startDate]);
            const overlapEnd = minDate([a.endDate, b.endDate]);
            result.push({
              staffName: a.staffName,
              overlap: `${format(overlapStart, 'MMM d')} – ${format(overlapEnd, 'MMM d')}: ${a.projectName} × ${b.projectName}`,
            });
          }
        }
      }
    });
    return result;
  }, [staffGroups]);

  // Week markers
  const weekMarkers = useMemo(() => {
    const markers: { date: Date; x: number }[] = [];
    let d = new Date(timelineStart);
    // Advance to next Monday
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7));
    while (d <= timelineEnd) {
      markers.push({ date: new Date(d), x: (differenceInDays(d, timelineStart) / totalDays) * 100 });
      d = addDays(d, 7);
    }
    return markers;
  }, [timelineStart, timelineEnd, totalDays]);

  const todayX = (differenceInDays(today, timelineStart) / totalDays) * 100;

  if (staffGroups.size === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No staff assignments yet. Assign staff to project phases on the timeline.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Week header */}
      <div className="relative h-6 ml-28">
        {weekMarkers.map((m, i) => (
          <span
            key={i}
            className="absolute text-[10px] text-muted-foreground -translate-x-1/2"
            style={{ left: `${m.x}%` }}
          >
            {format(m.date, 'MMM d')}
          </span>
        ))}
      </div>

      {/* Staff rows */}
      {Array.from(staffGroups.entries()).map(([staffId, staffAssignments]) => {
        const staffName = staffAssignments[0].staffName;
        const hasConflict = conflicts.some(c => c.staffName === staffName);

        return (
          <div key={staffId} className="flex items-center gap-3">
            <div className="w-24 shrink-0 text-right">
              <span className="text-xs font-medium truncate block">{staffName}</span>
              {hasConflict && (
                <Tooltip>
                  <TooltipTrigger>
                    <AlertTriangle className="w-3 h-3 text-amber-500 inline-block ml-1" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Overlapping assignments</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <div className="flex-1 relative h-8 bg-muted/30 rounded">
              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-px bg-destructive/50 z-10"
                style={{ left: `${todayX}%` }}
              />

              {staffAssignments.map((a, idx) => {
                const barStart = Math.max(0, (differenceInDays(a.startDate, timelineStart) / totalDays) * 100);
                const barEnd = Math.min(100, (differenceInDays(a.endDate, timelineStart) / totalDays) * 100);
                const barWidth = barEnd - barStart;
                if (barWidth <= 0) return null;

                const color = projectColors.get(a.projectId) || PROJECT_COLORS[0];

                return (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-1 bottom-1 rounded-sm cursor-pointer opacity-80 hover:opacity-100 transition-opacity"
                        style={{
                          left: `${barStart}%`,
                          width: `${barWidth}%`,
                          backgroundColor: color,
                          minWidth: 4,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs font-medium">{a.projectName}</p>
                      <p className="text-[10px] text-muted-foreground">{a.phaseName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(a.startDate, 'MMM d')} – {format(a.endDate, 'MMM d')}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Conflict warnings */}
      {conflicts.length > 0 && (
        <div className="mt-2 space-y-1">
          {conflicts.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-amber-500">
              <AlertTriangle className="w-3 h-3 shrink-0" />
              <span>⚠ {c.staffName}: {c.overlap}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
