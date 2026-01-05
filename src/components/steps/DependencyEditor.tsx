import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CanonicalStep, PHASE_CATEGORIES, PHASE_CATEGORY_COLORS, PhaseCategory } from '@/types/database';
import { CustomStep } from './AddCustomStepDialog';
import { 
  ArrowRight,
  Link2,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  Layers,
  Flag,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LocalDependency {
  id: string;
  predecessorId: string;
  successorId: string;
}

interface UnifiedStep {
  id: string;
  name: string;
  phase_category: string;
  isCustom: boolean;
  task_type?: string;
}

interface DependencyEditorProps {
  canonicalSteps: CanonicalStep[];
  selectedStepIds: Set<string>;
  customSteps: CustomStep[];
  dependencies: LocalDependency[];
  onAddDependency: (predecessorId: string, successorId: string) => void;
  onRemoveDependency: (dependencyId: string) => void;
}

export function DependencyEditor({
  canonicalSteps,
  selectedStepIds,
  customSteps,
  dependencies,
  onAddDependency,
  onRemoveDependency,
}: DependencyEditorProps) {
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [selectedPredecessor, setSelectedPredecessor] = useState<string>('');
  const [selectedSuccessor, setSelectedSuccessor] = useState<string>('');

  // Combine canonical and custom steps into unified list
  const allSteps: UnifiedStep[] = useMemo(() => {
    const canonical = canonicalSteps
      .filter(s => selectedStepIds.has(s.id))
      .map(s => ({
        id: s.id,
        name: s.name,
        phase_category: s.phase_category,
        isCustom: false,
        task_type: s.task_type,
      }));
    
    const custom = customSteps.map(s => ({
      id: s.id,
      name: s.name,
      phase_category: s.phase_category,
      isCustom: true,
      task_type: 'task',
    }));

    return [...canonical, ...custom];
  }, [canonicalSteps, selectedStepIds, customSteps]);

  // Group steps by phase
  const groupedSteps = useMemo(() => {
    return PHASE_CATEGORIES.reduce((acc, category) => {
      acc[category] = allSteps.filter(s => s.phase_category === category);
      return acc;
    }, {} as Record<PhaseCategory, UnifiedStep[]>);
  }, [allSteps]);

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

  const handleAddDependency = () => {
    if (selectedPredecessor && selectedSuccessor && selectedPredecessor !== selectedSuccessor) {
      // Check if dependency already exists
      const exists = dependencies.some(
        d => d.predecessorId === selectedPredecessor && d.successorId === selectedSuccessor
      );
      if (!exists) {
        onAddDependency(selectedPredecessor, selectedSuccessor);
        setSelectedPredecessor('');
        setSelectedSuccessor('');
      }
    }
  };

  const getStepName = (stepId: string) => {
    const step = allSteps.find(s => s.id === stepId);
    return step?.name || 'Unknown';
  };

  const getStepDependencies = (stepId: string) => {
    return dependencies.filter(d => d.successorId === stepId);
  };

  const getStepDependents = (stepId: string) => {
    return dependencies.filter(d => d.predecessorId === stepId);
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'milestone': return <Flag className="w-3.5 h-3.5" />;
      case 'meeting': return <Users className="w-3.5 h-3.5" />;
      default: return <Layers className="w-3.5 h-3.5" />;
    }
  };

  if (allSteps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Link2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No steps selected yet.</p>
        <p className="text-sm">Go back to select steps first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Add Dependency */}
      <Card className="bg-accent/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Dependency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Select value={selectedPredecessor} onValueChange={setSelectedPredecessor}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select predecessor..." />
              </SelectTrigger>
              <SelectContent>
                {allSteps.map(step => (
                  <SelectItem key={step.id} value={step.id}>
                    <span className="flex items-center gap-2">
                      {step.name}
                      {step.isCustom && (
                        <Badge variant="outline" className="text-[10px] py-0">Custom</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
            
            <Select value={selectedSuccessor} onValueChange={setSelectedSuccessor}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select successor..." />
              </SelectTrigger>
              <SelectContent>
                {allSteps
                  .filter(s => s.id !== selectedPredecessor)
                  .map(step => (
                    <SelectItem key={step.id} value={step.id}>
                      <span className="flex items-center gap-2">
                        {step.name}
                        {step.isCustom && (
                          <Badge variant="outline" className="text-[10px] py-0">Custom</Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            
            <Button 
              onClick={handleAddDependency}
              disabled={!selectedPredecessor || !selectedSuccessor || selectedPredecessor === selectedSuccessor}
              size="sm"
            >
              <Link2 className="w-4 h-4 mr-1" />
              Link
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            The successor task will start after the predecessor is complete.
          </p>
        </CardContent>
      </Card>

      {/* Steps with Dependencies */}
      <div className="space-y-3">
        {PHASE_CATEGORIES.map((category) => {
          const categorySteps = groupedSteps[category];
          if (categorySteps.length === 0) return null;

          const isCollapsed = collapsedPhases.has(category);
          const color = PHASE_CATEGORY_COLORS[category];

          return (
            <Card key={category} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-accent/50 transition-colors py-3"
                onClick={() => togglePhaseCollapse(category)}
              >
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
                  <CardTitle className="text-sm">{category}</CardTitle>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {categorySteps.length} steps
                  </Badge>
                </div>
              </CardHeader>
              
              {!isCollapsed && (
                <CardContent className="pt-0 pb-3">
                  <div className="space-y-2">
                    {categorySteps.map((step) => {
                      const stepDependencies = getStepDependencies(step.id);
                      const stepDependents = getStepDependents(step.id);

                      return (
                        <div 
                          key={step.id}
                          className={cn(
                            "p-3 rounded-lg border",
                            step.isCustom ? "bg-primary/5 border-primary/20" : "bg-accent/30 border-transparent"
                          )}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {getTypeIcon(step.task_type)}
                            <span className="font-medium text-sm">{step.name}</span>
                            {step.isCustom && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                Custom
                              </Badge>
                            )}
                          </div>
                          
                          {/* Dependencies (what this step depends on) */}
                          {stepDependencies.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                              <span className="text-muted-foreground">Depends on:</span>
                              {stepDependencies.map(dep => (
                                <Badge 
                                  key={dep.id} 
                                  variant="secondary"
                                  className="gap-1 pr-1"
                                >
                                  {getStepName(dep.predecessorId)}
                                  <button
                                    onClick={() => onRemoveDependency(dep.id)}
                                    className="ml-1 p-0.5 hover:bg-destructive/20 rounded"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}

                          {/* Dependents (what depends on this step) */}
                          {stepDependents.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2 text-xs mt-2">
                              <span className="text-muted-foreground">Required by:</span>
                              {stepDependents.map(dep => (
                                <Badge 
                                  key={dep.id} 
                                  variant="outline"
                                  className="gap-1 text-muted-foreground"
                                >
                                  {getStepName(dep.successorId)}
                                </Badge>
                              ))}
                            </div>
                          )}

                          {stepDependencies.length === 0 && stepDependents.length === 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              No dependencies set
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Summary */}
      <div className="text-center text-sm text-muted-foreground">
        <Link2 className="w-4 h-4 inline mr-1" />
        {dependencies.length} {dependencies.length === 1 ? 'dependency' : 'dependencies'} configured
      </div>
    </div>
  );
}
