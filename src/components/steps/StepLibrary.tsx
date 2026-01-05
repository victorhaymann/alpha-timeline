import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CanonicalStep, PHASE_CATEGORIES, PHASE_CATEGORY_COLORS, PhaseCategory } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AddCustomStepDialog, CustomStep } from './AddCustomStepDialog';
import { 
  Loader2, 
  Flag, 
  Users, 
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Plus,
  Eye,
  EyeOff,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepLibraryProps {
  selectedSteps?: Set<string>;
  onStepToggle?: (stepId: string, included: boolean) => void;
  stepDays?: Map<string, number>;
  onStepDaysChange?: (stepId: string, days: number) => void;
  customSteps?: CustomStep[];
  onAddCustomStep?: (step: CustomStep) => void;
  onRemoveCustomStep?: (stepId: string) => void;
  onUpdateCustomStep?: (stepId: string, updates: Partial<CustomStep>) => void;
  readOnly?: boolean;
  allowLibraryEdit?: boolean;
  onDeleteCanonicalStep?: (stepId: string) => void;
}

export function StepLibrary({ 
  selectedSteps, 
  onStepToggle, 
  stepDays,
  onStepDaysChange,
  customSteps = [],
  onAddCustomStep,
  onRemoveCustomStep,
  onUpdateCustomStep,
  readOnly = false,
  allowLibraryEdit = false,
  onDeleteCanonicalStep
}: StepLibraryProps) {
  const [steps, setSteps] = useState<CanonicalStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addDialogPhase, setAddDialogPhase] = useState<PhaseCategory>('Production');

  useEffect(() => {
    fetchSteps();
  }, []);

  const fetchSteps = async () => {
    try {
      const { data, error } = await supabase
        .from('canonical_steps')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSteps((data as CanonicalStep[]) || []);
    } catch (error) {
      console.error('Error fetching canonical steps:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePhaseCollapse = (phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  };

  const openAddDialog = (phase: PhaseCategory) => {
    setAddDialogPhase(phase);
    setAddDialogOpen(true);
  };

  // Group canonical steps by phase
  const groupedSteps = PHASE_CATEGORIES.reduce((acc, category) => {
    acc[category] = steps.filter(s => s.phase_category === category);
    return acc;
  }, {} as Record<PhaseCategory, CanonicalStep[]>);

  // Group custom steps by phase
  const groupedCustomSteps = PHASE_CATEGORIES.reduce((acc, category) => {
    acc[category] = customSteps.filter(s => s.phase_category === category);
    return acc;
  }, {} as Record<PhaseCategory, CustomStep[]>);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'milestone': return <Flag className="w-3.5 h-3.5" />;
      case 'meeting': return <Users className="w-3.5 h-3.5" />;
      default: return <Layers className="w-3.5 h-3.5" />;
    }
  };

  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'milestone': return 'bg-status-review/20 text-status-review border-status-review/30';
      case 'meeting': return 'bg-primary/20 text-primary border-primary/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {PHASE_CATEGORIES.map((category) => {
        const categorySteps = groupedSteps[category];
        const categoryCustomSteps = groupedCustomSteps[category];
        const totalSteps = categorySteps.length + categoryCustomSteps.length;
        
        if (categorySteps.length === 0 && categoryCustomSteps.length === 0 && readOnly) return null;

        const isCollapsed = collapsedPhases.has(category);
        const color = PHASE_CATEGORY_COLORS[category];
        const isImmersive = category === 'Immersive';
        
        const includedCanonicalCount = selectedSteps 
          ? categorySteps.filter(s => selectedSteps.has(s.id)).length 
          : categorySteps.filter(s => !s.is_optional).length;
        const totalIncluded = includedCanonicalCount + categoryCustomSteps.length;

        return (
          <Card key={category} className="overflow-hidden">
            <CardHeader 
              className="cursor-pointer hover:bg-accent/50 transition-colors py-4"
              onClick={() => togglePhaseCollapse(category)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <CardTitle className="text-base">{category}</CardTitle>
                  {isImmersive && (
                    <Badge variant="outline" className="gap-1 text-xs bg-pink-500/10 text-pink-400 border-pink-500/30">
                      <Sparkles className="w-3 h-3" />
                      Add-on
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {totalIncluded}/{totalSteps} steps
                  </Badge>
                </div>
              </div>
            </CardHeader>
            
            {!isCollapsed && (
              <CardContent className="pt-0 pb-4">
                <div className="space-y-2">
                  {/* Canonical Steps */}
                  {categorySteps.map((step) => {
                    const isIncluded = selectedSteps 
                      ? selectedSteps.has(step.id)
                      : !step.is_optional;

                    return (
                      <div 
                        key={step.id}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg transition-colors",
                          isIncluded ? "bg-accent/50" : "bg-muted/30",
                          !readOnly && "hover:bg-accent"
                        )}
                      >
                        {!readOnly && (
                          <Checkbox
                            checked={isIncluded}
                            onCheckedChange={(checked) => onStepToggle?.(step.id, checked as boolean)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-medium text-sm",
                              !isIncluded && "text-muted-foreground"
                            )}>
                              {step.name}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs gap-1", getTypeBadgeClass(step.task_type))}
                            >
                              {getTypeIcon(step.task_type)}
                              {step.task_type}
                            </Badge>
                            {step.is_optional && (
                              <Badge variant="outline" className="text-xs bg-muted/50">
                                Optional
                              </Badge>
                            )}
                          </div>
                          {step.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {step.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                          {!readOnly && onStepDaysChange ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="number"
                                min={1}
                                max={365}
                                value={stepDays?.get(step.id) ?? 1}
                                onChange={(e) => onStepDaysChange(step.id, parseInt(e.target.value) || 1)}
                                className="w-14 h-7 text-xs text-center"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-muted-foreground">days</span>
                            </div>
                          ) : (
                            <span>{stepDays?.get(step.id) ?? 1} days</span>
                          )}
                          {allowLibraryEdit && onDeleteCanonicalStep && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCanonicalStep(step.id);
                              }}
                              className="p-1 hover:bg-destructive/20 rounded text-destructive"
                              title="Delete step from library"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom Steps */}
                  {categoryCustomSteps.map((step) => (
                    <div 
                      key={step.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20"
                    >
                      <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center">
                        <Plus className="w-3 h-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{step.name}</span>
                          <Badge variant="outline" className="text-xs gap-1 bg-primary/10 text-primary border-primary/30">
                            Custom
                          </Badge>
                          {step.client_visible ? (
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                        {!readOnly && onUpdateCustomStep ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              max={365}
                              value={step.days ?? 1}
                              onChange={(e) => onUpdateCustomStep(step.id, { days: parseInt(e.target.value) || 1 })}
                              className="w-14 h-7 text-xs text-center"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="text-muted-foreground">days</span>
                          </div>
                        ) : (
                          <span>{step.days ?? 1} days</span>
                        )}
                        {!readOnly && onRemoveCustomStep && (
                          <button
                            onClick={() => onRemoveCustomStep(step.id)}
                            className="p-1 hover:bg-destructive/20 rounded text-destructive"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Add Custom Step Button */}
                  {!readOnly && onAddCustomStep && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground mt-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddDialog(category);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Add custom step to {category}
                    </Button>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      <AddCustomStepDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onAdd={(step) => onAddCustomStep?.(step)}
        defaultPhase={addDialogPhase}
      />
    </div>
  );
}

