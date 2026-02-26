import type { Project, Phase, Task, TaskSegment } from '@/types/database';
import { differenceInDays, format, isBefore } from 'date-fns';

/**
 * Generates a one-page landscape HTML timeline using a sandboxed iframe
 * (prevents Chrome extension injection) and opens the print dialog.
 */
export function exportTimelinePDF(
  project: Project,
  phases: Phase[],
  tasks: Task[],
  segments: TaskSegment[],
  tnfLogoUrl?: string
) {
  const projectStart = new Date(project.start_date);
  const projectEnd = new Date(project.end_date);
  const totalDays = Math.max(1, differenceInDays(projectEnd, projectStart));

  const pct = (date: Date) => {
    const d = differenceInDays(date, projectStart);
    return Math.max(0, Math.min(100, (d / totalDays) * 100));
  };

  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);

  // ── Build week axis ticks ──────────────────────────────────────────
  const weekTicks: { label: string; left: number; isMonthStart: boolean }[] = [];
  const monthMarkers: { label: string; left: number; width: number }[] = [];

  const weekCursor = new Date(projectStart);
  const dayOfWeek = weekCursor.getDay();
  const daysUntilMon = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  weekCursor.setDate(weekCursor.getDate() + daysUntilMon);
  let weekNum = 1;
  while (isBefore(weekCursor, projectEnd)) {
    weekTicks.push({
      label: `W${weekNum}`,
      left: pct(weekCursor),
      isMonthStart: weekCursor.getDate() <= 7,
    });
    weekNum++;
    weekCursor.setDate(weekCursor.getDate() + 7);
  }

  // Month markers
  const monthCursor = new Date(projectStart);
  monthCursor.setDate(1);
  if (isBefore(monthCursor, projectStart)) monthCursor.setMonth(monthCursor.getMonth() + 1);
  const monthStarts: Date[] = [];
  while (isBefore(monthCursor, projectEnd) || monthCursor.getTime() === projectEnd.getTime()) {
    monthStarts.push(new Date(monthCursor));
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }
  for (let i = 0; i < monthStarts.length; i++) {
    const start = monthStarts[i];
    const end = i < monthStarts.length - 1 ? monthStarts[i + 1] : projectEnd;
    const left = pct(start);
    const width = pct(end) - left;
    monthMarkers.push({ label: format(start, 'MMMM'), left, width });
  }

  // Day labels for short projects
  const showDayLevel = totalDays <= 70;
  const dayLabels: { label: string; left: number }[] = [];
  if (showDayLevel) {
    const dayCursor = new Date(projectStart);
    while (isBefore(dayCursor, projectEnd) || dayCursor.getTime() === projectEnd.getTime()) {
      dayLabels.push({ label: `${format(dayCursor, 'EEE')} ${dayCursor.getDate()}`, left: pct(dayCursor) });
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
  }

  // ── Build phase rows HTML ──────────────────────────────────────────
  const phaseRowsHtml = sortedPhases.map(phase => {
    const phaseTasks = tasks
      .filter(t => t.phase_id === phase.id)
      .sort((a, b) => {
        const aDate = a.start_date ? new Date(a.start_date).getTime() : Infinity;
        const bDate = b.start_date ? new Date(b.start_date).getTime() : Infinity;
        return aDate - bDate;
      });

    const taskRowsHtml = phaseTasks.map(task => {
      const taskSegments = segments.filter(s => s.task_id === task.id);
      const reviewSegs = taskSegments.filter(s => s.segment_type === 'review');
      const workSegs = taskSegments.filter(s => s.segment_type !== 'review');

      const dur = task.start_date && task.end_date
        ? `${differenceInDays(new Date(task.end_date), new Date(task.start_date))}d`
        : '';
      const dateRange = task.start_date && task.end_date
        ? `${format(new Date(task.start_date), 'MMM d')} → ${format(new Date(task.end_date), 'MMM d')}`
        : '';

      if (task.task_type === 'milestone') {
        const pos = task.start_date ? pct(new Date(task.start_date)) : 0;
        return `
          <div class="task-row">
            <div class="task-info">
              <span class="task-dot milestone-dot">◆</span>
              <span class="task-name">${task.name}</span>
              <span class="task-meta">${task.start_date ? format(new Date(task.start_date), 'MMM d') : ''}</span>
            </div>
            <div class="task-track">
              <div class="milestone-marker" style="left:${pos}%">◆</div>
            </div>
          </div>`;
      }

      let barsHtml = '';
      if (workSegs.length > 0) {
        barsHtml += workSegs.map(seg => {
          const left = pct(new Date(seg.start_date));
          const width = Math.max(0.5, pct(new Date(seg.end_date)) - left);
          return `<div class="bar" style="left:${left}%;width:${width}%;background:${phase.color};">
            <span class="bar-label">${task.name}</span>
          </div>`;
        }).join('');
      } else if (task.start_date && task.end_date) {
        const left = pct(new Date(task.start_date));
        const width = Math.max(0.5, pct(new Date(task.end_date)) - left);
        barsHtml = `<div class="bar" style="left:${left}%;width:${width}%;background:${phase.color};">
          <span class="bar-label">${task.name}</span>
        </div>`;
      }

      const reviewBadgesHtml = reviewSegs.map((seg, i) => {
        const left = pct(new Date(seg.start_date));
        const width = Math.max(2, pct(new Date(seg.end_date)) - left);
        return `<div class="review-badge" style="left:${left}%;width:${width}%;border-color:${phase.color};color:${phase.color};">
          REVIEW${reviewSegs.length > 1 ? ` ${i + 1}` : ''}
        </div>`;
      }).join('');

      const reviewCountHtml = reviewSegs.length > 0
        ? `<div class="review-row review-count-label"><span class="review-count">↳ Reviews (${reviewSegs.length})</span></div>`
        : '';

      return `
        <div class="task-row">
          <div class="task-info">
            <span class="task-dot" style="background:${phase.color};"></span>
            <span class="task-name">${task.name}</span>
            <span class="task-meta">${dur}</span>
            <span class="task-dates">${dateRange}</span>
          </div>
          <div class="task-track">
            ${barsHtml}
            ${reviewBadgesHtml}
          </div>
        </div>
        ${reviewCountHtml}`;
    }).join('');

    return `
      <div class="phase-group">
        <div class="phase-header">
          <div class="phase-color-bar" style="background:${phase.color};"></div>
          <span class="phase-name">${phase.name.toUpperCase()}</span>
        </div>
        ${taskRowsHtml}
      </div>`;
  }).join('');

  // ── Build review table ─────────────────────────────────────────────
  const reviewSegments = segments
    .filter(s => s.segment_type === 'review')
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime());
  const reviewRowsHtml = reviewSegments.map(seg => {
    const task = tasks.find(t => t.id === seg.task_id);
    const phase = task ? phases.find(p => p.id === task.phase_id) : null;
    return `<tr>
      <td><span class="phase-pill" style="background:${phase?.color || '#ccc'}22;color:${phase?.color || '#666'};">${phase?.name || '—'}</span></td>
      <td>${task?.name || '—'}</td>
      <td class="date-cell">${format(new Date(seg.start_date), 'MMM d')} – ${format(new Date(seg.end_date), 'MMM d, yyyy')}</td>
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

  // ── Week grid lines ────────────────────────────────────────────────
  const gridLinesHtml = weekTicks.map(t =>
    `<div class="grid-line" style="left:${t.left}%"></div>`
  ).join('');

  const dayHeaderHtml = showDayLevel
    ? dayLabels.map(d =>
        `<span class="day-tick" style="left:${d.left}%;width:${100 / totalDays}%">${d.label}</span>`
      ).join('')
    : '';

  // ── TNF logo HTML ──────────────────────────────────────────────────
  const tnfLogoHtml = tnfLogoUrl
    ? `<div class="tnf-logo"><img src="${tnfLogoUrl}" alt="The New Face" /></div>`
    : '';

  // ── Assemble full HTML ─────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html>
<head>
<title>${project.name} – Timeline</title>
<style>
  @page { size: landscape; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif;
    color: #1a1a1a;
    padding: 10mm;
    font-size: 10px;
    background: #fff;
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e8e8e8;
  }
  .header-left {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .header-logo img { height: 40px; width: auto; object-fit: contain; }
  .header-center {
    flex: 2;
    text-align: center;
  }
  .header-center h1 {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.3px;
    margin-bottom: 2px;
  }
  .header-center .sub {
    font-size: 10px;
    color: #888;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .header-center .badge {
    background: #f3f3f3;
    color: #888;
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 9px;
    font-weight: 500;
  }
  .header-right {
    flex: 1;
    display: flex;
    gap: 12px;
    align-items: stretch;
    justify-content: flex-end;
  }
  .info-card { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 12px 24px; text-align: center; min-width: 160px; }
  .info-card .label { font-size: 8px; text-transform: uppercase; color: #999; letter-spacing: 0.8px; font-weight: 600; }
  .info-card .value { font-size: 14px; font-weight: 600; margin-top: 2px; color: #333; }
  .tnf-logo { display: flex; align-items: center; margin-left: 12px; }
  .tnf-logo img { height: 32px; width: auto; object-fit: contain; }

  .timeline { position: relative; margin-bottom: 14px; }
  .month-bar { display: flex; position: relative; height: 20px; background: #fafafa; border-bottom: 1px solid #eee; margin-left: 200px; }
  .month-span { position: absolute; font-size: 9px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.5px; padding-left: 6px; line-height: 20px; border-left: 1px solid #e0e0e0; overflow: hidden; }
  .week-bar { display: flex; position: relative; height: 16px; border-bottom: 1px solid #eee; margin-left: 200px; }
  .week-tick { position: absolute; font-size: 7px; color: #bbb; font-weight: 500; text-align: center; line-height: 16px; border-left: 1px solid #f0f0f0; padding-left: 4px; }
  .day-bar { display: flex; position: relative; height: 14px; border-bottom: 1px solid #eee; margin-left: 200px; }
  .day-tick { position: absolute; font-size: 6px; color: #ccc; text-align: center; line-height: 14px; overflow: hidden; }

  .phase-group { margin-bottom: 4px; }
  .phase-header { display: flex; align-items: center; gap: 6px; padding: 4px 0 2px 0; }
  .phase-color-bar { width: 3px; height: 12px; border-radius: 1px; }
  .phase-name { font-size: 8px; font-weight: 700; letter-spacing: 0.8px; color: #666; }

  .task-row { display: flex; align-items: center; height: 26px; }
  .task-info { width: 200px; min-width: 200px; display: flex; align-items: center; gap: 5px; padding-right: 8px; }
  .task-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .milestone-dot { background: none; color: #f59e0b; font-size: 9px; width: auto; height: auto; }
  .task-name { font-size: 9px; font-weight: 500; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }
  .task-meta { font-size: 8px; color: #aaa; background: #f5f5f5; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
  .task-dates { font-size: 8px; color: #bbb; white-space: nowrap; }
  .task-track { position: relative; flex: 1; height: 22px; }
  .bar { position: absolute; top: 3px; height: 16px; border-radius: 4px; opacity: 0.95; display: flex; align-items: center; overflow: hidden; }
  .bar-label { font-size: 7px; color: #fff; font-weight: 600; padding: 0 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
  .milestone-marker { position: absolute; top: 1px; font-size: 16px; line-height: 22px; transform: translateX(-50%); color: #f59e0b; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.1)); }

  .review-badge { position: absolute; top: 22px; height: 14px; border-radius: 7px; border: 1.5px dashed; background: #fff; display: flex; align-items: center; justify-content: center; font-size: 6px; font-weight: 700; letter-spacing: 0.3px; text-transform: uppercase; white-space: nowrap; z-index: 2; }
  .review-row { height: 18px; }
  .review-count-label { padding-left: 20px; }
  .review-count { font-size: 8px; color: #aaa; font-style: italic; }

  .grid-lines { position: absolute; top: 0; left: 200px; right: 0; bottom: 0; pointer-events: none; z-index: 0; }
  .grid-line { position: absolute; top: 0; bottom: 0; width: 1px; background: #f5f5f5; }

  .review-section { margin-top: 14px; page-break-inside: avoid; }
  .review-section h3 { font-size: 11px; font-weight: 700; margin-bottom: 6px; color: #333; }
  .review-section table { width: 100%; border-collapse: collapse; font-size: 9px; }
  .review-section th { text-align: left; padding: 5px 8px; background: #fafafa; border: 1px solid #eee; font-weight: 600; color: #666; text-transform: uppercase; font-size: 8px; letter-spacing: 0.5px; }
  .review-section td { padding: 5px 8px; border: 1px solid #eee; vertical-align: top; }
  .phase-pill { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 8px; font-weight: 600; }
  .date-cell { white-space: nowrap; color: #666; }

  @media print {
    body { padding: 10mm; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      ${project.client_logo_url ? `<div class="header-logo"><img src="${project.client_logo_url}" alt="Logo" /></div>` : ''}
    </div>
    <div class="header-center">
      <h1>${project.name}</h1>
      <div class="sub">
        ${format(projectStart, 'MMMM d, yyyy')} – ${format(projectEnd, 'MMMM d, yyyy')}
      </div>
    </div>
    <div class="header-right">
      ${project.pm_name ? `
        <div class="info-card">
          <div class="label">Project Manager</div>
          <div class="value">${project.pm_name}</div>
        </div>` : ''}
      ${tnfLogoHtml}
    </div>
  </div>

  <div class="timeline">
    <div class="month-bar">
      ${monthMarkers.map(m => `<span class="month-span" style="left:${m.left}%;width:${m.width}%">${m.label}</span>`).join('')}
    </div>

    <div class="week-bar">
      ${weekTicks.map((t, i) => {
        const nextLeft = i < weekTicks.length - 1 ? weekTicks[i + 1].left : 100;
        const w = nextLeft - t.left;
        return `<span class="week-tick" style="left:${t.left}%;width:${w}%">${t.label}</span>`;
      }).join('')}
    </div>

    ${showDayLevel ? `<div class="day-bar">${dayHeaderHtml}</div>` : ''}

    <div style="position:relative;">
      <div class="grid-lines">
        ${gridLinesHtml}
      </div>

      ${phaseRowsHtml}
    </div>
  </div>

  ${reviewTableHtml}
</body>
</html>`;

  // ── Use sandboxed iframe instead of window.open ────────────────────
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.setAttribute('sandbox', 'allow-same-origin allow-modals');
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (iframeDoc) {
    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.print();
      } catch {
        const w = window.open('', '_blank');
        if (w) {
          w.document.write(html);
          w.document.close();
          w.focus();
          setTimeout(() => w.print(), 400);
        }
      }
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);
    }, 500);
  }
}
