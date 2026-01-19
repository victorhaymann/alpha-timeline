import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { CalendarIcon, X, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export type UsageCategory = 'digital' | 'paid_media' | 'pos_retail' | 'print' | 'ooh' | 'tv';

export interface UsageSelection {
  category: UsageCategory;
  included: boolean;
  isPaid: boolean;
  geographies: string[];
  periodStart: Date | null;
  periodEnd: Date | null;
}

interface UsageRightsMatrixProps {
  selections: UsageSelection[];
  onChange: (selections: UsageSelection[]) => void;
  readOnly?: boolean;
}

const CATEGORIES: { value: UsageCategory; label: string; description: string }[] = [
  { value: 'digital', label: 'Digital', description: 'Web, social media, email' },
  { value: 'paid_media', label: 'Paid Media', description: 'Ads, sponsored content' },
  { value: 'pos_retail', label: 'POS / Retail', description: 'In-store displays, screens' },
  { value: 'print', label: 'Print', description: 'Magazines, brochures' },
  { value: 'ooh', label: 'OOH', description: 'Billboards, street furniture' },
  { value: 'tv', label: 'TV', description: 'Broadcast, streaming' },
];

const GEOGRAPHIES = [
  'Worldwide',
  'Europe (EU + UK)',
  'North America',
  'Latin America',
  'Asia-Pacific',
  'Middle East & North Africa',
  'Sub-Saharan Africa',
];

const PERIOD_PRESETS = [
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
  { label: 'Perpetual', months: null },
];

export function UsageRightsMatrix({ selections, onChange, readOnly = false }: UsageRightsMatrixProps) {
  const [openGeoDropdown, setOpenGeoDropdown] = useState<UsageCategory | null>(null);
  const [customPeriodValue, setCustomPeriodValue] = useState<Record<UsageCategory, string>>({} as Record<UsageCategory, string>);
  const [customPeriodUnit, setCustomPeriodUnit] = useState<Record<UsageCategory, 'months' | 'years'>>({} as Record<UsageCategory, 'months' | 'years'>);

  const updateSelection = (category: UsageCategory, updates: Partial<UsageSelection>) => {
    onChange(
      selections.map((s) =>
        s.category === category ? { ...s, ...updates } : s
      )
    );
  };

  const toggleGeography = (category: UsageCategory, geo: string) => {
    const selection = selections.find((s) => s.category === category);
    if (!selection) return;

    let newGeographies: string[];
    if (geo === 'Worldwide') {
      newGeographies = selection.geographies.includes('Worldwide') ? [] : ['Worldwide'];
    } else {
      const filtered = selection.geographies.filter((g) => g !== 'Worldwide');
      if (filtered.includes(geo)) {
        newGeographies = filtered.filter((g) => g !== geo);
      } else {
        newGeographies = [...filtered, geo];
      }
    }
    updateSelection(category, { geographies: newGeographies });
  };

  const applyPreset = (category: UsageCategory, months: number | null) => {
    const selection = selections.find((s) => s.category === category);
    const startDate = selection?.periodStart || new Date();
    if (months === null) {
      updateSelection(category, { periodStart: startDate, periodEnd: null });
    } else {
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);
      updateSelection(category, { periodStart: startDate, periodEnd: endDate });
    }
  };

  const applyCustomPeriod = (category: UsageCategory) => {
    const value = parseInt(customPeriodValue[category] || '1', 10);
    const unit = customPeriodUnit[category] || 'months';
    if (isNaN(value) || value <= 0) return;
    
    const selection = selections.find((s) => s.category === category);
    const startDate = selection?.periodStart || new Date();
    const endDate = new Date(startDate);
    
    if (unit === 'years') {
      endDate.setFullYear(endDate.getFullYear() + value);
    } else {
      endDate.setMonth(endDate.getMonth() + value);
    }
    
    updateSelection(category, { periodStart: startDate, periodEnd: endDate });
  };

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 bg-muted/50 rounded-t-lg text-xs font-medium text-muted-foreground">
        <div className="col-span-3">Category</div>
        <div className="col-span-2 text-center">Paid / Organic</div>
        <div className="col-span-4">Territories</div>
        <div className="col-span-3">Period</div>
      </div>

      {/* Rows */}
      <div className="border rounded-b-lg divide-y">
        {CATEGORIES.map((cat) => {
          const selection = selections.find((s) => s.category === cat.value);
          if (!selection) return null;

          const isIncluded = selection.included;

          return (
            <div
              key={cat.value}
              className={cn(
                'grid grid-cols-12 gap-2 px-3 py-3 items-center transition-colors',
                !isIncluded && 'bg-muted/30'
              )}
            >
              {/* Category with checkbox */}
              <div className="col-span-3 flex items-center gap-2">
                <Checkbox
                  id={`include-${cat.value}`}
                  checked={isIncluded}
                  onCheckedChange={(checked) =>
                    updateSelection(cat.value, { included: !!checked })
                  }
                  disabled={readOnly}
                />
                <div>
                  <Label
                    htmlFor={`include-${cat.value}`}
                    className={cn(
                      'font-medium cursor-pointer',
                      !isIncluded && 'text-muted-foreground'
                    )}
                  >
                    {cat.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>

              {/* Paid / Organic */}
              <div className="col-span-2 flex justify-center">
                {isIncluded ? (
                  <RadioGroup
                    value={selection.isPaid ? 'paid' : 'organic'}
                    onValueChange={(val) =>
                      updateSelection(cat.value, { isPaid: val === 'paid' })
                    }
                    className="flex gap-3"
                    disabled={readOnly}
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="paid" id={`paid-${cat.value}`} />
                      <Label htmlFor={`paid-${cat.value}`} className="text-xs cursor-pointer">
                        Paid
                      </Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="organic" id={`organic-${cat.value}`} />
                      <Label htmlFor={`organic-${cat.value}`} className="text-xs cursor-pointer">
                        Organic
                      </Label>
                    </div>
                  </RadioGroup>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Geographies */}
              <div className="col-span-4">
                {isIncluded ? (
                  <Popover
                    open={openGeoDropdown === cat.value}
                    onOpenChange={(open) => setOpenGeoDropdown(open ? cat.value : null)}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full justify-between text-xs h-8"
                        disabled={readOnly}
                      >
                        <span className="truncate">
                          {selection.geographies.length === 0
                            ? 'Select territories...'
                            : selection.geographies.length === 1
                            ? selection.geographies[0]
                            : `${selection.geographies.length} selected`}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-2" align="start">
                      <div className="space-y-1">
                        {GEOGRAPHIES.map((geo) => (
                          <div
                            key={geo}
                            className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer"
                            onClick={() => toggleGeography(cat.value, geo)}
                          >
                            <Checkbox
                              checked={selection.geographies.includes(geo)}
                              onCheckedChange={() => toggleGeography(cat.value, geo)}
                            />
                            <span className="text-sm">{geo}</span>
                          </div>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>

              {/* Period */}
              <div className="col-span-3">
                {isIncluded ? (
                  <div className="space-y-1.5">
                    {/* Preset buttons */}
                    <div className="flex gap-1 flex-wrap">
                      {PERIOD_PRESETS.map((preset) => (
                        <Button
                          key={preset.label}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => applyPreset(cat.value, preset.months)}
                          disabled={readOnly}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                    
                    {/* Custom period input */}
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min="1"
                        max="99"
                        placeholder="X"
                        className="h-6 w-10 px-1 text-xs text-center"
                        value={customPeriodValue[cat.value] || ''}
                        onChange={(e) => setCustomPeriodValue(prev => ({ ...prev, [cat.value]: e.target.value }))}
                        disabled={readOnly}
                      />
                      <Select
                        value={customPeriodUnit[cat.value] || 'months'}
                        onValueChange={(val: 'months' | 'years') => setCustomPeriodUnit(prev => ({ ...prev, [cat.value]: val }))}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="h-6 w-[72px] text-xs px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background">
                          <SelectItem value="months">months</SelectItem>
                          <SelectItem value="years">years</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => applyCustomPeriod(cat.value)}
                        disabled={readOnly || !customPeriodValue[cat.value]}
                      >
                        Apply
                      </Button>
                    </div>
                    
                    {/* Date display */}
                    <div className="flex items-center gap-1 text-xs">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            disabled={readOnly}
                          >
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {selection.periodStart
                              ? format(selection.periodStart, 'MMM d, yy')
                              : 'Start'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selection.periodStart || undefined}
                            onSelect={(date) =>
                              updateSelection(cat.value, { periodStart: date || null })
                            }
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <span>–</span>
                      {selection.periodEnd === null ? (
                        <span className="text-muted-foreground italic">Perpetual</span>
                      ) : (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={readOnly}
                            >
                              <CalendarIcon className="h-3 w-3 mr-1" />
                              {selection.periodEnd
                                ? format(selection.periodEnd, 'MMM d, yy')
                                : 'End'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selection.periodEnd || undefined}
                              onSelect={(date) =>
                                updateSelection(cat.value, { periodEnd: date || null })
                              }
                              className="p-3 pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function createEmptySelections(): UsageSelection[] {
  return CATEGORIES.map((cat) => ({
    category: cat.value,
    included: false,
    isPaid: false,
    geographies: [],
    periodStart: null,
    periodEnd: null,
  }));
}
