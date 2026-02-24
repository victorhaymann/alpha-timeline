import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Bell, Shield, Palette, Tags, Trash2, Plus } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';

export default function SettingsPage() {
  const { user, profile, role } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [newCategory, setNewCategory] = useState('');

  // --- Profile update ---
  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('id', user.id);
      if (error) throw error;
      toast({ title: 'Profile updated', description: 'Your profile has been updated successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  // --- Staff categories ---
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['staff_categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('staff_categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('staff_categories').insert({ name, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_categories'] });
      setNewCategory('');
      sonnerToast.success('Category added');
    },
    onError: (e: Error) => sonnerToast.error(e.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff_categories'] });
      sonnerToast.success('Category deleted');
    },
    onError: (e: Error) => sonnerToast.error(e.message),
  });

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.some(c => c.name.toLowerCase() === trimmed.toLowerCase())) {
      sonnerToast.error('Category already exists');
      return;
    }
    addCategoryMutation.mutate(trimmed);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" /> Profile
          </TabsTrigger>
          <TabsTrigger value="categories" className="gap-2">
            <Tags className="w-4 h-4" /> Staff Categories
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="w-4 h-4" /> Notifications
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" /> Security
          </TabsTrigger>
          <TabsTrigger value="appearance" className="gap-2">
            <Palette className="w-4 h-4" /> Appearance
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={user?.email || ''} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={role === 'pm' ? 'Project Manager' : 'Client'} disabled className="bg-muted capitalize" />
              </div>
              <Button onClick={handleUpdateProfile} disabled={isUpdating}>
                {isUpdating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>) : 'Save Changes'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Staff Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff Categories</CardTitle>
              <CardDescription>Manage job categories for your staff members</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="New category name..."
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
                />
                <Button onClick={handleAddCategory} disabled={!newCategory.trim() || addCategoryMutation.isPending}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>

              {categoriesLoading ? (
                <div className="flex justify-center py-8 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : categories.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No categories yet.</p>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => deleteCategoryMutation.mutate(cat.id)}
                        disabled={deleteCategoryMutation.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader><CardTitle>Notification Preferences</CardTitle><CardDescription>Configure how you receive notifications</CardDescription></CardHeader>
            <CardContent><p className="text-muted-foreground">Notification settings coming soon.</p></CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader><CardTitle>Security Settings</CardTitle><CardDescription>Manage your account security</CardDescription></CardHeader>
            <CardContent><p className="text-muted-foreground">Password and security settings coming soon.</p></CardContent>
          </Card>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader><CardTitle>Appearance</CardTitle><CardDescription>Customize the look and feel</CardDescription></CardHeader>
            <CardContent><p className="text-muted-foreground">Theme customization coming soon.</p></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
