import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  FileSignature,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  Download,
  Eye,
  Loader2,
  Plus,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RightsAgreement {
  id: string;
  client_name: string;
  client_email: string;
  agreement_date: string;
  valid_from: string;
  valid_until: string | null;
  status: string;
  created_at: string;
}

interface RightsAgreementsListProps {
  projectId: string;
  onCreateNew: () => void;
  onEdit: (agreementId: string) => void;
  readOnly?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  sent: { label: 'Sent', variant: 'outline', className: 'border-amber-500 text-amber-600' },
  viewed: { label: 'Viewed', variant: 'outline', className: 'border-blue-500 text-blue-600' },
  signed: { label: 'Signed', variant: 'default', className: 'bg-status-completed text-white' },
  declined: { label: 'Declined', variant: 'destructive' },
};

export function RightsAgreementsList({
  projectId,
  onCreateNew,
  onEdit,
  readOnly = false,
}: RightsAgreementsListProps) {
  const [agreements, setAgreements] = useState<RightsAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agreementToDelete, setAgreementToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAgreements();
  }, [projectId]);

  const fetchAgreements = async () => {
    try {
      const { data, error } = await supabase
        .from('rights_agreements')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAgreements(data || []);
    } catch (error) {
      console.error('Error fetching agreements:', error);
      toast.error('Failed to load agreements');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!agreementToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('rights_agreements')
        .delete()
        .eq('id', agreementToDelete);

      if (error) throw error;

      setAgreements((prev) => prev.filter((a) => a.id !== agreementToDelete));
      toast.success('Agreement deleted');
    } catch (error) {
      console.error('Error deleting agreement:', error);
      toast.error('Failed to delete agreement');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setAgreementToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (agreements.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <FileSignature className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No Rights Agreements</h3>
          <p className="text-muted-foreground text-center max-w-sm mb-6">
            Create a rights agreement to define video content usage terms with your client.
          </p>
          {!readOnly && (
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Agreement
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex justify-end">
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Agreement
          </Button>
        </div>
      )}

      <div className="space-y-3">
        {agreements.map((agreement) => {
          const statusConfig = STATUS_CONFIG[agreement.status] || STATUS_CONFIG.draft;

          return (
            <Card key={agreement.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{agreement.client_name}</h4>
                        <Badge
                          variant={statusConfig.variant}
                          className={statusConfig.className}
                        >
                          {statusConfig.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{agreement.client_email}</span>
                        <span>•</span>
                        <span>
                          {format(new Date(agreement.valid_from), 'MMM d, yyyy')}
                          {' – '}
                          {agreement.valid_until
                            ? format(new Date(agreement.valid_until), 'MMM d, yyyy')
                            : 'Perpetual'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Created {format(new Date(agreement.created_at), 'MMM d, yyyy')}
                    </span>

                    {!readOnly && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {agreement.status === 'draft' && (
                            <DropdownMenuItem onClick={() => onEdit(agreement.id)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => onEdit(agreement.id)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {agreement.status === 'draft' && (
                            <DropdownMenuItem>
                              <Send className="h-4 w-4 mr-2" />
                              Generate PDF
                            </DropdownMenuItem>
                          )}
                          {agreement.status === 'signed' && (
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download Signed Copy
                            </DropdownMenuItem>
                          )}
                          {agreement.status === 'draft' && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setAgreementToDelete(agreement.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agreement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this rights agreement? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
