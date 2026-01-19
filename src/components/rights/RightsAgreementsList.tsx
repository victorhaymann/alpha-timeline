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
  Copy,
  FileSearch,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { AgreementPreviewDialog } from './AgreementPreviewDialog';

interface RightsAgreement {
  id: string;
  client_name: string;
  client_email: string;
  agreement_date: string;
  valid_from: string;
  valid_until: string | null;
  status: string;
  generated_document_path: string | null;
  signed_document_path: string | null;
  signwell_document_id: string | null;
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
  const { user } = useAuth();
  const [agreements, setAgreements] = useState<RightsAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agreementToDelete, setAgreementToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [sendingForSignature, setSendingForSignature] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [previewAgreementId, setPreviewAgreementId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const handleGeneratePdf = async (agreementId: string) => {
    setGeneratingPdf(agreementId);
    try {
      toast.info('Generating agreement document...');
      
      const { data: pdfResult, error: pdfError } = await supabase.functions.invoke(
        'generate-rights-pdf',
        { body: { agreementId } }
      );

      if (pdfError) {
        console.error('PDF generation error:', pdfError);
        toast.error('Failed to generate document');
        return;
      }

      if (pdfResult?.documentUrl) {
        toast.success('Agreement document generated!');
        // Update the agreement in local state
        setAgreements((prev) =>
          prev.map((a) =>
            a.id === agreementId
              ? { ...a, generated_document_path: pdfResult.documentPath }
              : a
          )
        );
        // Open the document in a new tab
        window.open(pdfResult.documentUrl, '_blank');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate document');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleSendForSignature = async (agreementId: string) => {
    setSendingForSignature(agreementId);
    try {
      toast.info('Sending agreement for signature...');
      
      const { data: result, error } = await supabase.functions.invoke(
        'send-rights-signwell',
        { body: { agreementId, testMode: false } }
      );

      if (error) {
        console.error('Send for signature error:', error);
        toast.error('Failed to send for signature');
        return;
      }

      if (result?.success) {
        toast.success(result.message || 'Agreement sent for signature!');
        setAgreements((prev) =>
          prev.map((a) =>
            a.id === agreementId
              ? { ...a, status: 'sent', signwell_document_id: result.signwellDocumentId }
              : a
          )
        );
      } else {
        toast.error(result?.error || 'Failed to send for signature');
      }
    } catch (error) {
      console.error('Error sending for signature:', error);
      toast.error('Failed to send for signature');
    } finally {
      setSendingForSignature(null);
    }
  };

  const handleDuplicate = async (agreementId: string) => {
    if (!user) return;
    
    setDuplicating(agreementId);
    try {
      // Fetch the original agreement
      const { data: original, error: fetchError } = await supabase
        .from('rights_agreements')
        .select('*')
        .eq('id', agreementId)
        .single();

      if (fetchError || !original) {
        throw new Error('Failed to fetch original agreement');
      }

      // Create a new agreement with copied data
      const { data: newAgreement, error: insertError } = await supabase
        .from('rights_agreements')
        .insert({
          project_id: projectId,
          client_name: original.client_name,
          client_email: original.client_email,
          client_contact_name: original.client_contact_name,
          agreement_date: new Date().toISOString().split('T')[0], // Today's date
          valid_from: original.valid_from,
          valid_until: original.valid_until,
          status: 'draft',
          created_by: user.id,
        })
        .select()
        .single();

      if (insertError || !newAgreement) {
        throw new Error('Failed to create duplicate agreement');
      }

      // Copy usage selections
      const { data: selections, error: selectionsError } = await supabase
        .from('rights_usage_selections')
        .select('*')
        .eq('agreement_id', agreementId);

      if (!selectionsError && selections && selections.length > 0) {
        const newSelections = selections.map((sel) => ({
          agreement_id: newAgreement.id,
          category: sel.category,
          is_paid: sel.is_paid,
          geographies: sel.geographies,
          period_start: sel.period_start,
          period_end: sel.period_end,
        }));

        await supabase.from('rights_usage_selections').insert(newSelections);
      }

      toast.success('Agreement duplicated as draft');
      
      // Refresh the list
      fetchAgreements();
    } catch (error) {
      console.error('Error duplicating agreement:', error);
      toast.error('Failed to duplicate agreement');
    } finally {
      setDuplicating(null);
    }
  };

  const handleDownloadDocument = async (agreementId: string, path: string | null) => {
    if (!path) {
      toast.error('No document available');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('rights-agreements')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
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
          const isSigned = agreement.status === 'signed';
          const isDeclined = agreement.status === 'declined';
          const isSent = agreement.status === 'sent' || agreement.status === 'viewed';

          // Dynamic icon and colors based on status
          const IconComponent = isSigned ? CheckCircle2 : FileText;
          const iconBgClass = isSigned
            ? 'bg-status-completed/10'
            : isDeclined
            ? 'bg-destructive/10'
            : isSent
            ? 'bg-amber-500/10'
            : 'bg-primary/10';
          const iconColorClass = isSigned
            ? 'text-status-completed'
            : isDeclined
            ? 'text-destructive'
            : isSent
            ? 'text-amber-600'
            : 'text-primary';

          return (
            <Card
              key={agreement.id}
              className={cn(
                'hover:shadow-md transition-shadow',
                isSigned && 'border-l-4 border-l-status-completed'
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBgClass)}>
                      <IconComponent className={cn('w-5 h-5', iconColorClass)} />
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
                          <DropdownMenuItem
                            onClick={() => handleDuplicate(agreement.id)}
                            disabled={duplicating === agreement.id}
                          >
                            {duplicating === agreement.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Copy className="h-4 w-4 mr-2" />
                            )}
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setPreviewAgreementId(agreement.id);
                              setPreviewOpen(true);
                            }}
                          >
                            <FileSearch className="h-4 w-4 mr-2" />
                            Preview Document
                          </DropdownMenuItem>
                          {agreement.status === 'draft' && !agreement.signwell_document_id && (
                            <DropdownMenuItem
                              onClick={() => handleSendForSignature(agreement.id)}
                              disabled={sendingForSignature === agreement.id}
                            >
                              {sendingForSignature === agreement.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Send for Signature
                            </DropdownMenuItem>
                          )}
                          {agreement.status === 'signed' && agreement.signed_document_path && (
                            <DropdownMenuItem
                              onClick={() => handleDownloadDocument(agreement.id, agreement.signed_document_path)}
                            >
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Open Signed Document
                            </DropdownMenuItem>
                          )}
                          {(agreement.status === 'sent' || agreement.status === 'viewed') && agreement.generated_document_path && (
                            <DropdownMenuItem
                              onClick={() => handleDownloadDocument(agreement.id, agreement.generated_document_path)}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Sent Document
                            </DropdownMenuItem>
                          )}
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

      <AgreementPreviewDialog
        agreementId={previewAgreementId}
        projectId={projectId}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) setPreviewAgreementId(null);
        }}
        onGeneratePdf={(id) => {
          setPreviewOpen(false);
          handleGeneratePdf(id);
        }}
        generatingPdf={generatingPdf !== null}
      />
    </div>
  );
}
