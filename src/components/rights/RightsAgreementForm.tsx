import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CalendarIcon, ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UsageRightsMatrix, UsageSelection, createEmptySelections } from './UsageRightsMatrix';
import type { Project } from '@/types/database';

const formSchema = z.object({
  clientName: z.string().min(1, 'Client name is required'),
  clientEmail: z.string().email('Valid email is required'),
  clientContactName: z.string().optional(),
  agreementDate: z.date(),
  validFrom: z.date(),
  validUntil: z.date().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

interface RightsAgreementFormProps {
  projectId: string;
  project: Project;
  agreementId?: string;
  onBack: () => void;
  onSaved: () => void;
}

export function RightsAgreementForm({
  projectId,
  project,
  agreementId,
  onBack,
  onSaved,
}: RightsAgreementFormProps) {
  const { user } = useAuth();
  const [usageSelections, setUsageSelections] = useState<UsageSelection[]>(createEmptySelections());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!agreementId);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: project.client_name || '',
      clientEmail: '',
      clientContactName: '',
      agreementDate: new Date(),
      validFrom: new Date(project.start_date),
      validUntil: null,
    },
  });

  useEffect(() => {
    if (agreementId) {
      loadAgreement();
    }
  }, [agreementId]);

  const loadAgreement = async () => {
    try {
      const { data: agreement, error: agreementError } = await supabase
        .from('rights_agreements')
        .select('*')
        .eq('id', agreementId)
        .single();

      if (agreementError) throw agreementError;

      form.reset({
        clientName: agreement.client_name,
        clientEmail: agreement.client_email,
        clientContactName: agreement.client_contact_name || '',
        agreementDate: new Date(agreement.agreement_date),
        validFrom: new Date(agreement.valid_from),
        validUntil: agreement.valid_until ? new Date(agreement.valid_until) : null,
      });

      const { data: selections, error: selectionsError } = await supabase
        .from('rights_usage_selections')
        .select('*')
        .eq('agreement_id', agreementId);

      if (selectionsError) throw selectionsError;

      if (selections && selections.length > 0) {
        setUsageSelections(
          createEmptySelections().map((empty) => {
            const saved = selections.find((s) => s.category === empty.category);
            if (saved) {
              return {
                category: saved.category as UsageSelection['category'],
                included: true,
                isPaid: saved.is_paid,
                geographies: saved.geographies || [],
                periodStart: new Date(saved.period_start),
                periodEnd: saved.period_end ? new Date(saved.period_end) : null,
              };
            }
            return empty;
          })
        );
      }
    } catch (error) {
      console.error('Error loading agreement:', error);
      toast.error('Failed to load agreement');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (values: FormValues, generatePdf = false) => {
    if (!user) return;

    const includedSelections = usageSelections.filter((s) => s.included);
    if (includedSelections.length === 0) {
      toast.error('Please select at least one usage category');
      return;
    }

    // Validate that all included selections have required fields
    for (const sel of includedSelections) {
      if (sel.geographies.length === 0) {
        toast.error(`Please select territories for ${sel.category.replace('_', ' ')}`);
        return;
      }
      if (!sel.periodStart) {
        toast.error(`Please set a start date for ${sel.category.replace('_', ' ')}`);
        return;
      }
    }

    setSaving(true);

    try {
      let savedAgreementId = agreementId;

      if (agreementId) {
        // Update existing agreement
        const { error: updateError } = await supabase
          .from('rights_agreements')
          .update({
            client_name: values.clientName,
            client_email: values.clientEmail,
            client_contact_name: values.clientContactName || null,
            agreement_date: format(values.agreementDate, 'yyyy-MM-dd'),
            valid_from: format(values.validFrom, 'yyyy-MM-dd'),
            valid_until: values.validUntil ? format(values.validUntil, 'yyyy-MM-dd') : null,
          })
          .eq('id', agreementId);

        if (updateError) throw updateError;

        // Delete existing selections and recreate
        await supabase.from('rights_usage_selections').delete().eq('agreement_id', agreementId);
      } else {
        // Create new agreement
        const { data: newAgreement, error: insertError } = await supabase
          .from('rights_agreements')
          .insert({
            project_id: projectId,
            client_name: values.clientName,
            client_email: values.clientEmail,
            client_contact_name: values.clientContactName || null,
            agreement_date: format(values.agreementDate, 'yyyy-MM-dd'),
            valid_from: format(values.validFrom, 'yyyy-MM-dd'),
            valid_until: values.validUntil ? format(values.validUntil, 'yyyy-MM-dd') : null,
            status: 'draft',
            created_by: user.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        savedAgreementId = newAgreement.id;
      }

      // Insert usage selections
      const selectionsToInsert = includedSelections.map((sel) => ({
        agreement_id: savedAgreementId,
        category: sel.category,
        is_paid: sel.isPaid,
        geographies: sel.geographies,
        period_start: format(sel.periodStart!, 'yyyy-MM-dd'),
        period_end: sel.periodEnd ? format(sel.periodEnd, 'yyyy-MM-dd') : null,
      }));

      const { error: selectionsError } = await supabase
        .from('rights_usage_selections')
        .insert(selectionsToInsert);

      if (selectionsError) throw selectionsError;

      // Generate PDF if requested
      if (generatePdf && savedAgreementId) {
        toast.info('Generating agreement document...');
        
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke(
          'generate-rights-pdf',
          { body: { agreementId: savedAgreementId } }
        );

        if (pdfError) {
          console.error('PDF generation error:', pdfError);
          toast.error('Failed to generate document');
        } else if (pdfResult?.documentUrl) {
          toast.success('Agreement document generated!');
          // Open the document in a new tab
          window.open(pdfResult.documentUrl, '_blank');
        }
      } else {
        toast.success(
          agreementId
            ? 'Agreement updated successfully'
            : 'Agreement saved as draft'
        );
      }

      onSaved();
    } catch (error) {
      console.error('Error saving agreement:', error);
      toast.error('Failed to save agreement');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold">
            {agreementId ? 'Edit Rights Agreement' : 'New Rights Agreement'}
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure video content usage rights for your client
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => onSubmit(v, false))} className="space-y-6">
          {/* Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Information</CardTitle>
              <CardDescription>Details about the client who will sign this agreement</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="clientName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientContactName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter contact name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="clientEmail"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Signer Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Enter email for signature" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Agreement Dates */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agreement Dates</CardTitle>
              <CardDescription>When this agreement is valid</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="agreementDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agreement Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid From</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Pick a date'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              'w-full justify-start text-left font-normal',
                              !field.value && 'text-muted-foreground'
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value ? format(field.value, 'PPP') : 'Perpetual'}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <div className="p-2 border-b">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => field.onChange(null)}
                          >
                            Set as Perpetual
                          </Button>
                        </div>
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Usage Rights Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usage Rights</CardTitle>
              <CardDescription>
                Select which usage categories are granted and configure their terms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsageRightsMatrix
                selections={usageSelections}
                onChange={setUsageSelections}
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onBack}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save as Draft
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={form.handleSubmit((v) => onSubmit(v, true))}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Save & Generate PDF
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
