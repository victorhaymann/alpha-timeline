import { useEffect, useMemo, useRef, useState } from 'react';
import { format, addDays, startOfWeek, isWeekend } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Flag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

interface PhaseBar {
  name: string;
  color: string;
  startDate: Date;
  endDate: Date;
}

interface MilestoneMarker {
  name: string;
  date: Date;
  color: string;
}

interface ProjectRow {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  startDate: Date;
  endDate: Date;
  phases: PhaseBar[];
  milestones: MilestoneMarker[];
}

interface ProjectsGanttProps {
  projects: ProjectRow[];
}

// Lane layout constants
const BASE_ROW_H = 44;
const LANE_H = 24;
const BAR_H = 20;
const BAR_PAD = 6;
const LEFT_COL = 260;
const DAY_W = 32;

interface LanedBar<T> {
  bar: T;
  lane: number;
}

function computeLanes<T extends { startDate: Date; endDate: Date }>(bars: T[]): { laned: LanedBar<T>[]; laneCount: number } {
  if (bars.length === 0) return { laned: [], laneCount: 0 };
  const sorted = [...bars].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  const lanes: Date[] = []; // each lane tracks when it ends
  const laned: LanedBar<T>[] = [];

  for (const bar of sorted) {
    let assigned = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (lanes[i] < bar.startDate) {
        assigned = i;
        break;
      }
    }
    if (assigned === -1) {
      assigned = lanes.length;
      lanes.push(bar.endDate);
    } else {
      lanes[assigned] = bar.endDate;
    }
    laned.push({ bar, lane: assigned });
  }

  return { laned, laneCount: lanes.length };
}

function rowHeight(laneCount: number): number {
  return laneCount <= 1 ? BASE_ROW_H : BAR_PAD * 2 + laneCount * LANE_H;
}

function getTimelineRange() {
  const today = new Date();
  const start = startOfWeek(addDays(today, -8 * 7), { weekStartsOn: 1 });
  const end = addDays(today, 12 * 7);
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

type StatusFilter = 'production' | 'delivered' | 'all';


const PHASE_COLORS = [
  'hsl(var(--primary))',
  'hsl(260 60% 55%)',
  'hsl(200 70% 50%)',
  'hsl(340 65% 50%)',
  'hsl(160 60% 40%)',
  'hsl(30 80% 50%)',
];

export function ProjectsGantt({ projects }: ProjectsGanttProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('production');
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

  // Auto-scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && todayIdx >= 0) {
      const targetX = Math.max(0, todayIdx * DAY_W - scrollRef.current.clientWidth / 3);
      scrollRef.current.scrollLeft = targetX;
    }
  }, [todayIdx]);

  const filtered = useMemo(() => {
    let list = projects;
    if (statusFilter === 'production') {
      list = list.filter(p => p.status === 'active' || p.status === 'draft');
    } else if (statusFilter === 'delivered') {
      list = list.filter(p => p.status === 'completed');
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.clientName || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [projects, search, statusFilter]);

  // Compute lanes per project
  const projectLanes = useMemo(() => {
    const map = new Map<string, { laned: LanedBar<PhaseBar>[]; laneCount: number }>();
    filtered.forEach(p => {
      map.set(p.id, computeLanes(p.phases));
    });
    return map;
  }, [filtered]);

  // Row heights map
  const rowHeights = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach(p => {
      const lc = projectLanes.get(p.id)?.laneCount || 1;
      map.set(p.id, rowHeight(Math.max(lc, 1)));
    });
    return map;
  }, [filtered, projectLanes]);

  const totalRowHeight = useMemo(() => {
    let h = 0;
    filtered.forEach(p => { h += rowHeights.get(p.id) || BASE_ROW_H; });
    return h;
  }, [filtered, rowHeights]);

  function dayIndex(date: Date): number {
    for (let i = 0; i < days.length; i++) {
      if (
        days[i].getFullYear() === date.getFullYear() &&
        days[i].getMonth() === date.getMonth() &&
        days[i].getDate() === date.getDate()
      ) return i;
      if (days[i] > date) return i;
    }
    return days.length - 1;
  }

  function handleScroll() {
    if (scrollRef.current && leftRef.current) {
      leftRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }

  function scrollByWeek(direction: 1 | -1) {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: direction * 5 * DAY_W, behavior: 'smooth' });
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border gap-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-semibold">Projects Timeline</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollByWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => scrollByWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {(['production', 'delivered', 'all'] as StatusFilter[]).map(f => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                className={`h-8 rounded-none text-xs px-3 ${statusFilter === f ? 'bg-muted font-semibold' : ''}`}
                onClick={() => setStatusFilter(f)}
              >
                {f === 'production' ? 'In Production' : f === 'delivered' ? 'Delivered' : 'All'}
              </Button>
            ))}
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search project..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex overflow-hidden" style={{ maxHeight: Math.max(totalRowHeight + 60, 160) }}>
        {/* Frozen left column */}
        <div
          ref={leftRef}
          className="flex-shrink-0 overflow-hidden border-r border-border"
          style={{ width: LEFT_COL }}
        >
          <div className="h-[52px] border-b border-border bg-muted/30 flex items-end px-3 pb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Project</span>
          </div>
          {filtered.map(p => {
            const h = rowHeights.get(p.id) || BASE_ROW_H;
            return (
              <div
                key={p.id}
                className="flex items-center px-3 gap-2 border-b border-border/50 cursor-pointer hover:bg-muted/40 transition-colors"
                style={{ height: h }}
                onClick={() => navigate(`/projects/${p.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium truncate">{p.name}</span>
                  </div>
                  {p.clientName && (
                    <div className="text-[10px] text-muted-foreground truncate">{p.clientName}</div>
                  )}
                </div>
              </div>
            );
          })}
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

              {filtered.map(project => {
                const h = rowHeights.get(project.id) || BASE_ROW_H;
                const lanes = projectLanes.get(project.id);

                return (
                  <div
                    key={project.id}
                    className="relative border-b border-border/30 cursor-pointer hover:bg-muted/20 transition-colors"
                    style={{ height: h }}
                    onClick={() => navigate(`/projects/${project.id}`)}
                  >
                    {lanes?.laned.map(({ bar: phase, lane }, pi) => {
                      const si = dayIndex(phase.startDate);
                      const ei = dayIndex(phase.endDate);
                      const barLeft = si * DAY_W;
                      const barWidth = Math.max((ei - si + 1) * DAY_W - 2, 4);
                      const color = phase.color || PHASE_COLORS[pi % PHASE_COLORS.length];
                      const topOffset = BAR_PAD + lane * LANE_H;

                      return (
                        <Tooltip key={pi}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute rounded-sm text-[9px] font-medium text-white flex items-center px-1.5 overflow-hidden whitespace-nowrap shadow-sm"
                              style={{
                                left: barLeft,
                                width: barWidth,
                                height: BAR_H,
                                top: topOffset,
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
                    {/* Milestone flags */}
                    {project.milestones.map((ms, mi) => {
                      const msIdx = dayIndex(ms.date);
                      const flagLeft = msIdx * DAY_W + DAY_W / 2 - 8;
                      const flagTop = BAR_PAD;
                      const color = ms.color || PHASE_COLORS[mi % PHASE_COLORS.length];

                      return (
                        <Tooltip key={`ms-${mi}`}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute z-10"
                              style={{ left: flagLeft, top: flagTop }}
                            >
                              <Flag className="w-4 h-4" style={{ color, fill: color }} />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{ms.name}</div>
                            <div className="text-muted-foreground">{format(ms.date, 'MMM d')}</div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}

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
