import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ProjectOverviewCard } from '@/components/dashboard/ProjectOverviewCard';
import { StaffAllocationChart } from '@/components/dashboard/StaffAllocationChart';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  // Fetch all active/draft projects
  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client_name, start_date, end_date, status')
        .in('status', ['active', 'draft'])
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch all phases with tasks for these projects
  const { data: phases = [] } = useQuery({
    queryKey: ['dashboard_phases', projects.map(p => p.id)],
    enabled: projects.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, name, project_id')
        .in('project_id', projects.map(p => p.id));
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['dashboard_tasks', projects.map(p => p.id)],
    enabled: projects.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, phase_id, project_id, start_date, end_date, name')
        .in('project_id', projects.map(p => p.id));
      if (error) throw error;
      return data;
    },
  });

  // Fetch all phase staff assignments
  const { data: staffAssignments = [] } = useQuery({
    queryKey: ['phase_staff_assignments_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phase_staff_assignments')
        .select('id, phase_id, staff_id');
      if (error) throw error;
      return data;
    },
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ['staff_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, full_name')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const staffMap = useMemo(() => new Map(staffMembers.map(s => [s.id, s.full_name])), [staffMembers]);

  // Build project data with phases and staff
  const projectData = useMemo(() => {
    return projects.map(project => {
      const projectPhases = phases.filter(p => p.project_id === project.id);
      const phaseData = projectPhases.map(phase => ({
        name: phase.name,
        tasks: tasks.filter(t => t.phase_id === phase.id).map(t => ({
          start_date: t.start_date,
          end_date: t.end_date,
        })),
      }));

      const phaseIds = new Set(projectPhases.map(p => p.id));
      const projectStaffIds = new Set(
        staffAssignments.filter(a => phaseIds.has(a.phase_id)).map(a => a.staff_id)
      );
      const assignedStaff = Array.from(projectStaffIds).map(id => staffMap.get(id) || 'Unknown');

      return { project, phases: phaseData, assignedStaff };
    });
  }, [projects, phases, tasks, staffAssignments, staffMap]);

  // Build allocation chart data
  const allocationAssignments = useMemo(() => {
    return staffAssignments.map(a => {
      const phase = phases.find(p => p.id === a.phase_id);
      if (!phase) return null;
      const project = projects.find(p => p.id === phase.project_id);
      if (!project) return null;

      // Get phase date range from tasks
      const phaseTasks = tasks.filter(t => t.phase_id === phase.id && t.start_date && t.end_date);
      if (phaseTasks.length === 0) return null;

      const startDate = phaseTasks.reduce((min, t) => {
        const d = new Date(t.start_date!);
        return d < min ? d : min;
      }, new Date(phaseTasks[0].start_date!));

      const endDate = phaseTasks.reduce((max, t) => {
        const d = new Date(t.end_date!);
        return d > max ? d : max;
      }, new Date(phaseTasks[0].end_date!));

      return {
        staffId: a.staff_id,
        staffName: staffMap.get(a.staff_id) || 'Unknown',
        projectId: project.id,
        projectName: project.name,
        phaseName: phase.name,
        startDate,
        endDate,
        color: '',
      };
    }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[];
  }, [staffAssignments, phases, projects, tasks, staffMap]);

  return (
    <TooltipProvider>
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6" /> Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Production overview · {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
        </div>

        {/* Active Projects */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Active Projects</h2>
          {projectData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No active projects</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projectData.map(({ project, phases, assignedStaff }) => (
                <ProjectOverviewCard
                  key={project.id}
                  project={project}
                  phases={phases}
                  assignedStaff={assignedStaff}
                />
              ))}
            </div>
          )}
        </section>

        {/* Staff Allocation */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Staff Allocation</h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <StaffAllocationChart assignments={allocationAssignments as any} />
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
