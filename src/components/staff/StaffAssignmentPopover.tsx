import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';

interface StaffAssignmentPopoverProps {
  phaseId: string;
  projectId: string;
}

export function StaffAssignmentPopover({ phaseId, projectId }: StaffAssignmentPopoverProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: allStaff = [] } = useQuery({
    queryKey: ['staff_members_with_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('id, full_name, category_id, staff_categories(name)')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data as { id: string; full_name: string; category_id: string | null; staff_categories: { name: string } | null }[];
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['phase_staff_assignments', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase.from('phase_staff_assignments').select('id, staff_id').eq('phase_id', phaseId);
      if (error) throw error;
      return data;
    },
  });

  const assignedIds = new Set(assignments.map(a => a.staff_id));

  const toggleMutation = useMutation({
    mutationFn: async (staffId: string) => {
      if (assignedIds.has(staffId)) {
        const assignment = assignments.find(a => a.staff_id === staffId);
        if (assignment) {
          const { error } = await supabase.from('phase_staff_assignments').delete().eq('id', assignment.id);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('phase_staff_assignments').insert({ phase_id: phaseId, staff_id: staffId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase_staff_assignments', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['phase_staff_assignments_all'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Group staff by category
  const grouped = allStaff.reduce<Record<string, typeof allStaff>>((acc, s) => {
    const cat = s.staff_categories?.name || 'Uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const sortedCategories = Object.keys(grouped).sort((a, b) => {
    if (a === 'Uncategorized') return 1;
    if (b === 'Uncategorized') return -1;
    return a.localeCompare(b);
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
          title="Assign staff"
          onClick={e => e.stopPropagation()}
        >
          <UserPlus className="w-3 h-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start" onClick={e => e.stopPropagation()}>
        <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wide">Assign Staff</p>
        {allStaff.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-2">No staff members yet</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-1">
            {sortedCategories.map(cat => (
              <div key={cat}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 pt-2 pb-0.5">{cat}</p>
                {grouped[cat].map(staff => (
                  <label key={staff.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                    <Checkbox checked={assignedIds.has(staff.id)} onCheckedChange={() => toggleMutation.mutate(staff.id)} />
                    <span className="truncate">{staff.full_name}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
