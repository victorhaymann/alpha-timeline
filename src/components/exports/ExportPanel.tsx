import { useState } from 'react';
import type { Project, Phase, Task } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Image,
  FileSpreadsheet,
  Calendar,
  Download,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface ExportPanelProps {
  project: Project;
  phases: Phase[];
  tasks: Task[];
}

export function ExportPanel({ project, phases, tasks }: ExportPanelProps) {
  const { toast } = useToast();
  const [exporting, setExporting] = useState<string | null>(null);

  // Export as CSV
  const exportCSV = () => {
    setExporting('csv');
    try {
      const headers = [
        'Phase',
        'Task Name',
        'Type',
        'Start Date',
        'End Date',
        'Status',
        'Client Visible',
        'Review Rounds',
        'Weight %',
      ];

      const rows = tasks.map(task => {
        const phase = phases.find(p => p.id === task.phase_id);
        return [
          phase?.name || '',
          task.name,
          task.task_type,
          task.start_date || '',
          task.end_date || '',
          task.status,
          task.client_visible ? 'Yes' : 'No',
          task.review_rounds?.toString() || '0',
          task.weight_percent?.toString() || '0',
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_timeline.csv`;
      link.click();

      toast({
        title: 'CSV exported',
        description: 'Timeline data has been downloaded.',
      });
    } catch (error) {
      console.error('CSV export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export CSV.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  // Export as iCal
  const exportIcal = () => {
    setExporting('ical');
    try {
      const meetings = tasks.filter(t => t.task_type === 'meeting' || t.task_type === 'milestone');
      
      let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//VFX Timeline Pro//EN',
        `X-WR-CALNAME:${project.name}`,
      ];

      meetings.forEach(task => {
        if (!task.start_date) return;

        const startDate = task.start_date.replace(/-/g, '');
        const endDate = (task.end_date || task.start_date).replace(/-/g, '');
        const uid = `${task.id}@vfxtimelinepro`;

        icalContent.push(
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `DTSTART;VALUE=DATE:${startDate}`,
          `DTEND;VALUE=DATE:${endDate}`,
          `SUMMARY:${task.name}`,
          `DESCRIPTION:${task.narrative_text || `${task.task_type} for ${project.name}`}`,
          task.task_type === 'milestone' ? 'CATEGORIES:Milestone' : 'CATEGORIES:Meeting',
          'END:VEVENT'
        );
      });

      icalContent.push('END:VCALENDAR');

      const blob = new Blob([icalContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_calendar.ics`;
      link.click();

      toast({
        title: 'Calendar exported',
        description: `${meetings.length} events have been exported.`,
      });
    } catch (error) {
      console.error('iCal export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not export calendar.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  // Export as PNG (captures Gantt chart)
  const exportPNG = async () => {
    setExporting('png');
    try {
      // Find the Gantt chart element
      const ganttElement = document.querySelector('[data-gantt-chart]');
      if (!ganttElement) {
        toast({
          title: 'Export failed',
          description: 'Please switch to Gantt View first.',
          variant: 'destructive',
        });
        setExporting(null);
        return;
      }

      // Dynamic import of html2canvas
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(ganttElement as HTMLElement, {
        backgroundColor: '#0a0a0b',
        scale: 2,
      });

      const link = document.createElement('a');
      link.download = `${project.name.replace(/[^a-z0-9]/gi, '_')}_gantt.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast({
        title: 'Image exported',
        description: 'Gantt chart snapshot has been downloaded.',
      });
    } catch (error) {
      console.error('PNG export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not capture Gantt chart. Try again.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  // Generate PDF (Client Mode rendering)
  const exportPDF = async () => {
    setExporting('pdf');
    try {
      // Build client-facing HTML content
      const clientVisibleTasks = tasks.filter(t => t.client_visible);
      const phasesWithTasks = phases.filter(p => 
        clientVisibleTasks.some(t => t.phase_id === p.id)
      );

      let htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${project.name} - Project Timeline</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1a1a1a; }
            .header { margin-bottom: 40px; }
            .title { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
            .subtitle { color: #666; font-size: 14px; }
            .phase { margin-bottom: 32px; }
            .phase-title { font-size: 18px; font-weight: 600; padding: 12px 16px; background: #f5f5f5; border-radius: 8px; margin-bottom: 16px; }
            .task { padding: 16px; border: 1px solid #e5e5e5; border-radius: 8px; margin-bottom: 12px; }
            .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .task-name { font-weight: 600; }
            .task-type { font-size: 12px; padding: 4px 8px; background: #e5e5e5; border-radius: 4px; }
            .task-dates { font-size: 13px; color: #666; margin-bottom: 12px; }
            .task-narrative { font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
            .milestone { border-left: 4px solid #f59e0b; }
            .meeting { border-left: 4px solid #8b5cf6; }
            @media print { body { padding: 20px; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">${project.name}</h1>
            <p class="subtitle">
              ${project.client_name ? `Client: ${project.client_name} • ` : ''}
              ${format(new Date(project.start_date), 'MMMM d, yyyy')} – ${format(new Date(project.end_date), 'MMMM d, yyyy')}
            </p>
          </div>
      `;

      phasesWithTasks.forEach(phase => {
        const phaseTasks = clientVisibleTasks
          .filter(t => t.phase_id === phase.id)
          .sort((a, b) => a.order_index - b.order_index);

        htmlContent += `
          <div class="phase">
            <h2 class="phase-title">${phase.name}</h2>
        `;

        phaseTasks.forEach(task => {
          const typeClass = task.task_type === 'milestone' ? 'milestone' : task.task_type === 'meeting' ? 'meeting' : '';
          htmlContent += `
            <div class="task ${typeClass}">
              <div class="task-header">
                <span class="task-name">${task.name}</span>
                <span class="task-type">${task.task_type}</span>
              </div>
              ${task.start_date && task.end_date ? `
                <div class="task-dates">
                  ${format(new Date(task.start_date), 'MMM d')} – ${format(new Date(task.end_date), 'MMM d, yyyy')}
                </div>
              ` : ''}
              ${task.narrative_text ? `
                <div class="task-narrative">${task.narrative_text}</div>
              ` : ''}
            </div>
          `;
        });

        htmlContent += '</div>';
      });

      htmlContent += '</body></html>';

      // Open in new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
      }

      toast({
        title: 'PDF ready',
        description: 'Use the print dialog to save as PDF.',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Export failed',
        description: 'Could not generate PDF.',
        variant: 'destructive',
      });
    } finally {
      setExporting(null);
    }
  };

  const exports = [
    {
      id: 'pdf',
      title: 'PDF Export',
      description: 'Client-facing timeline document',
      icon: FileText,
      action: exportPDF,
    },
    {
      id: 'png',
      title: 'PNG Snapshot',
      description: 'Image of the Gantt chart',
      icon: Image,
      action: exportPNG,
    },
    {
      id: 'csv',
      title: 'CSV Export',
      description: 'Spreadsheet of all tasks',
      icon: FileSpreadsheet,
      action: exportCSV,
    },
    {
      id: 'ical',
      title: 'Calendar Export',
      description: 'iCal feed for meetings & milestones',
      icon: Calendar,
      action: exportIcal,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {exports.map((exp) => (
        <Card key={exp.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
          <CardContent className="flex items-start gap-4 pt-6">
            <div className="p-3 rounded-lg bg-primary/10">
              <exp.icon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">{exp.title}</h3>
              <p className="text-sm text-muted-foreground mb-3">
                {exp.description}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={exp.action}
                disabled={exporting === exp.id}
              >
                {exporting === exp.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Export
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
