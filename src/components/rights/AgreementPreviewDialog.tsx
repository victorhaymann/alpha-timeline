import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Send, X } from 'lucide-react';
import { format } from 'date-fns';

interface UsageSelection {
  category: string;
  is_paid: boolean;
  geographies: string[];
  period_start: string;
  period_end: string | null;
}

interface AgreementPreviewDialogProps {
  agreementId: string | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGeneratePdf: (agreementId: string) => void;
  generatingPdf: boolean;
}

const CATEGORY_MAP: Record<string, string> = {
  digital: 'DIGITAL',
  paid_media: 'PAID_MEDIA',
  pos_retail: 'POS',
  print: 'PRINT',
  ooh: 'OOH',
  tv: 'TV',
};

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatPeriod(start: string, end: string | null): string {
  const startDate = formatDateDisplay(start);
  if (!end) return `${startDate} - Perpetual`;
  return `${startDate} - ${formatDateDisplay(end)}`;
}

export function AgreementPreviewDialog({
  agreementId,
  projectId,
  open,
  onOpenChange,
  onGeneratePdf,
  generatingPdf,
}: AgreementPreviewDialogProps) {
  const [loading, setLoading] = useState(true);
  const [templateData, setTemplateData] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    if (open && agreementId) {
      loadAgreementData();
    } else {
      setTemplateData(null);
    }
  }, [open, agreementId]);

  const loadAgreementData = async () => {
    if (!agreementId) return;
    
    setLoading(true);
    try {
      // Fetch agreement data
      const { data: agreement, error: agreementError } = await supabase
        .from('rights_agreements')
        .select('*, projects(name, description, client_name)')
        .eq('id', agreementId)
        .single();

      if (agreementError || !agreement) {
        console.error('Agreement fetch error:', agreementError);
        return;
      }

      // Fetch usage selections
      const { data: selections } = await supabase
        .from('rights_usage_selections')
        .select('*')
        .eq('agreement_id', agreementId);

      // Build template data
      const project = agreement.projects as { name: string; description: string | null; client_name: string | null } | null;
      
      const data: Record<string, string> = {
        CLIENT_NAME: agreement.client_name,
        CLIENT_CONTACT_NAME: agreement.client_contact_name || '',
        CLIENT_EMAIL: agreement.client_email,
        PROJECT_NAME: project?.name || '',
        CONTENT_DESCRIPTION: project?.description || 'Video content as per project scope',
        AGREEMENT_DATE: formatDateDisplay(agreement.agreement_date),
        VALID_FROM: formatDateDisplay(agreement.valid_from),
        VALID_UNTIL: agreement.valid_until ? formatDateDisplay(agreement.valid_until) : 'Perpetual',
        GOVERNING_LAW: 'France',
        CLIENT_SIGNER_NAME: agreement.client_contact_name || '',
      };

      // Initialize all usage categories as "Not Granted"
      const categories = ['DIGITAL', 'PAID_MEDIA', 'POS', 'PRINT', 'OOH', 'TV'];
      for (const cat of categories) {
        data[`${cat}_GRANTED`] = 'No';
        data[`${cat}_TYPE`] = '-';
        data[`${cat}_TERRITORIES`] = '-';
        data[`${cat}_PERIOD`] = '-';
      }

      // Fill in granted categories
      if (selections) {
        for (const sel of selections as UsageSelection[]) {
          const catKey = CATEGORY_MAP[sel.category];
          if (catKey) {
            data[`${catKey}_GRANTED`] = 'Yes';
            data[`${catKey}_TYPE`] = sel.is_paid ? 'Paid' : 'Organic';
            data[`${catKey}_TERRITORIES`] = sel.geographies.join(', ') || 'Not specified';
            data[`${catKey}_PERIOD`] = formatPeriod(sel.period_start, sel.period_end);
          }
        }
      }

      setTemplateData(data);
    } catch (error) {
      console.error('Error loading agreement data:', error);
    } finally {
      setLoading(false);
    }
  };

  const usageCategories = [
    { key: 'DIGITAL', label: 'Digital (Web, Social Media, Email)' },
    { key: 'PAID_MEDIA', label: 'Paid Media (Advertising, Sponsored)' },
    { key: 'POS', label: 'POS / Retail (In-store, Displays)' },
    { key: 'PRINT', label: 'Print (Magazines, Brochures)' },
    { key: 'OOH', label: 'OOH (Billboards, Street Furniture)' },
    { key: 'TV', label: 'TV (Broadcast, Streaming)' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">
              Agreement Preview
            </DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : templateData ? (
          <>
            {/* Scrollable preview content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-8 bg-white">
                {/* Document Header */}
                <div className="border-b-2 border-foreground pb-6 mb-8">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-bold uppercase tracking-wide">
                        Video Content Usage Rights Agreement
                      </h1>
                      <p className="text-muted-foreground mt-1">Non-Exclusive License Agreement</p>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold tracking-wider">THE NEW FACE</span>
                    </div>
                  </div>
                </div>

                {/* Section 1: Parties */}
                <section className="mb-8">
                  <h2 className="text-base font-bold mb-4 pb-2 border-b">1. Parties</h2>
                  <p className="text-sm mb-4">
                    This Video Content Usage Rights Agreement (the "Agreement") is entered into by and between:
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-muted/50 p-4 rounded border-l-4 border-foreground">
                      <h4 className="text-xs font-bold uppercase tracking-wide mb-3">Licensor</h4>
                      <p className="font-semibold">The New Face</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-xs">Address:</span><br />
                        23 Rue des Petits Hotels<br />
                        75010, Paris, France
                      </p>
                    </div>
                    <div className="bg-muted/50 p-4 rounded border-l-4 border-foreground">
                      <h4 className="text-xs font-bold uppercase tracking-wide mb-3">Licensee (Client)</h4>
                      <p className="font-semibold">{templateData.CLIENT_NAME}</p>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-xs">Contact:</span> {templateData.CLIENT_CONTACT_NAME || 'N/A'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="text-xs">Email:</span> {templateData.CLIENT_EMAIL}
                      </p>
                    </div>
                  </div>
                </section>

                {/* Section 2: Content Description */}
                <section className="mb-8">
                  <h2 className="text-base font-bold mb-4 pb-2 border-b">2. Content Description</h2>
                  <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
                    <span className="font-bold text-xs uppercase text-muted-foreground">Project Name</span>
                    <span>{templateData.PROJECT_NAME}</span>
                    <span className="font-bold text-xs uppercase text-muted-foreground">Description</span>
                    <span>{templateData.CONTENT_DESCRIPTION}</span>
                    <span className="font-bold text-xs uppercase text-muted-foreground">Deliverables</span>
                    <span>As per project documentation</span>
                  </div>
                </section>

                {/* Section 3: Agreement Dates */}
                <section className="mb-8">
                  <h2 className="text-base font-bold mb-4 pb-2 border-b">3. Agreement Dates</h2>
                  <div className="grid grid-cols-[140px_1fr] gap-y-2 gap-x-4 text-sm">
                    <span className="font-bold text-xs uppercase text-muted-foreground">Agreement Date</span>
                    <span>{templateData.AGREEMENT_DATE}</span>
                    <span className="font-bold text-xs uppercase text-muted-foreground">Rights Valid From</span>
                    <span>{templateData.VALID_FROM}</span>
                    <span className="font-bold text-xs uppercase text-muted-foreground">Rights Valid Until</span>
                    <span>{templateData.VALID_UNTIL}</span>
                  </div>
                </section>

                {/* Section 4: Usage Rights */}
                <section className="mb-8">
                  <h2 className="text-base font-bold mb-4 pb-2 border-b">4. Usage Rights</h2>
                  <p className="text-sm mb-4">
                    Usage rights are granted strictly as indicated below. Any usage category not explicitly granted is not permitted.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-foreground text-background">
                          <th className="text-left p-3 font-bold text-xs uppercase">Usage Category</th>
                          <th className="text-left p-3 font-bold text-xs uppercase">Granted</th>
                          <th className="text-left p-3 font-bold text-xs uppercase">Type</th>
                          <th className="text-left p-3 font-bold text-xs uppercase">Territories</th>
                          <th className="text-left p-3 font-bold text-xs uppercase">Period</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usageCategories.map((cat, idx) => {
                          const isGranted = templateData[`${cat.key}_GRANTED`] === 'Yes';
                          return (
                            <tr key={cat.key} className={idx % 2 === 0 ? 'bg-muted/30' : ''}>
                              <td className="p-3 border-b">{cat.label}</td>
                              <td className={`p-3 border-b font-semibold ${isGranted ? 'text-green-600' : 'text-muted-foreground'}`}>
                                {templateData[`${cat.key}_GRANTED`]}
                              </td>
                              <td className="p-3 border-b">
                                {isGranted ? templateData[`${cat.key}_TYPE`] : '-'}
                              </td>
                              <td className="p-3 border-b">
                                {isGranted ? templateData[`${cat.key}_TERRITORIES`] : '-'}
                              </td>
                              <td className="p-3 border-b">
                                {isGranted ? templateData[`${cat.key}_PERIOD`] : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                {/* Section 5: Terms Preview */}
                <section className="mb-8">
                  <h2 className="text-base font-bold mb-4 pb-2 border-b">5. Terms and Conditions</h2>
                  <div className="text-sm text-muted-foreground space-y-4">
                    <div>
                      <h3 className="font-semibold text-foreground">5.1 Grant of Rights (Non-Exclusive License)</h3>
                      <p>Subject to the terms of this Agreement, the Licensor grants the Licensee a non-exclusive, non-transferable license...</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">5.2 Restrictions</h3>
                      <p>The Licensee shall not sublicense, assign, or transfer rights without written consent...</p>
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">5.3 Credit / Attribution</h3>
                      <p>The Licensee shall include credit: "Content produced by The New Face."</p>
                    </div>
                    <p className="italic text-center pt-4">
                      [Full terms included in the generated document]
                    </p>
                  </div>
                </section>

                {/* Section 6: Signatures Preview */}
                <section className="mb-8">
                  <h2 className="text-base font-bold mb-4 pb-2 border-b">6. Signatures</h2>
                  <p className="text-sm italic mb-6">
                    IN WITNESS WHEREOF, the Parties have executed this Agreement as of the Agreement Date.
                  </p>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="border rounded p-4">
                      <h4 className="font-bold text-xs uppercase tracking-wide mb-4 pb-2 border-b">
                        Licensor (The New Face)
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Signature</span>
                          <div className="border-b border-foreground h-8 mt-1"></div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Printed Name</span>
                          <p>Victor Haymann</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Title</span>
                          <p>COO</p>
                        </div>
                      </div>
                    </div>
                    <div className="border rounded p-4">
                      <h4 className="font-bold text-xs uppercase tracking-wide mb-4 pb-2 border-b">
                        Licensee (Client)
                      </h4>
                      <div className="space-y-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground">Signature</span>
                          <div className="border-b border-foreground h-8 mt-1"></div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Printed Name</span>
                          <p>{templateData.CLIENT_SIGNER_NAME || '________________________'}</p>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Title</span>
                          <div className="border-b border-foreground h-8 mt-1"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Footer */}
                <div className="border-t pt-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Confidential - Video Content Usage Rights Agreement
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-6 py-4 border-t bg-muted/30 flex justify-end gap-3 flex-shrink-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {agreementId && (
                <Button 
                  onClick={() => onGeneratePdf(agreementId)} 
                  disabled={generatingPdf}
                >
                  {generatingPdf ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Generate Document
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            Failed to load agreement data
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
