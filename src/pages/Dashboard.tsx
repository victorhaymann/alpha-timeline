import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ProjectsGantt } from '@/components/dashboard/ProjectsGantt';
import { StaffGantt } from '@/components/dashboard/StaffGantt';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LayoutDashboard } from 'lucide-react';

export default function Dashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ['dashboard_projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client_name, start_date, end_date, status')
        .in('status', ['active', 'draft', 'completed'])
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: phases = [] } = useQuery({
    queryKey: ['dashboard_phases', projects.map(p => p.id)],
    enabled: projects.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phases')
        .select('id, name, project_id, color, order_index')
        .in('project_id', projects.map(p => p.id))
        .order('order_index');
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
    queryKey: ['staff_members_with_category'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, full_name, category_id')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
  });

  const { data: staffCategories = [] } = useQuery({
    queryKey: ['staff_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_categories')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const categoryMap = useMemo(() => new Map(staffCategories.map(c => [c.id, c.name])), [staffCategories]);

  // Build ProjectsGantt data
  const projectRows = useMemo(() => {
    return projects.map(project => {
      const projectPhases = phases.filter(p => p.project_id === project.id);
      const phaseBars = projectPhases.map(phase => {
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
          name: phase.name,
          color: phase.color || '',
          startDate,
          endDate,
        };
      }).filter(Boolean) as { name: string; color: string; startDate: Date; endDate: Date }[];

      return {
        id: project.id,
        name: project.name,
        clientName: project.client_name,
        status: project.status,
        startDate: new Date(project.start_date),
        endDate: new Date(project.end_date),
        phases: phaseBars,
      };
    });
  }, [projects, phases, tasks]);

  // Build StaffGantt data
  const staffData = useMemo(() => {
    return staffMembers.map(s => ({
      id: s.id,
      fullName: s.full_name,
      categoryId: s.category_id,
      categoryName: s.category_id ? categoryMap.get(s.category_id) || null : null,
    }));
  }, [staffMembers, categoryMap]);

  const staffAssignmentBars = useMemo(() => {
    return staffAssignments.map(a => {
      const phase = phases.find(p => p.id === a.phase_id);
      if (!phase) return null;
      const project = projects.find(p => p.id === phase.project_id);
      if (!project) return null;
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
        projectId: project.id,
        projectName: project.name,
        phaseName: phase.name,
        startDate,
        endDate,
        color: '',
      };
    }).filter(Boolean) as {
      staffId: string;
      projectId: string;
      projectName: string;
      phaseName: string;
      startDate: Date;
      endDate: Date;
      color: string;
    }[];
  }, [staffAssignments, phases, projects, tasks]);

  return (
    <TooltipProvider>
      <div className="max-w-[1600px] mx-auto p-4 md:p-6 space-y-6">
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

        <ProjectsGantt projects={projectRows} />
        <StaffGantt
          staff={staffData}
          assignments={staffAssignmentBars}
          categories={staffCategories}
        />
      </div>
    </TooltipProvider>
  );
}
