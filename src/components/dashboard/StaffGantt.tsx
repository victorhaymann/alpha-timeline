import { useMemo, useRef, useState } from 'react';
import { format, addDays, startOfWeek, isWeekend, isWithinInterval } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Search, CalendarIcon, ChevronRight, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Assignment {
  staffId: string;
  projectId: string;
  projectName: string;
  phaseName: string;
  startDate: Date;
  endDate: Date;
  color: string;
}

interface StaffMember {
  id: string;
  fullName: string;
  categoryId: string | null;
  categoryName: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface StaffGanttProps {
  staff: StaffMember[];
  assignments: Assignment[];
  categories: Category[];
}

const ROW_H = 40;
const LEFT_COL = 200;
const DAY_W = 32;
const CAT_H = 32;

const PROJECT_COLORS = [
  'hsl(260 60% 55%)',
  'hsl(200 70% 50%)',
  'hsl(340 65% 50%)',
  'hsl(160 60% 40%)',
  'hsl(30 80% 50%)',
  'hsl(0 65% 50%)',
  'hsl(180 55% 45%)',
  'hsl(290 50% 50%)',
];

function getTimelineRange() {
  const today = new Date();
  const start = startOfWeek(addDays(today, -14), { weekStartsOn: 1 });
  const end = addDays(start, 12 * 7);
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
  let cur = '';
  days.forEach((d, i) => {
    const ws = format(startOfWeek(d, { weekStartsOn: 1 }), 'MMM d');
    if (ws !== cur) {
      weeks.push({ label: ws, startIdx: i, count: 1 });
      cur = ws;
    } else {
      weeks[weeks.length - 1].count++;
    }
  });
  return weeks;
}

export function StaffGantt({ staff, assignments, categories }: StaffGanttProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [availDate, setAvailDate] = useState<Date | undefined>(undefined);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  // Color map per project
  const projectColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const uniqueProjects = [...new Set(assignments.map(a => a.projectId))];
    uniqueProjects.forEach((pid, i) => {
      map.set(pid, PROJECT_COLORS[i % PROJECT_COLORS.length]);
    });
    return map;
  }, [assignments]);

  // Build staff by category
  const grouped = useMemo(() => {
    const q = search.toLowerCase();
    let filtered = staff;
    if (q) filtered = filtered.filter(s => s.fullName.toLowerCase().includes(q));
    if (categoryFilter !== 'all') filtered = filtered.filter(s => s.categoryId === categoryFilter);

    // Check availability
    const staffAvail = new Map<string, boolean>();
    if (availDate) {
      filtered.forEach(s => {
        const busy = assignments.some(a =>
          a.staffId === s.id &&
          isWithinInterval(availDate, { start: a.startDate, end: a.endDate })
        );
        staffAvail.set(s.id, !busy);
      });
    }

    // Group by category
    const groups = new Map<string, { cat: Category | null; members: StaffMember[] }>();
    const uncategorized: StaffMember[] = [];

    filtered.forEach(s => {
      if (s.categoryId && s.categoryName) {
        if (!groups.has(s.categoryId)) {
          const cat = categories.find(c => c.id === s.categoryId) || { id: s.categoryId, name: s.categoryName };
          groups.set(s.categoryId, { cat, members: [] });
        }
        groups.get(s.categoryId)!.members.push(s);
      } else {
        uncategorized.push(s);
      }
    });

    // Sort within groups: available first if date selected
    if (availDate) {
      const sortByAvail = (a: StaffMember, b: StaffMember) => {
        const aa = staffAvail.get(a.id) ? 0 : 1;
        const ab = staffAvail.get(b.id) ? 0 : 1;
        return aa - ab;
      };
      groups.forEach(g => g.members.sort(sortByAvail));
      uncategorized.sort(sortByAvail);
    }

    const result: { catId: string; catName: string; members: StaffMember[] }[] = [];
    // Sort categories alphabetically
    const sorted = [...groups.entries()].sort((a, b) => a[1].cat!.name.localeCompare(b[1].cat!.name));
    sorted.forEach(([id, { cat, members }]) => {
      result.push({ catId: id, catName: cat!.name, members });
    });
    if (uncategorized.length > 0) {
      result.push({ catId: '__none', catName: 'Uncategorized', members: uncategorized });
    }

    return { groups: result, staffAvail };
  }, [staff, search, categoryFilter, assignments, categories, availDate]);

  const availCount = useMemo(() => {
    if (!availDate) return 0;
    let count = 0;
    grouped.staffAvail.forEach(v => { if (v) count++; });
    return count;
  }, [grouped.staffAvail, availDate]);

  function dayIndex(date: Date): number {
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

  function toggleCollapse(catId: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(catId)) next.delete(catId); else next.add(catId);
      return next;
    });
  }

  // Check for overlaps on a staff member
  function hasOverlap(staffId: string): boolean {
    const sa = assignments.filter(a => a.staffId === staffId);
    for (let i = 0; i < sa.length; i++) {
      for (let j = i + 1; j < sa.length; j++) {
        if (sa[i].startDate <= sa[j].endDate && sa[j].startDate <= sa[i].endDate) return true;
      }
    }
    return false;
  }

  // Build rows for rendering
  const rows: { type: 'category'; catId: string; catName: string; count: number }[] | { type: 'staff'; staff: StaffMember }[] = [];
  const flatRows: ({ type: 'category'; catId: string; catName: string; count: number } | { type: 'staff'; staff: StaffMember })[] = [];

  grouped.groups.forEach(g => {
    flatRows.push({ type: 'category', catId: g.catId, catName: g.catName, count: g.members.length });
    if (!collapsed.has(g.catId)) {
      g.members.forEach(m => flatRows.push({ type: 'staff', staff: m }));
    }
  });

  return (
    <section className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-border flex-wrap gap-2">
        <h2 className="text-sm font-semibold">Staff Allocation</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name..."
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {availDate ? format(availDate, 'MMM d') : 'Check availability'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={availDate}
                onSelect={setAvailDate}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {availDate && (
            <Badge variant="secondary" className="text-xs">
              <Check className="h-3 w-3 mr-1" />
              {availCount} available on {format(availDate, 'MMM d')}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex overflow-hidden" style={{ maxHeight: Math.max(flatRows.length * ROW_H + 60, 160) }}>
        {/* Frozen left */}
        <div
          ref={leftRef}
          className="flex-shrink-0 overflow-hidden border-r border-border"
          style={{ width: LEFT_COL }}
        >
          <div className="h-[52px] border-b border-border bg-muted/30 flex items-end px-3 pb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Staff</span>
          </div>
          {flatRows.map((row, i) => {
            if (row.type === 'category') {
              return (
                <div
                  key={`cat-${row.catId}`}
                  className="flex items-center px-2 gap-1.5 bg-muted/40 border-b border-border/50 cursor-pointer hover:bg-muted/60 transition-colors"
                  style={{ height: CAT_H }}
                  onClick={() => toggleCollapse(row.catId)}
                >
                  <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", !collapsed.has(row.catId) && "rotate-90")} />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{row.catName}</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{row.count}</span>
                </div>
              );
            }
            const s = row.staff;
            const isAvail = availDate ? grouped.staffAvail.get(s.id) : null;
            const overlap = hasOverlap(s.id);
            return (
              <div
                key={`staff-${s.id}`}
                className="flex items-center px-3 gap-2 border-b border-border/30"
                style={{ height: ROW_H }}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate flex items-center gap-1.5">
                    {s.fullName}
                    {overlap && <AlertTriangle className="h-3 w-3 text-destructive flex-shrink-0" />}
                  </div>
                </div>
                {isAvail !== null && (
                  <Badge
                    variant={isAvail ? 'default' : 'secondary'}
                    className={cn("text-[9px] flex-shrink-0", isAvail && "bg-green-600 hover:bg-green-600")}
                  >
                    {isAvail ? 'Free' : 'Busy'}
                  </Badge>
                )}
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
            <div className="flex border-b border-border h-[24px]">
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

              {/* Availability date marker */}
              {availDate && (() => {
                const ai = dayIndex(availDate);
                return (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-green-500/60 z-10"
                    style={{ left: ai * DAY_W + DAY_W / 2 }}
                  />
                );
              })()}

              {/* Day grid */}
              <div className="absolute inset-0 flex pointer-events-none">
                {days.map((_, i) => (
                  <div key={i} className="border-r border-border/10" style={{ width: DAY_W, height: '100%' }} />
                ))}
              </div>

              {flatRows.map((row, ri) => {
                if (row.type === 'category') {
                  return (
                    <div
                      key={`cat-tl-${row.catId}`}
                      className="bg-muted/40 border-b border-border/50"
                      style={{ height: CAT_H }}
                    />
                  );
                }
                const staffAssigns = assignments.filter(a => a.staffId === row.staff.id);
                return (
                  <div
                    key={`staff-tl-${row.staff.id}`}
                    className="relative border-b border-border/30"
                    style={{ height: ROW_H }}
                  >
                    {staffAssigns.map((a, ai) => {
                      const si = dayIndex(a.startDate);
                      const ei = dayIndex(a.endDate);
                      const barLeft = si * DAY_W;
                      const barWidth = Math.max((ei - si + 1) * DAY_W - 2, 4);
                      const color = projectColorMap.get(a.projectId) || PROJECT_COLORS[0];

                      return (
                        <Tooltip key={ai}>
                          <TooltipTrigger asChild>
                            <div
                              className="absolute top-1.5 rounded-sm text-[8px] font-medium text-white flex items-center px-1 overflow-hidden whitespace-nowrap shadow-sm"
                              style={{
                                left: barLeft,
                                width: barWidth,
                                height: ROW_H - 12,
                                backgroundColor: color,
                                opacity: 0.85,
                              }}
                            >
                              {barWidth > 50 ? a.projectName : ''}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{a.projectName}</div>
                            <div className="text-muted-foreground">{a.phaseName}</div>
                            <div className="text-muted-foreground">
                              {format(a.startDate, 'MMM d')} – {format(a.endDate, 'MMM d')}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}

              {flatRows.length === 0 && (
                <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                  No staff found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
