import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface InlineDatePickerProps {
  date: Date | null;
  onDateChange: (date: Date) => void;
  formatStr?: string;
  className?: string;
  disabled?: boolean;
}

export function InlineDatePicker({
  date,
  onDateChange,
  formatStr = 'MMM d',
  className,
  disabled = false,
}: InlineDatePickerProps) {
  const [open, setOpen] = useState(false);

  if (!date) return null;

  const handleSelect = (newDate: Date | undefined) => {
    if (newDate) {
      onDateChange(newDate);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "font-medium hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer",
            disabled && "pointer-events-none",
            className
          )}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          {format(date, formatStr)}
        </button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0" 
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleSelect}
          initialFocus
          className="p-3 pointer-events-auto"
        />
      </PopoverContent>
    </Popover>
  );
}
