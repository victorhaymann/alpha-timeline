import { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  ConnectionMode,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType,
  NodeProps,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CanonicalStep, PHASE_CATEGORIES, PHASE_CATEGORY_COLORS, PhaseCategory } from '@/types/database';
import { CustomStep } from './AddCustomStepDialog';
import { LocalDependency } from './DependencyEditor';
import { Badge } from '@/components/ui/badge';
import { Flag, Users, Layers, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnifiedStep {
  id: string;
  name: string;
  phase_category: string;
  isCustom: boolean;
  task_type?: string;
}

interface DependencyGraphProps {
  canonicalSteps: CanonicalStep[];
  selectedStepIds: Set<string>;
  customSteps: CustomStep[];
  dependencies: LocalDependency[];
  onAddDependency: (predecessorId: string, successorId: string) => void;
  onRemoveDependency: (dependencyId: string) => void;
}

// Custom node component
function TaskNode({ data }: NodeProps) {
  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'milestone': return <Flag className="w-3 h-3" />;
      case 'meeting': return <Users className="w-3 h-3" />;
      default: return <Layers className="w-3 h-3" />;
    }
  };

  return (
    <div
      className={cn(
        "px-3 py-2 rounded-lg border-2 shadow-md min-w-[140px] max-w-[180px]",
        "bg-card text-card-foreground",
        data.isCustom && "border-primary/50 bg-primary/5"
      )}
      style={{ borderColor: data.phaseColor }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-muted-foreground !w-2 !h-2"
      />
      <div className="flex items-start gap-2">
        <div 
          className="p-1 rounded shrink-0 mt-0.5"
          style={{ backgroundColor: `${data.phaseColor}20` }}
        >
          {getTypeIcon(data.taskType)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium leading-tight truncate" title={data.label}>
            {data.label}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <Badge 
              variant="outline" 
              className="text-[9px] py-0 px-1"
              style={{ borderColor: data.phaseColor, color: data.phaseColor }}
            >
              {data.phase}
            </Badge>
            {data.isParallel && (
              <Badge variant="secondary" className="text-[9px] py-0 px-1 gap-0.5">
                <Zap className="w-2 h-2" />
                Parallel
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-muted-foreground !w-2 !h-2"
      />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

export function DependencyGraph({
  canonicalSteps,
  selectedStepIds,
  customSteps,
  dependencies,
  onAddDependency,
  onRemoveDependency,
}: DependencyGraphProps) {
  // Combine canonical and custom steps
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

  // Check if a step can run in parallel (no dependencies pointing to or from it)
  const getParallelStatus = useCallback((stepId: string) => {
    const hasDependencies = dependencies.some(
      d => d.successorId === stepId
    );
    const hasDependents = dependencies.some(
      d => d.predecessorId === stepId
    );
    // A task is "parallel-capable" if it has no incoming dependencies
    // but we mark it as parallel if there are other tasks in same phase without dependencies
    return !hasDependencies;
  }, [dependencies]);

  // Create nodes with layout based on phases
  const initialNodes: Node[] = useMemo(() => {
    const nodes: Node[] = [];
    const phaseGroups: Record<string, UnifiedStep[]> = {};

    // Group steps by phase
    allSteps.forEach(step => {
      if (!phaseGroups[step.phase_category]) {
        phaseGroups[step.phase_category] = [];
      }
      phaseGroups[step.phase_category].push(step);
    });

    // Position nodes
    let xOffset = 50;
    const ySpacing = 100;
    const xSpacing = 250;

    PHASE_CATEGORIES.forEach(phase => {
      const phaseSteps = phaseGroups[phase] || [];
      if (phaseSteps.length === 0) return;

      const phaseColor = PHASE_CATEGORY_COLORS[phase as PhaseCategory];
      
      phaseSteps.forEach((step, idx) => {
        nodes.push({
          id: step.id,
          type: 'task',
          position: { x: xOffset, y: 50 + idx * ySpacing },
          data: {
            label: step.name,
            phase: phase,
            phaseColor: phaseColor,
            isCustom: step.isCustom,
            taskType: step.task_type,
            isParallel: getParallelStatus(step.id),
          },
        });
      });

      xOffset += xSpacing;
    });

    return nodes;
  }, [allSteps, getParallelStatus]);

  // Create edges from dependencies
  const initialEdges: Edge[] = useMemo(() => {
    return dependencies.map(dep => ({
      id: dep.id,
      source: dep.predecessorId,
      target: dep.successorId,
      type: 'smoothstep',
      animated: true,
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'hsl(var(--primary))',
      },
    }));
  }, [dependencies]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when steps change
  useMemo(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Update edges when dependencies change
  useMemo(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle new connection
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target && connection.source !== connection.target) {
        // Check if dependency already exists
        const exists = dependencies.some(
          d => d.predecessorId === connection.source && d.successorId === connection.target
        );
        if (!exists) {
          onAddDependency(connection.source, connection.target);
        }
      }
    },
    [dependencies, onAddDependency]
  );

  // Handle edge deletion
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      onRemoveDependency(edge.id);
    },
    [onRemoveDependency]
  );

  if (allSteps.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-muted-foreground border rounded-lg bg-muted/20">
        <p>No steps selected. Go back to select steps first.</p>
      </div>
    );
  }

  return (
    <div className="h-[500px] border rounded-lg overflow-hidden bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        connectionMode={ConnectionMode.Loose}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(var(--muted-foreground))" gap={20} size={1} />
        <Controls className="!bg-card !border-border !shadow-lg" />
      </ReactFlow>
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur p-3 rounded-lg border shadow-sm text-xs space-y-1">
        <p className="font-medium">How to use:</p>
        <p className="text-muted-foreground">• Drag from node handles to create dependencies</p>
        <p className="text-muted-foreground">• Click on an edge to remove it</p>
        <p className="text-muted-foreground">• Tasks without incoming arrows run in parallel</p>
      </div>
    </div>
  );
}
