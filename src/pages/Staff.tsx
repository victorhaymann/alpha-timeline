import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StaffDialog } from '@/components/staff/StaffDialog';
import { Plus, Search, Pencil, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';

interface StaffMember {
  id: string;
  full_name: string;
  email: string | null;
  role_title: string | null;
  skills: string[];
  softwares: string[];
  is_active: boolean;
  created_by: string;
}

export default function Staff() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: staffMembers = [], isLoading } = useQuery({
    queryKey: ['staff_members'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('full_name');
      if (error) throw error;
      return data as StaffMember[];
    },
  });

  // Collect all existing skills/softwares for autocomplete
  const existingSkills = useMemo(() => {
    const all = new Set<string>();
    staffMembers.forEach(s => s.skills?.forEach(sk => all.add(sk)));
    return Array.from(all).sort();
  }, [staffMembers]);

  const existingSoftwares = useMemo(() => {
    const all = new Set<string>();
    staffMembers.forEach(s => s.softwares?.forEach(sw => all.add(sw)));
    return Array.from(all).sort();
  }, [staffMembers]);

  const createMutation = useMutation({
    mutationFn: async (data: { full_name: string; email: string; role_title: string; skills: string[]; softwares: string[] }) => {
      const { error } = await supabase.from('staff_members').insert({
        ...data,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members'] });
      toast.success('Staff member added');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { full_name: string; email: string; role_title: string; skills: string[]; softwares: string[] } }) => {
      const { error } = await supabase.from('staff_members').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members'] });
      toast.success('Staff member updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_members').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_members'] });
      toast.success('Staff member removed');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = staffMembers.filter(s =>
    !search || s.full_name.toLowerCase().includes(search.toLowerCase()) ||
    s.role_title?.toLowerCase().includes(search.toLowerCase()) ||
    s.skills?.some(sk => sk.toLowerCase().includes(search.toLowerCase())) ||
    s.softwares?.some(sw => sw.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your production team members</p>
        </div>
        <Button onClick={() => { setEditingStaff(null); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Add Staff
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, role, skill..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Users className="w-10 h-10 opacity-40" />
          <p>{search ? 'No matching staff members' : 'No staff members yet'}</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Skills</TableHead>
                <TableHead className="hidden md:table-cell">Software</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(member => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{member.full_name}</span>
                      {member.email && (
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{member.role_title || '—'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {member.skills?.slice(0, 3).map(s => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      {member.skills?.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">+{member.skills.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {member.softwares?.slice(0, 3).map(s => (
                        <Badge key={s} variant="outline" className="text-[10px]">{s}</Badge>
                      ))}
                      {member.softwares?.length > 3 && (
                        <Badge variant="outline" className="text-[10px]">+{member.softwares.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => { setEditingStaff(member); setDialogOpen(true); }}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(member.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <StaffDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        staff={editingStaff}
        existingSkills={existingSkills}
        existingSoftwares={existingSoftwares}
        onSave={(data) => {
          if (editingStaff) {
            updateMutation.mutate({ id: editingStaff.id, data });
          } else {
            createMutation.mutate(data);
          }
        }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will also remove all their project phase assignments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteId) deleteMutation.mutate(deleteId); setDeleteId(null); }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
