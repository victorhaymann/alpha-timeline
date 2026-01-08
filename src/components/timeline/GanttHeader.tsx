import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  CalendarIcon,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  HelpCircle,
  Flag,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';
import { ViewMode } from './ganttTypes';

interface GanttHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  onNavigatePeriod: (direction: 'prev' | 'next') => void;
  workingDaysCount: number;
  projectStartDate: Date;
  projectEndDate: Date;
  isMobile: boolean;
}

export function GanttHeader({
  viewMode,
  onViewModeChange,
  dateRange,
  onDateRangeChange,
  onNavigatePeriod,
  workingDaysCount,
  projectStartDate,
  projectEndDate,
  isMobile,
}: GanttHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 md:gap-4 px-2 md:px-4 py-2 md:py-3 rounded-xl bg-card border border-border">
      {/* Breadcrumb placeholder - hidden on mobile */}
      <div className="hidden md:flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Projects</span>
        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="font-medium text-foreground">Timeline</span>
      </div>

      {/* Center controls */}
      <div className="flex items-center gap-1 md:gap-2 mx-auto">
        {/* Navigation arrows */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 md:h-9 md:w-9 p-0 hover:bg-accent text-foreground"
          onClick={() => onNavigatePeriod('prev')}
          title="Previous period (← Arrow)"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        
        {/* View mode toggle - Segmented control */}
        <div className="flex items-center rounded-lg p-0.5 md:p-1 bg-muted border border-border">
          {(['week', 'month', 'project'] as ViewMode[]).map((mode) => (
            <Button
              key={mode}
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 md:h-8 px-2 md:px-4 text-[10px] md:text-xs font-semibold tracking-wide capitalize transition-all duration-200",
                viewMode === mode 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => onViewModeChange(mode)}
            >
              {isMobile 
                ? (mode === 'week' ? 'W' : mode === 'month' ? 'M' : 'P')
                : (mode === 'week' ? 'Weekly' : mode === 'month' ? 'Monthly' : 'Project')
              }
            </Button>
          ))}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 md:h-9 md:w-9 p-0 hover:bg-accent text-foreground"
          onClick={() => onNavigatePeriod('next')}
          title="Next period (→ Arrow)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        
        {/* Date Range Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 md:h-9 px-2 md:px-3 gap-1.5 border-border hover:bg-accent text-foreground"
            >
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] md:text-xs font-medium tracking-wide hidden sm:inline">
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}
                    </>
                  ) : (
                    format(dateRange.from, 'MMM d')
                  )
                ) : (
                  'Dates'
                )}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-card border-border" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={onDateRangeChange}
              numberOfMonths={isMobile ? 1 : 2}
              className="pointer-events-auto"
            />
            <div className="flex items-center justify-between p-3 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDateRangeChange({ from: projectStartDate, to: projectEndDate })}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                Reset to project dates
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Right side info */}
      <div className="hidden md:flex items-center gap-4 ml-auto">
        {/* Working days badge */}
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-muted text-muted-foreground">
          {workingDaysCount} working days left
        </span>

        {/* Legend tooltip */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-9 w-9 p-0 hover:bg-accent text-muted-foreground hover:text-foreground"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="w-64 p-3 bg-card border-border text-foreground">
            <div className="space-y-2.5 text-xs">
              <div className="font-semibold text-sm mb-2 tracking-wide">Chart Legend</div>
              
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-foreground/80 rotate-45 rounded-sm shrink-0 diamond-shimmer" />
                <span><strong>Diamond</strong> — Recurring meeting</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-500 shrink-0" fill="currentColor" strokeWidth={1.5} />
                <span><strong>Flag</strong> — Milestone (end of phase)</span>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="w-8 h-3 gantt-task-bar rounded-sm shrink-0" />
                <span><strong>Bar</strong> — Task duration</span>
              </div>
              
              <div className="border-t border-border pt-2 mt-2 text-muted-foreground">
                <p><strong>Weekly view:</strong> 7 days per period</p>
                <p className="mt-1"><strong>Monthly view:</strong> Full month view</p>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
