import { Link } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { differenceInDays } from 'date-fns';

interface ProjectOverviewCardProps {
  project: {
    id: string;
    name: string;
    client_name: string | null;
    start_date: string;
    end_date: string;
    status: string;
  };
  phases: { name: string; tasks: { start_date: string | null; end_date: string | null }[] }[];
  assignedStaff: string[];
}

export function ProjectOverviewCard({ project, phases, assignedStaff }: ProjectOverviewCardProps) {
  const today = new Date();
  const start = new Date(project.start_date);
  const end = new Date(project.end_date);
  const totalDays = Math.max(differenceInDays(end, start), 1);
  const elapsed = Math.max(0, differenceInDays(today, start));
  const progress = Math.min(100, Math.round((elapsed / totalDays) * 100));

  // Determine current phase based on today's date
  let currentPhase = '—';
  for (const phase of phases) {
    const phaseDates = phase.tasks
      .filter(t => t.start_date && t.end_date)
      .map(t => ({ start: new Date(t.start_date!), end: new Date(t.end_date!) }));
    
    if (phaseDates.length > 0) {
      const phaseStart = phaseDates.reduce((min, d) => d.start < min ? d.start : min, phaseDates[0].start);
      const phaseEnd = phaseDates.reduce((max, d) => d.end > max ? d.end : max, phaseDates[0].end);
      if (today >= phaseStart && today <= phaseEnd) {
        currentPhase = phase.name;
      }
    }
  }

  const statusColor = project.status === 'active' 
    ? 'bg-emerald-500/20 text-emerald-400' 
    : project.status === 'completed' 
      ? 'bg-muted text-muted-foreground' 
      : 'bg-amber-500/20 text-amber-400';

  return (
    <Link 
      to={`/projects/${project.id}`}
      className="block p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-sm">{project.name}</h3>
          {project.client_name && (
            <p className="text-xs text-muted-foreground">{project.client_name}</p>
          )}
        </div>
        <Badge className={`text-[10px] ${statusColor} border-0`}>
          {project.status}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{currentPhase}</span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      {assignedStaff.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {assignedStaff.slice(0, 4).map(name => (
            <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
              {name}
            </span>
          ))}
          {assignedStaff.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{assignedStaff.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  );
}
