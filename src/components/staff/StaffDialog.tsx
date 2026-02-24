import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X } from 'lucide-react';

interface StaffMember {
  id?: string;
  full_name: string;
  email: string;
  role_title: string;
  category_id: string | null;
  skills: string[];
  softwares: string[];
}

interface StaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff?: StaffMember | null;
  onSave: (data: Omit<StaffMember, 'id'>) => void;
  existingSkills?: string[];
  existingSoftwares?: string[];
}

export function StaffDialog({ open, onOpenChange, staff, onSave, existingSkills = [], existingSoftwares = [] }: StaffDialogProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [softwares, setSoftwares] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [softwareInput, setSoftwareInput] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['staff_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (staff) {
      setFullName(staff.full_name);
      setEmail(staff.email || '');
      setRoleTitle(staff.role_title || '');
      setCategoryId(staff.category_id || null);
      setSkills(staff.skills || []);
      setSoftwares(staff.softwares || []);
    } else {
      setFullName(''); setEmail(''); setRoleTitle(''); setCategoryId(null);
      setSkills([]); setSoftwares([]);
    }
    setSkillInput(''); setSoftwareInput('');
  }, [staff, open]);

  const addTag = (value: string, list: string[], setter: (v: string[]) => void) => {
    const trimmed = value.trim();
    if (trimmed && !list.includes(trimmed)) setter([...list, trimmed]);
  };

  const removeTag = (value: string, list: string[], setter: (v: string[]) => void) => {
    setter(list.filter(v => v !== value));
  };

  const handleSubmit = () => {
    if (!fullName.trim()) return;
    onSave({ full_name: fullName.trim(), email, role_title: roleTitle, category_id: categoryId, skills, softwares });
    onOpenChange(false);
  };

  const filteredSkillSuggestions = existingSkills.filter(
    s => s.toLowerCase().includes(skillInput.toLowerCase()) && !skills.includes(s)
  ).slice(0, 5);

  const filteredSoftwareSuggestions = existingSoftwares.filter(
    s => s.toLowerCase().includes(softwareInput.toLowerCase()) && !softwares.includes(s)
  ).slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
          <DialogDescription>{staff ? 'Update staff member details.' : 'Add a new team member to your staff directory.'}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name *</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Alice Martin" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="alice@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId || ''} onValueChange={v => setCategoryId(v || null)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Skills tag input */}
          <div className="space-y-2">
            <Label>Skills</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {skills.map(s => (
                <Badge key={s} variant="secondary" className="gap-1 text-xs">
                  {s}
                  <button onClick={() => removeTag(s, skills, setSkills)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Input value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(skillInput, skills, setSkills); setSkillInput(''); } }}
                placeholder="Type and press Enter..." />
              {skillInput && filteredSkillSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-md">
                  {filteredSkillSuggestions.map(s => (
                    <button key={s} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => { addTag(s, skills, setSkills); setSkillInput(''); }}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Software tag input */}
          <div className="space-y-2">
            <Label>Software</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {softwares.map(s => (
                <Badge key={s} variant="outline" className="gap-1 text-xs">
                  {s}
                  <button onClick={() => removeTag(s, softwares, setSoftwares)} className="hover:text-destructive"><X className="w-3 h-3" /></button>
                </Badge>
              ))}
            </div>
            <div className="relative">
              <Input value={softwareInput} onChange={e => setSoftwareInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(softwareInput, softwares, setSoftwares); setSoftwareInput(''); } }}
                placeholder="Type and press Enter..." />
              {softwareInput && filteredSoftwareSuggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-md">
                  {filteredSoftwareSuggestions.map(s => (
                    <button key={s} className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent"
                      onClick={() => { addTag(s, softwares, setSoftwares); setSoftwareInput(''); }}>{s}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!fullName.trim()}>{staff ? 'Save Changes' : 'Add Member'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
