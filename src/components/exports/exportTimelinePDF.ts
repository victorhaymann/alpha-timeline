import type { Project, Phase, Task, TaskSegment } from '@/types/database';
import { differenceInDays, format, isAfter, isBefore } from 'date-fns';

/**
 * Generates a one-page landscape HTML timeline and opens the print dialog.
 */
export function exportTimelinePDF(
  project: Project,
  phases: Phase[],
  tasks: Task[],
  segments: TaskSegment[]
) {
  const projectStart = new Date(project.start_date);
  const projectEnd = new Date(project.end_date);
  const totalDays = Math.max(1, differenceInDays(projectEnd, projectStart));

  const pct = (date: Date) => {
    const d = differenceInDays(date, projectStart);
    return Math.max(0, Math.min(100, (d / totalDays) * 100));
  };

  const todayPct = pct(new Date());
  const showToday = todayPct > 0 && todayPct < 100;

  // Sort phases by order_index
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  // Build month axis ticks
  const monthTicks: { label: string; left: number }[] = [];
  const cursor = new Date(projectStart);
  cursor.setDate(1);
  if (isBefore(cursor, projectStart)) cursor.setMonth(cursor.getMonth() + 1);
  while (isBefore(cursor, projectEnd) || cursor.getTime() === projectEnd.getTime()) {
    monthTicks.push({ label: format(cursor, 'MMM yy'), left: pct(cursor) });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Build phase rows HTML
  const phaseRowsHtml = sortedPhases.map(phase => {
    const phaseTasks = tasks
      .filter(t => t.phase_id === phase.id)
      .sort((a, b) => a.order_index - b.order_index);

    const barsHtml = phaseTasks.map(task => {
      const taskSegments = segments.filter(s => s.task_id === task.id);

      if (task.task_type === 'milestone') {
        const pos = task.start_date ? pct(new Date(task.start_date)) : 0;
        return `<div class="milestone" style="left:${pos}%" title="${task.name}">◆</div>`;
      }

      if (taskSegments.length > 0) {
        return taskSegments.map(seg => {
          const left = pct(new Date(seg.start_date));
          const width = Math.max(0.3, pct(new Date(seg.end_date)) - left);
          const isReview = seg.segment_type === 'review';
          const style = isReview
            ? `left:${left}%;width:${width}%;background:repeating-linear-gradient(45deg,${phase.color}33,${phase.color}33 4px,${phase.color}11 4px,${phase.color}11 8px);border:1px dashed ${phase.color};`
            : `left:${left}%;width:${width}%;background:${phase.color};`;
          return `<div class="bar" style="${style}" title="${task.name}${isReview ? ' (Review)' : ''}"></div>`;
        }).join('');
      }

      if (task.start_date && task.end_date) {
        const left = pct(new Date(task.start_date));
        const width = Math.max(0.3, pct(new Date(task.end_date)) - left);
        return `<div class="bar" style="left:${left}%;width:${width}%;background:${phase.color};" title="${task.name}"></div>`;
      }
      return '';
    }).join('');

    return `
      <div class="phase-row">
        <div class="phase-label" style="border-left:4px solid ${phase.color};padding-left:6px;">${phase.name}</div>
        <div class="phase-track">${barsHtml}</div>
      </div>`;
  }).join('');

  // Build review table
  const reviewSegments = segments.filter(s => s.segment_type === 'review');
  const reviewRowsHtml = reviewSegments.map(seg => {
    const task = tasks.find(t => t.id === seg.task_id);
    const phase = task ? phases.find(p => p.id === task.phase_id) : null;
    return `<tr>
      <td>${phase?.name || '—'}</td>
      <td>${task?.name || '—'}</td>
      <td>${format(new Date(seg.start_date), 'MMM d')} – ${format(new Date(seg.end_date), 'MMM d, yyyy')}</td>
      <td>${seg.review_notes || '—'}</td>
    </tr>`;
  }).join('');

  const reviewTableHtml = reviewSegments.length > 0 ? `
    <div class="review-section">
      <h3>Review Periods</h3>
      <table>
        <thead><tr><th>Phase</th><th>Task</th><th>Dates</th><th>Notes</th></tr></thead>
        <tbody>${reviewRowsHtml}</tbody>
      </table>
    </div>` : '';

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${project.name} – Timeline</title>
<style>
  @page { size: landscape; margin: 12mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color:#1a1a1a; padding:0; font-size:10px; }

  .header { display:flex; align-items:center; gap:16px; margin-bottom:14px; padding-bottom:10px; border-bottom:2px solid #e5e5e5; }
  .header-logo img { height:36px; width:auto; object-fit:contain; }
  .header-title { flex:1; text-align:center; }
  .header-title h1 { font-size:18px; font-weight:700; margin-bottom:2px; }
  .header-title .sub { font-size:10px; color:#666; }
  .header-cards { display:flex; gap:10px; }
  .info-card { background:#f5f5f5; border-radius:6px; padding:6px 12px; text-align:center; }
  .info-card .label { font-size:8px; text-transform:uppercase; color:#888; letter-spacing:0.5px; }
  .info-card .value { font-size:11px; font-weight:600; margin-top:1px; }

  .timeline { position:relative; margin-bottom:12px; }
  .month-axis { display:flex; position:relative; height:18px; border-bottom:1px solid #ddd; margin-bottom:2px; }
  .month-tick { position:absolute; font-size:8px; color:#888; transform:translateX(-50%); }

  .phase-row { display:flex; align-items:center; height:22px; margin-bottom:2px; }
  .phase-label { width:120px; min-width:120px; font-size:9px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .phase-track { position:relative; flex:1; height:16px; background:#f9f9f9; border-radius:3px; }
  .bar { position:absolute; top:2px; height:12px; border-radius:2px; opacity:0.9; }
  .milestone { position:absolute; top:0; font-size:14px; line-height:16px; transform:translateX(-50%); color:#f59e0b; }

  .today-line { position:absolute; top:0; bottom:0; width:1.5px; background:#ef4444; z-index:10; }
  .today-label { position:absolute; top:-14px; font-size:7px; color:#ef4444; transform:translateX(-50%); white-space:nowrap; }

  .review-section { margin-top:10px; }
  .review-section h3 { font-size:11px; font-weight:600; margin-bottom:4px; }
  .review-section table { width:100%; border-collapse:collapse; font-size:9px; }
  .review-section th { text-align:left; padding:3px 6px; background:#f5f5f5; border:1px solid #e0e0e0; font-weight:600; }
  .review-section td { padding:3px 6px; border:1px solid #e0e0e0; vertical-align:top; }

  @media print {
    body { padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
</style>
</head>
<body>
  <div class="header">
    ${project.client_logo_url ? `<div class="header-logo"><img src="${project.client_logo_url}" alt="Logo" /></div>` : ''}
    <div class="header-title">
      <h1>${project.name}</h1>
      <div class="sub">${format(projectStart, 'MMMM d, yyyy')} – ${format(projectEnd, 'MMMM d, yyyy')}</div>
    </div>
    <div class="header-cards">
      ${project.pm_name ? `<div class="info-card"><div class="label">Project Manager</div><div class="value">${project.pm_name}</div></div>` : ''}
      <div class="info-card"><div class="label">Delivery Date</div><div class="value">${format(projectEnd, 'MMM d, yyyy')}</div></div>
    </div>
  </div>

  <div class="timeline">
    <div class="month-axis">
      ${monthTicks.map(t => `<span class="month-tick" style="left:${t.left}%">${t.label}</span>`).join('')}
    </div>
    <div style="position:relative;">
      ${showToday ? `<div class="today-line" style="left:${todayPct}%"><span class="today-label">Today</span></div>` : ''}
      ${phaseRowsHtml}
    </div>
  </div>

  ${reviewTableHtml}
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 400);
  }
}
