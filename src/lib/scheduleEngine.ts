/**
 * VFX Timeline Pro - Schedule Engine
 * 
 * Computes scheduled dates for all tasks based on:
 * - Project start/end dates and working days mask
 * - Phase allocations and task weights
 * - Dependencies between tasks
 * - Feedback settings (meetings, milestones, buffers)
 */

import { addDays, differenceInCalendarDays, format, parse, isAfter, isBefore, max } from 'date-fns';
import { FeedbackSettings } from '@/components/steps/FeedbackConfig';
import { PhaseCategory } from '@/types/database';

// Default phase weights (must sum to 100)
export const DEFAULT_PHASE_WEIGHTS: Record<PhaseCategory, number> = {
  'Client Check-ins': 0, // Check-ins don't consume allocation
  'Pre-Production': 20,
  'Production': 59,
  'Post-Production': 20,
  'Delivery': 1,
  'Immersive': 0, // Add-on, allocated separately
};

// Default step weights within phases (relative weights, normalized per phase)
export const DEFAULT_STEP_WEIGHTS: Record<string, number> = {
  // Pre-Production
  'Script/Storyboard Review': 15,
  'Styleframes': 25,
  'Animatic': 20,
  'Asset List': 10,
  'Pipeline Setup': 15,
  'Lookdev': 15,
  
  // Production
  'Modeling': 15,
  'Texturing': 12,
  'Rigging': 10,
  'Animation': 20,
  'Lighting': 15,
  'Rendering': 13,
  'Compositing': 15,
  
  // Post-Production
  'Editorial': 20,
  'Color Grading': 15,
  'Sound Design': 15,
  'Audio Mix': 15,
  'VFX Polish': 20,
  'Final Review': 15,
  
  // Delivery
  'Quality Control': 25,
  'Format Conversion': 20,
  'Asset Packaging': 20,
  'Client Handoff': 20,
  'Archive': 15,
};

export interface ScheduleTask {
  _stepId: string;
  name: string;
  phaseCategory: PhaseCategory;
  taskType: 'task' | 'milestone' | 'meeting';
  weightPercent: number;
  reviewRounds: number;
  clientVisible: boolean;
  isGenerated?: boolean; // For meetings/milestones/buffers added by engine
  generatedType?: 'check-in' | 'phase-milestone' | 'step-review' | 'rework-buffer';
  recurringDates?: string[]; // For recurring meetings (e.g., weekly calls)
}

export interface ScheduleDependency {
  predecessorId: string;
  successorId: string;
  lagDays?: number;
}

export interface ScheduledTask extends ScheduleTask {
  startDate: Date;
  endDate: Date;
  durationDays: number;
  narrativeText?: string;
}

export interface ScheduleInput {
  projectStartDate: Date;
  projectEndDate: Date;
  workingDaysMask: number; // Binary: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
  bufferPercentage: number;
  tasks: ScheduleTask[];
  dependencies: ScheduleDependency[];
  feedbackSettings: FeedbackSettings;
  phaseWeightOverrides?: Partial<Record<PhaseCategory, number>>;
}

export interface ScheduleOutput {
  scheduledTasks: ScheduledTask[];
  totalWorkingDays: number;
  bufferDays: number;
  warnings: string[];
}

/**
 * Check if a given date is a working day based on the mask
 */
function isWorkingDay(date: Date, mask: number): boolean {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
  // Convert to our mask format: Mon=1, Tue=2, Wed=4, Thu=8, Fri=16, Sat=32, Sun=64
  const dayBit = dayOfWeek === 0 ? 64 : (1 << (dayOfWeek - 1));
  return (mask & dayBit) !== 0;
}

/**
 * Count working days between two dates (inclusive)
 */
function countWorkingDays(startDate: Date, endDate: Date, mask: number): number {
  let count = 0;
  let current = new Date(startDate);
  
  while (current <= endDate) {
    if (isWorkingDay(current, mask)) {
      count++;
    }
    current = addDays(current, 1);
  }
  
  return count;
}

/**
 * Add N working days to a date
 */
function addWorkingDays(startDate: Date, workingDays: number, mask: number): Date {
  if (workingDays <= 0) return new Date(startDate);
  
  let current = new Date(startDate);
  let remaining = workingDays;
  
  while (remaining > 0) {
    current = addDays(current, 1);
    if (isWorkingDay(current, mask)) {
      remaining--;
    }
  }
  
  return current;
}

/**
 * Find the next working day on or after the given date
 */
function nextWorkingDay(date: Date, mask: number): Date {
  let current = new Date(date);
  while (!isWorkingDay(current, mask)) {
    current = addDays(current, 1);
  }
  return current;
}

/**
 * Generate a single recurring check-in task with all meeting dates
 * Returns a single task with recurringDates array instead of multiple tasks
 */
function generateCheckInMeetings(
  projectStart: Date,
  projectEnd: Date,
  settings: FeedbackSettings,
  mask: number
): ScheduleTask[] {
  if (!settings.checkInEnabled) return [];
  
  const weekdayMap: Record<string, number> = {
    'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4, 'friday': 5
  };
  const targetDayOfWeek = weekdayMap[settings.checkInWeekday] || 3;
  const intervalDays = settings.checkInFrequency === 'weekly' ? 7 : 14;
  
  // Collect all check-in dates
  const recurringDates: string[] = [];
  let current = new Date(projectStart);
  
  // Find first occurrence of target weekday
  while (current.getDay() !== targetDayOfWeek) {
    current = addDays(current, 1);
  }
  
  while (current <= projectEnd) {
    if (isWorkingDay(current, mask)) {
      recurringDates.push(format(current, 'yyyy-MM-dd'));
    }
    current = addDays(current, intervalDays);
  }
  
  if (recurringDates.length === 0) return [];
  
  // Return a single task with all dates stored
  const frequencyLabel = settings.checkInFrequency === 'weekly' ? 'Weekly' : 'Bi-weekly';
  
  return [{
    _stepId: 'weekly-call',
    name: `${frequencyLabel} Call`,
    phaseCategory: 'Client Check-ins',
    taskType: 'meeting',
    weightPercent: 0,
    reviewRounds: 0,
    clientVisible: true,
    isGenerated: true,
    generatedType: 'check-in',
    recurringDates, // Array of all meeting dates
  }];
}

/**
 * Generate phase-end milestones
 */
function generatePhaseMilestones(
  phases: PhaseCategory[],
  settings: FeedbackSettings
): ScheduleTask[] {
  if (!settings.milestoneAtPhaseEnd) return [];
  
  return phases.map(phase => ({
    _stepId: `phase-milestone-${phase}`,
    name: `${phase} Complete`,
    phaseCategory: phase,
    taskType: 'milestone' as const,
    weightPercent: 0,
    reviewRounds: 0,
    clientVisible: true,
    isGenerated: true,
    generatedType: 'phase-milestone' as const,
  }));
}

/**
 * Generate step-end review meetings
 */
function generateStepReviews(
  tasks: ScheduleTask[],
  settings: FeedbackSettings
): ScheduleTask[] {
  if (!settings.milestoneAtSelectedSteps) return [];
  
  const reviews: ScheduleTask[] = [];
  
  tasks.forEach(task => {
    if (settings.milestoneStepNames.includes(task.name)) {
      reviews.push({
        _stepId: `review-${task._stepId}`,
        name: `${task.name} Review`,
        phaseCategory: task.phaseCategory,
        taskType: 'meeting',
        weightPercent: 0,
        reviewRounds: 0,
        clientVisible: true,
        isGenerated: true,
        generatedType: 'step-review',
      });
    }
  });
  
  return reviews;
}

/**
 * Generate rework buffer blocks after review meetings
 */
function generateReworkBuffers(
  reviewMeetings: ScheduleTask[],
  settings: FeedbackSettings
): ScheduleTask[] {
  if (!settings.reworkBufferEnabled) return [];
  
  return reviewMeetings
    .filter(m => m.generatedType === 'step-review')
    .map(meeting => ({
      _stepId: `buffer-${meeting._stepId}`,
      name: `${meeting.name.replace(' Review', '')} Rework`,
      phaseCategory: meeting.phaseCategory,
      taskType: 'task' as const,
      weightPercent: 2, // Small weight for rework
      reviewRounds: 0,
      clientVisible: false,
      isGenerated: true,
      generatedType: 'rework-buffer' as const,
    }));
}

/**
 * Build dependency graph and compute topological order
 */
function topologicalSort(
  tasks: ScheduleTask[],
  dependencies: ScheduleDependency[]
): { sorted: ScheduleTask[]; hasCycle: boolean } {
  const taskMap = new Map(tasks.map(t => [t._stepId, t]));
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();
  
  // Initialize
  tasks.forEach(t => {
    inDegree.set(t._stepId, 0);
    adjacency.set(t._stepId, []);
  });
  
  // Build graph
  dependencies.forEach(dep => {
    if (taskMap.has(dep.predecessorId) && taskMap.has(dep.successorId)) {
      adjacency.get(dep.predecessorId)!.push(dep.successorId);
      inDegree.set(dep.successorId, (inDegree.get(dep.successorId) || 0) + 1);
    }
  });
  
  // Kahn's algorithm
  const queue: string[] = [];
  inDegree.forEach((degree, id) => {
    if (degree === 0) queue.push(id);
  });
  
  const sorted: ScheduleTask[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const task = taskMap.get(id);
    if (task) sorted.push(task);
    
    adjacency.get(id)?.forEach(successor => {
      const newDegree = (inDegree.get(successor) || 1) - 1;
      inDegree.set(successor, newDegree);
      if (newDegree === 0) queue.push(successor);
    });
  }
  
  return {
    sorted,
    hasCycle: sorted.length !== tasks.length,
  };
}

/**
 * Main schedule computation
 */
export function computeSchedule(input: ScheduleInput): ScheduleOutput {
  const warnings: string[] = [];
  const {
    projectStartDate,
    projectEndDate,
    workingDaysMask,
    bufferPercentage,
    tasks: inputTasks,
    dependencies: inputDependencies,
    feedbackSettings,
    phaseWeightOverrides = {},
  } = input;
  
  // 1. Calculate total working days
  const totalWorkingDays = countWorkingDays(projectStartDate, projectEndDate, workingDaysMask);
  
  if (totalWorkingDays === 0) {
    warnings.push('No working days between start and end dates with current working days mask');
    return { scheduledTasks: [], totalWorkingDays: 0, bufferDays: 0, warnings };
  }
  
  // 2. Reserve buffer
  const bufferDays = Math.floor(totalWorkingDays * (bufferPercentage / 100));
  const availableDays = totalWorkingDays - bufferDays;
  
  // 3. Collect all phases used
  const usedPhases = [...new Set(inputTasks.map(t => t.phaseCategory))] as PhaseCategory[];
  
  // 4. Generate additional tasks from feedback settings
  const checkInMeetings = generateCheckInMeetings(projectStartDate, projectEndDate, feedbackSettings, workingDaysMask);
  const phaseMilestones = generatePhaseMilestones(usedPhases, feedbackSettings);
  const stepReviews = generateStepReviews(inputTasks, feedbackSettings);
  const reworkBuffers = generateReworkBuffers(stepReviews, feedbackSettings);
  
  // 5. Combine all tasks
  let allTasks = [
    ...inputTasks,
    ...stepReviews,
    ...reworkBuffers,
    ...phaseMilestones,
  ];
  
  // Add Picture Lock milestone if Editorial exists
  const hasEditorial = inputTasks.some(t => t.name.toLowerCase().includes('editorial'));
  if (hasEditorial) {
    allTasks.push({
      _stepId: 'picture-lock',
      name: 'Picture Lock',
      phaseCategory: 'Post-Production',
      taskType: 'milestone',
      weightPercent: 0,
      reviewRounds: 0,
      clientVisible: true,
      isGenerated: true,
      generatedType: 'phase-milestone',
    });
  }
  
  // 6. Build extended dependencies
  const extendedDependencies: ScheduleDependency[] = [...inputDependencies];
  
  // Step reviews depend on their parent step
  stepReviews.forEach(review => {
    const parentStepId = review._stepId.replace('review-', '');
    extendedDependencies.push({
      predecessorId: parentStepId,
      successorId: review._stepId,
    });
  });
  
  // Rework buffers depend on their review
  reworkBuffers.forEach(buffer => {
    const reviewId = buffer._stepId.replace('buffer-', '');
    extendedDependencies.push({
      predecessorId: reviewId,
      successorId: buffer._stepId,
    });
  });
  
  // Picture Lock depends on Editorial, and grading/mix depend on it
  if (hasEditorial) {
    const editorial = inputTasks.find(t => t.name.toLowerCase().includes('editorial'));
    if (editorial) {
      extendedDependencies.push({
        predecessorId: editorial._stepId,
        successorId: 'picture-lock',
      });
    }
    
    // Make grading and mix depend on picture lock
    allTasks.forEach(task => {
      const name = task.name.toLowerCase();
      if (name.includes('grading') || name.includes('color') || name.includes('audio mix') || name.includes('sound')) {
        extendedDependencies.push({
          predecessorId: 'picture-lock',
          successorId: task._stepId,
        });
      }
    });
  }
  
  // Phase milestones depend on all tasks in their phase
  phaseMilestones.forEach(milestone => {
    allTasks.forEach(task => {
      if (task.phaseCategory === milestone.phaseCategory && task._stepId !== milestone._stepId && !task.isGenerated) {
        extendedDependencies.push({
          predecessorId: task._stepId,
          successorId: milestone._stepId,
        });
      }
    });
  });
  
  // Add phase-to-phase dependencies: tasks in later phases depend on the previous phase completing
  const phaseOrder: PhaseCategory[] = ['Pre-Production', 'Production', 'Post-Production', 'Delivery', 'Immersive'];
  const orderedUsedPhases = phaseOrder.filter(p => usedPhases.includes(p));
  
  for (let i = 1; i < orderedUsedPhases.length; i++) {
    const prevPhase = orderedUsedPhases[i - 1];
    const currentPhase = orderedUsedPhases[i];
    
    // Find the predecessor: prefer phase milestone, otherwise use the last task in previous phase
    const prevPhaseMilestone = phaseMilestones.find(m => m.phaseCategory === prevPhase);
    const prevPhaseTasks = allTasks.filter(t => t.phaseCategory === prevPhase && !t.isGenerated);
    
    let predecessorId: string | null = null;
    if (prevPhaseMilestone) {
      predecessorId = prevPhaseMilestone._stepId;
    } else if (prevPhaseTasks.length > 0) {
      // Use the last non-generated task in the phase
      predecessorId = prevPhaseTasks[prevPhaseTasks.length - 1]._stepId;
    }
    
    if (predecessorId) {
      // Make all non-generated tasks in current phase depend on previous phase
      const currentPhaseTasks = allTasks.filter(t => t.phaseCategory === currentPhase && !t.isGenerated);
      currentPhaseTasks.forEach(task => {
        // Only add if this task doesn't already have a dependency from this predecessor
        const alreadyExists = extendedDependencies.some(
          d => d.predecessorId === predecessorId && d.successorId === task._stepId
        );
        if (!alreadyExists) {
          extendedDependencies.push({
            predecessorId: predecessorId!,
            successorId: task._stepId,
          });
        }
      });
    }
  }
  
  // 7. Calculate phase weights
  const phaseWeights: Record<string, number> = {};
  let totalWeight = 0;
  usedPhases.forEach(phase => {
    const weight = phaseWeightOverrides[phase] ?? DEFAULT_PHASE_WEIGHTS[phase] ?? 10;
    phaseWeights[phase] = weight;
    totalWeight += weight;
  });
  
  // Normalize if needed
  if (totalWeight !== 100 && totalWeight > 0) {
    const scale = 100 / totalWeight;
    usedPhases.forEach(phase => {
      phaseWeights[phase] = phaseWeights[phase] * scale;
    });
  }
  
  // 8. Calculate days per phase
  const phaseDays: Record<string, number> = {};
  usedPhases.forEach(phase => {
    phaseDays[phase] = Math.max(1, Math.floor(availableDays * (phaseWeights[phase] / 100)));
  });
  
  // 9. Calculate task weights within each phase and allocate days
  const taskDays = new Map<string, number>();
  
  usedPhases.forEach(phase => {
    const phaseTasks = allTasks.filter(t => t.phaseCategory === phase && t.taskType === 'task');
    const phaseAvailableDays = phaseDays[phase];
    
    // Calculate total weight for phase tasks
    let phaseTaskWeight = 0;
    phaseTasks.forEach(task => {
      const weight = task.weightPercent || DEFAULT_STEP_WEIGHTS[task.name] || 10;
      phaseTaskWeight += weight;
    });
    
    // Allocate days
    phaseTasks.forEach(task => {
      const weight = task.weightPercent || DEFAULT_STEP_WEIGHTS[task.name] || 10;
      const days = Math.max(1, Math.round(phaseAvailableDays * (weight / phaseTaskWeight)));
      taskDays.set(task._stepId, days);
    });
    
    // Milestones and meetings get 0 or 1 day
    allTasks.filter(t => t.phaseCategory === phase && t.taskType !== 'task').forEach(task => {
      taskDays.set(task._stepId, task.taskType === 'milestone' ? 0 : 1);
    });
  });
  
  // 10. Topological sort for scheduling order
  const { sorted: sortedTasks, hasCycle } = topologicalSort(allTasks, extendedDependencies);
  
  if (hasCycle) {
    warnings.push('Dependency cycle detected - some tasks may not be scheduled correctly');
  }
  
  // Build predecessor map
  const predecessorMap = new Map<string, string[]>();
  extendedDependencies.forEach(dep => {
    if (!predecessorMap.has(dep.successorId)) {
      predecessorMap.set(dep.successorId, []);
    }
    predecessorMap.get(dep.successorId)!.push(dep.predecessorId);
  });
  
  // 11. Schedule tasks respecting dependencies
  const scheduledTasks: ScheduledTask[] = [];
  const taskEndDates = new Map<string, Date>();
  
  sortedTasks.forEach(task => {
    const predecessors = predecessorMap.get(task._stepId) || [];
    
    // Find earliest start date (after all predecessors)
    let earliestStart = new Date(projectStartDate);
    predecessors.forEach(predId => {
      const predEnd = taskEndDates.get(predId);
      if (predEnd) {
        const dayAfterPred = addDays(predEnd, 1);
        if (isAfter(dayAfterPred, earliestStart)) {
          earliestStart = dayAfterPred;
        }
      }
    });
    
    // Ensure it's a working day
    earliestStart = nextWorkingDay(earliestStart, workingDaysMask);
    
    // Calculate duration and end date
    const durationDays = taskDays.get(task._stepId) || 1;
    const endDate = durationDays === 0 
      ? earliestStart 
      : addWorkingDays(earliestStart, durationDays - 1, workingDaysMask);
    
    taskEndDates.set(task._stepId, endDate);
    
    scheduledTasks.push({
      ...task,
      startDate: earliestStart,
      endDate,
      durationDays,
    });
  });
  
  // 12. Scale to fit project end date
  if (scheduledTasks.length > 0) {
    const lastTaskEnd = scheduledTasks.reduce((latest, t) => 
      isAfter(t.endDate, latest) ? t.endDate : latest, 
      scheduledTasks[0].endDate
    );
    
    const actualDays = countWorkingDays(projectStartDate, lastTaskEnd, workingDaysMask);
    const targetDays = totalWorkingDays;
    
    if (actualDays !== targetDays && actualDays > 0) {
      const scaleFactor = targetDays / actualDays;
      
      if (Math.abs(scaleFactor - 1) > 0.1) {
        warnings.push(`Schedule ${scaleFactor > 1 ? 'expanded' : 'compressed'} by ${Math.abs((scaleFactor - 1) * 100).toFixed(0)}% to fit project dates`);
      }
      
      // Recalculate with scaled durations
      const scaledTaskDays = new Map<string, number>();
      taskDays.forEach((days, taskId) => {
        scaledTaskDays.set(taskId, Math.max(days === 0 ? 0 : 1, Math.round(days * scaleFactor)));
      });
      
      // Re-schedule with scaled durations
      scheduledTasks.length = 0;
      taskEndDates.clear();
      
      sortedTasks.forEach(task => {
        const predecessors = predecessorMap.get(task._stepId) || [];
        
        let earliestStart = new Date(projectStartDate);
        predecessors.forEach(predId => {
          const predEnd = taskEndDates.get(predId);
          if (predEnd) {
            const dayAfterPred = addDays(predEnd, 1);
            if (isAfter(dayAfterPred, earliestStart)) {
              earliestStart = dayAfterPred;
            }
          }
        });
        
        earliestStart = nextWorkingDay(earliestStart, workingDaysMask);
        
        const durationDays = scaledTaskDays.get(task._stepId) || 1;
        const endDate = durationDays === 0 
          ? earliestStart 
          : addWorkingDays(earliestStart, durationDays - 1, workingDaysMask);
        
        // Clamp to project end date
        const clampedEnd = isAfter(endDate, projectEndDate) ? projectEndDate : endDate;
        
        taskEndDates.set(task._stepId, clampedEnd);
        
        scheduledTasks.push({
          ...task,
          startDate: earliestStart,
          endDate: clampedEnd,
          durationDays,
        });
      });
    }
  }
  
  // 13. Add the single weekly call task with its recurring dates
  if (checkInMeetings.length > 0) {
    const weeklyCallTask = checkInMeetings[0]; // Now there's only one
    const recurringDates = weeklyCallTask.recurringDates || [];
    
    if (recurringDates.length > 0) {
      const firstDate = new Date(recurringDates[0]);
      const lastDate = new Date(recurringDates[recurringDates.length - 1]);
      
      scheduledTasks.push({
        ...weeklyCallTask,
        startDate: firstDate,
        endDate: lastDate,
        durationDays: recurringDates.length,
      });
    }
  }
  
  // Sort by start date
  scheduledTasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  
  return {
    scheduledTasks,
    totalWorkingDays,
    bufferDays,
    warnings,
  };
}

/**
 * Format schedule output for database insertion
 */
export function formatScheduleForDb(
  scheduled: ScheduledTask[]
): { name: string; start_date: string; end_date: string; task_type: string; recurring_dates?: string[] }[] {
  return scheduled.map(task => ({
    name: task.name,
    start_date: format(task.startDate, 'yyyy-MM-dd'),
    end_date: format(task.endDate, 'yyyy-MM-dd'),
    task_type: task.taskType,
    recurring_dates: task.recurringDates,
  }));
}
