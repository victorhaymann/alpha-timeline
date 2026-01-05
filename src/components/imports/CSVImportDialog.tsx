import { useState, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  FileSpreadsheet,
  Check,
  AlertCircle,
  Loader2,
  Download,
} from 'lucide-react';

interface CSVImportDialogProps {
  children: React.ReactNode;
}

interface ParsedRow {
  phase: string;
  step: string;
  actualDays: number;
  estimatedDays: number;
  reviewRounds: number;
}

interface ComputedDefaults {
  stepWeights: Record<string, number>;
  phaseWeights: Record<string, number>;
  avgReviewRounds: Record<string, number>;
}

export function CSVImportDialog({ children }: CSVImportDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [computedDefaults, setComputedDefaults] = useState<ComputedDefaults | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview' | 'complete'>('upload');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsParsing(true);

    try {
      const text = await selectedFile.text();
      const rows = text.split('\n').filter(row => row.trim());
      const headers = rows[0].toLowerCase().split(',').map(h => h.trim());

      // Expected format: Phase, Step, Actual Days, Estimated Days, Review Rounds
      const phaseIdx = headers.findIndex(h => h.includes('phase'));
      const stepIdx = headers.findIndex(h => h.includes('step') || h.includes('task') || h.includes('name'));
      const actualIdx = headers.findIndex(h => h.includes('actual'));
      const estimatedIdx = headers.findIndex(h => h.includes('estimated') || h.includes('planned'));
      const reviewIdx = headers.findIndex(h => h.includes('review') || h.includes('round'));

      if (stepIdx === -1) {
        throw new Error('Could not find step/task column');
      }

      const parsed: ParsedRow[] = [];
      for (let i = 1; i < rows.length; i++) {
        const cells = rows[i].split(',').map(c => c.trim().replace(/"/g, ''));
        if (cells.length <= stepIdx) continue;

        parsed.push({
          phase: phaseIdx >= 0 ? cells[phaseIdx] || 'Production' : 'Production',
          step: cells[stepIdx],
          actualDays: actualIdx >= 0 ? parseInt(cells[actualIdx]) || 0 : 0,
          estimatedDays: estimatedIdx >= 0 ? parseInt(cells[estimatedIdx]) || 0 : 0,
          reviewRounds: reviewIdx >= 0 ? parseInt(cells[reviewIdx]) || 0 : 0,
        });
      }

      if (parsed.length === 0) {
        throw new Error('No valid data rows found');
      }

      // Compute defaults from parsed data
      const defaults = computeDefaultsFromData(parsed);
      
      setParsedData(parsed);
      setComputedDefaults(defaults);
      setStep('preview');
    } catch (error: any) {
      console.error('CSV parse error:', error);
      toast({
        title: 'Parse error',
        description: error.message || 'Could not parse CSV file',
        variant: 'destructive',
      });
    } finally {
      setIsParsing(false);
    }
  };

  const computeDefaultsFromData = (data: ParsedRow[]): ComputedDefaults => {
    // Group by phase and step
    const phaseData: Record<string, { totalDays: number; steps: string[] }> = {};
    const stepData: Record<string, { days: number[]; reviews: number[] }> = {};

    let totalProjectDays = 0;

    data.forEach(row => {
      const days = row.actualDays || row.estimatedDays;
      totalProjectDays += days;

      // Phase tracking
      if (!phaseData[row.phase]) {
        phaseData[row.phase] = { totalDays: 0, steps: [] };
      }
      phaseData[row.phase].totalDays += days;
      if (!phaseData[row.phase].steps.includes(row.step)) {
        phaseData[row.phase].steps.push(row.step);
      }

      // Step tracking
      if (!stepData[row.step]) {
        stepData[row.step] = { days: [], reviews: [] };
      }
      stepData[row.step].days.push(days);
      stepData[row.step].reviews.push(row.reviewRounds);
    });

    // Calculate weights
    const phaseWeights: Record<string, number> = {};
    Object.entries(phaseData).forEach(([phase, data]) => {
      phaseWeights[phase] = totalProjectDays > 0 
        ? Math.round((data.totalDays / totalProjectDays) * 100)
        : 0;
    });

    const stepWeights: Record<string, number> = {};
    Object.entries(stepData).forEach(([step, data]) => {
      const avgDays = data.days.reduce((a, b) => a + b, 0) / data.days.length;
      stepWeights[step] = totalProjectDays > 0
        ? Math.round((avgDays / totalProjectDays) * 100)
        : 0;
    });

    const avgReviewRounds: Record<string, number> = {};
    Object.entries(stepData).forEach(([step, data]) => {
      const validReviews = data.reviews.filter(r => r > 0);
      avgReviewRounds[step] = validReviews.length > 0
        ? Math.round(validReviews.reduce((a, b) => a + b, 0) / validReviews.length)
        : 0;
    });

    return { stepWeights, phaseWeights, avgReviewRounds };
  };

  const handleSaveDefaults = async () => {
    if (!user || !computedDefaults) return;

    setIsSaving(true);
    try {
      // Save as user's step templates (My Defaults)
      const templates = Object.entries(computedDefaults.stepWeights).map(([name, weight]) => ({
        owner_id: user.id,
        name,
        default_percentage: weight,
        default_review_rounds: computedDefaults.avgReviewRounds[name] || 0,
        category: Object.entries(computedDefaults.phaseWeights)
          .find(([phase]) => parsedData.some(row => row.step === name && row.phase === phase))?.[0] || 'Production',
      }));

      // Upsert templates (replace existing with same name)
      for (const template of templates) {
        const { error } = await supabase
          .from('step_templates')
          .upsert(template, { onConflict: 'owner_id,name' });

        if (error && !error.message.includes('unique constraint')) {
          // If upsert fails due to missing constraint, do insert
          await supabase.from('step_templates').insert(template);
        }
      }

      setStep('complete');
      toast({
        title: 'Defaults saved',
        description: `${templates.length} step defaults have been saved to your profile.`,
      });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({
        title: 'Save failed',
        description: error.message || 'Could not save defaults',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setComputedDefaults(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = `Phase,Step,Actual Days,Estimated Days,Review Rounds
Pre-Production,Styleframes,5,4,2
Pre-Production,Animatic,3,3,1
Production,Animation,10,8,2
Production,Lighting,5,5,1
Production,Compositing,7,6,2
Post-Production,Editorial,4,4,1
Post-Production,Color Grading,2,2,1
Delivery,Quality Control,2,2,0
Delivery,Client Handoff,1,1,0`;

    const blob = new Blob([sampleData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'timeline_import_sample.csv';
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      setOpen(newOpen);
      if (!newOpen) handleReset();
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Past Timeline</DialogTitle>
          <DialogDescription>
            Upload a CSV of completed projects to calibrate your default weights and review rounds.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto py-4">
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {isParsing ? (
                  <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                )}
                <p className="font-medium">Click to upload CSV</p>
                <p className="text-sm text-muted-foreground mt-1">
                  or drag and drop
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted/30 space-y-2">
                <h4 className="font-medium text-sm">Expected CSV Format</h4>
                <p className="text-xs text-muted-foreground">
                  Columns: Phase, Step/Task Name, Actual Days, Estimated Days, Review Rounds
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={downloadSampleCSV}
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </Button>
              </div>
            </div>
          )}

          {step === 'preview' && computedDefaults && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-green-500" />
                Parsed {parsedData.length} rows from {file?.name}
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Computed Phase Weights</h4>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(computedDefaults.phaseWeights).map(([phase, weight]) => (
                    <div key={phase} className="px-3 py-1.5 rounded-lg bg-muted text-sm">
                      <span className="font-medium">{phase}:</span> {weight}%
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-medium text-sm mb-2">Computed Step Weights</h4>
                <div className="max-h-[200px] overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Step</TableHead>
                        <TableHead className="text-right">Weight</TableHead>
                        <TableHead className="text-right">Avg Reviews</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(computedDefaults.stepWeights)
                        .sort((a, b) => b[1] - a[1])
                        .map(([step, weight]) => (
                          <TableRow key={step}>
                            <TableCell className="font-medium">{step}</TableCell>
                            <TableCell className="text-right">{weight}%</TableCell>
                            <TableCell className="text-right">
                              {computedDefaults.avgReviewRounds[step] || 0}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Defaults Saved!</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Your computed weights and review rounds have been saved as your personal defaults.
                They'll be used when creating new projects.
              </p>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleReset}>
              Start Over
            </Button>
            <Button onClick={handleSaveDefaults} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save as My Defaults'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
