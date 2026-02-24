import { useMemo, useRef, useState } from 'react';
import { format, addDays, startOfWeek, differenceInCalendarDays, isWeekend } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface PhaseBar {
  name: string;
  color: string;
  startDate: Date;
  endDate: Date;
}

interface ProjectRow {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  startDate: Date;
  endDate: Date;
  phases: PhaseBar[];
}

interface ProjectsGanttProps {
  projects: ProjectRow[];
}

const ROW_H = 44;
const LEFT_COL = 200;
const DAY_W = 32;

function getTimelineRange() {
  const today = new Date();
  const start = startOfWeek(addDays(today, -14), { weekStartsOn: 1 });
  const end = addDays(start, 12 * 7); // ~12 weeks
  return { start, end };
}

function buildDays(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let d = new Date(start);
  while (d <= end) {
    if (!isWeekend(d)) days.push(new Date(d));
    d = addDays(d, 1);
  }
  return days;
}

function buildWeeks(days: Date[]): { label: string; startIdx: number; count: number }[] {
  const weeks: { label: string; startIdx: number; count: number }[] = [];
  let currentWeekStart = '';
  days.forEach((d, i) => {
    const ws = format(startOfWeek(d, { weekStartsOn: 1 }), 'MMM d');
    if (ws !== currentWeekStart) {
      weeks.push({ label: ws, startIdx: i, count: 1 });
      currentWeekStart = ws;
    } else {
      weeks[weeks.length - 1].count++;
    }
  });
  return weeks;
}

export function ProjectsGantt({ projects }: ProjectsGanttProps) {
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);

  const { start: tlStart, end: tlEnd } = useMemo(getTimelineRange, []);
  const days = useMemo(() => buildDays(tlStart, tlEnd), [tlStart, tlEnd]);
  const weeks = useMemo(() => buildWeeks(days), [days]);
  const totalW = days.length * DAY_W;

  const todayIdx = useMemo(() => {
    const today = new Date();
    return days.findIndex(d =>
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  }, [days]);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(p =>
      p.name.toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q)
    );
  }, [projects, search]);

  function dayIndex(date: Date): number {
    // find closest working day index
    for (let i = 0; i < days.length; i++) {
      if (days[i] >= date) return i;
    }
    return days.length - 1;
  }

  function handleScroll() {
    if (scrollRef.current && leftRef.current) {
      leftRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }

  const PHASE_COLORS = [
    'hsl(var(--primary))',
    'hsl(260 60% 55%)',
    'hsl(200 70% 50%)',
    'hsl(340 65% 50%)',
    'hsl(160 60% 40%)',
    'hsl(30 80% 50%)',
  ];

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="text-sm font-semibold">Projects Timeline</h2>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search project..."
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      <div className="flex overflow-hidden" style={{ maxHeight: Math.max(filtered.length * ROW_H + 60, 160) }}>
        {/* Frozen left column */}
        <div
          ref={leftRef}
          className="flex-shrink-0 overflow-hidden border-r border-border"
          style={{ width: LEFT_COL }}
        >
          {/* Header spacer */}
          <div className="h-[52px] border-b border-border bg-muted/30 flex items-end px-3 pb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Project</span>
          </div>
          {filtered.map(p => (
            <div
              key={p.id}
              className="flex items-center px-3 gap-2 border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors"
              style={{ height: ROW_H }}
              onClick={() => navigate(`/projects/${p.id}`)}
            >
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{p.name}</div>
                {p.clientName && (
                  <div className="text-[10px] text-muted-foreground truncate">{p.clientName}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto"
          onScroll={handleScroll}
        >
          <div style={{ width: totalW, minWidth: '100%' }}>
            {/* Week headers */}
            <div className="flex border-b border-border bg-muted/30 h-[28px]">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="text-[10px] font-medium text-muted-foreground border-r border-border/30 flex items-center px-1.5"
                  style={{ width: w.count * DAY_W }}
                >
                  {w.label}
                </div>
              ))}
            </div>
            {/* Day headers */}
            <div className="flex border-b border-border h-[24px] relative">
              {days.map((d, i) => (
                <div
                  key={i}
                  className="text-[9px] text-muted-foreground flex items-center justify-center border-r border-border/20"
                  style={{ width: DAY_W }}
                >
                  {format(d, 'EEE').charAt(0)}
                </div>
              ))}
            </div>

            {/* Rows */}
            <div className="relative">
              {/* Today marker */}
              {todayIdx >= 0 && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-destructive/70 z-10"
                  style={{ left: todayIdx * DAY_W + DAY_W / 2 }}
                />
              )}

              {/* Day grid lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map((_, i) => (
                  <div
                    key={i}
                    className="border-r border-border/10"
                    style={{ width: DAY_W, height: '100%' }}
                  />
                ))}
              </div>

              {filtered.map(project => (
                <div
                  key={project.id}
                  className="relative border-b border-border/30 cursor-pointer hover:bg-muted/20 transition-colors"
                  style={{ height: ROW_H }}
                  onClick={() => navigate(`/projects/${project.id}`)}
                >
                  {project.phases.map((phase, pi) => {
                    const si = dayIndex(phase.startDate);
                    const ei = dayIndex(phase.endDate);
                    const barLeft = si * DAY_W;
                    const barWidth = Math.max((ei - si + 1) * DAY_W - 2, 4);
                    const color = phase.color || PHASE_COLORS[pi % PHASE_COLORS.length];

                    return (
                      <Tooltip key={pi}>
                        <TooltipTrigger asChild>
                          <div
                            className="absolute top-2 rounded-sm text-[9px] font-medium text-white flex items-center px-1.5 overflow-hidden whitespace-nowrap shadow-sm"
                            style={{
                              left: barLeft,
                              width: barWidth,
                              height: ROW_H - 16,
                              backgroundColor: color,
                              opacity: 0.9,
                            }}
                          >
                            {barWidth > 40 ? phase.name : ''}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <div className="font-medium">{phase.name}</div>
                          <div className="text-muted-foreground">
                            {format(phase.startDate, 'MMM d')} – {format(phase.endDate, 'MMM d')}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              ))}

              {filtered.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                  No projects found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
