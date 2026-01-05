/**
 * VFX Timeline Pro - Narrative Text Generator
 * 
 * Auto-generates client-facing narrative text for each step during timeline generation
 */

import type { PhaseCategory } from '@/types/database';

interface NarrativeInput {
  stepName: string;
  phaseCategory: PhaseCategory;
  taskType: 'task' | 'milestone' | 'meeting';
  reviewRounds: number;
  durationDays: number;
  isClientVisible: boolean;
}

interface NarrativeOutput {
  objective: string;
  clientProvides: string;
  reviewMeeting: string;
  expectedTurnaround: string;
  fullNarrative: string;
}

// Step-specific narrative templates
const STEP_NARRATIVES: Record<string, Partial<NarrativeOutput>> = {
  // Discovery
  'Kickoff Meeting': {
    objective: 'Align on project vision, goals, and success criteria with all stakeholders.',
    clientProvides: 'Project brief, brand guidelines, reference materials, and key stakeholder contacts.',
    reviewMeeting: 'Initial alignment discussion covering scope, timeline expectations, and communication protocols.',
  },
  'Creative Brief Review': {
    objective: 'Finalize the creative direction and ensure all requirements are documented.',
    clientProvides: 'Approved creative brief, brand assets, and any mandatory inclusions.',
    reviewMeeting: 'Walk-through of the creative brief with opportunity for questions and clarifications.',
  },
  'Reference Gathering': {
    objective: 'Collect and organize visual references that align with the creative vision.',
    clientProvides: 'Examples of preferred styles, competitors to reference or avoid, and mood boards.',
    reviewMeeting: 'Reference review to confirm aesthetic direction before moving to concepts.',
  },
  'Concept Development': {
    objective: 'Explore multiple creative directions and develop initial concepts.',
    clientProvides: 'Feedback on reference materials and preferred creative direction.',
    reviewMeeting: 'Presentation of concept options with discussion of strengths and trade-offs.',
  },

  // Pre-Production
  'Script/Storyboard Review': {
    objective: 'Establish the narrative flow and visual sequence for the project.',
    clientProvides: 'Approved script or shot list, timing requirements, and key messaging.',
    reviewMeeting: 'Frame-by-frame review of storyboard with timing and narrative feedback.',
  },
  'Styleframes': {
    objective: 'Define the final look and feel through key representative frames.',
    clientProvides: 'Approval on concept direction and any additional brand requirements.',
    reviewMeeting: 'Detailed review of styleframes covering color, typography, and visual treatment.',
  },
  'Animatic': {
    objective: 'Create a motion timing reference showing flow and pacing.',
    clientProvides: 'Audio track (if applicable), timing notes, and storyboard approval.',
    reviewMeeting: 'Review of timing, transitions, and overall flow before production begins.',
  },
  'Lookdev': {
    objective: 'Develop the technical visual style including materials, lighting, and rendering approach.',
    clientProvides: 'Styleframe approvals and any specific technical requirements.',
    reviewMeeting: 'Technical review of look development tests and material studies.',
  },

  // Production
  'Modeling': {
    objective: 'Build 3D assets required for the project.',
    clientProvides: 'Reference images, CAD files, or specifications for assets.',
    reviewMeeting: 'Asset review for accuracy and adherence to approved designs.',
  },
  'Texturing': {
    objective: 'Apply materials and textures to 3D assets.',
    clientProvides: 'Material references, brand color specifications.',
    reviewMeeting: 'Review of textured assets in context of final lighting.',
  },
  'Animation': {
    objective: 'Bring assets to life with movement and timing.',
    clientProvides: 'Animatic approval and any specific motion notes.',
    reviewMeeting: 'Animation blocking and timing review before polish.',
  },
  'Lighting': {
    objective: 'Establish the lighting and atmosphere for final renders.',
    clientProvides: 'Lookdev approvals and any mood/atmosphere preferences.',
    reviewMeeting: 'Lighting setup review with test renders.',
  },
  'Rendering': {
    objective: 'Generate final quality frames and passes.',
    clientProvides: 'Final approval on lighting and animation.',
    reviewMeeting: 'Render quality review and technical QC.',
  },
  'Compositing': {
    objective: 'Combine all elements and apply final polish and effects.',
    clientProvides: 'All render approvals and final VFX notes.',
    reviewMeeting: 'Near-final review before color grading.',
  },

  // Post-Production
  'Editorial': {
    objective: 'Refine timing, pacing, and overall edit.',
    clientProvides: 'Final audio mix, music track, and timing preferences.',
    reviewMeeting: 'Edit review with focus on narrative flow and timing.',
  },
  'Color Grading': {
    objective: 'Apply final color treatment for consistent visual tone.',
    clientProvides: 'Picture lock approval and color references.',
    reviewMeeting: 'Color review on calibrated monitors.',
  },
  'Sound Design': {
    objective: 'Create and integrate sound effects and audio elements.',
    clientProvides: 'Audio preferences, music track, and sound references.',
    reviewMeeting: 'Sound design review in context with picture.',
  },
  'Audio Mix': {
    objective: 'Balance all audio elements for final delivery.',
    clientProvides: 'VO files, music stems, and mixing preferences.',
    reviewMeeting: 'Final audio mix review with level approvals.',
  },

  // Delivery
  'Quality Control': {
    objective: 'Comprehensive technical review before final delivery.',
    clientProvides: 'Delivery specifications and format requirements.',
    reviewMeeting: 'QC report review and sign-off.',
  },
  'Client Handoff': {
    objective: 'Deliver final assets to client with all required formats.',
    clientProvides: 'Confirmation of delivery receipt and final approval.',
    reviewMeeting: 'Final walkthrough and project handoff.',
  },
};

// Phase-specific defaults for steps not in the template
const PHASE_DEFAULTS: Record<PhaseCategory, Partial<NarrativeOutput>> = {
  'Discovery': {
    objective: 'Explore and define requirements for this phase of the project.',
    clientProvides: 'Relevant reference materials and feedback on direction.',
    reviewMeeting: 'Progress review and alignment check.',
  },
  'Pre-Production': {
    objective: 'Prepare detailed plans and assets for production.',
    clientProvides: 'Approvals on previous deliverables and additional references.',
    reviewMeeting: 'Pre-production progress review.',
  },
  'Production': {
    objective: 'Execute the approved creative direction.',
    clientProvides: 'Ongoing feedback and approvals as work progresses.',
    reviewMeeting: 'Work-in-progress review with detailed feedback session.',
  },
  'Post-Production': {
    objective: 'Refine and polish the deliverables.',
    clientProvides: 'Final notes and approvals on previous phases.',
    reviewMeeting: 'Post-production review with focus on final quality.',
  },
  'Delivery': {
    objective: 'Prepare and deliver final assets.',
    clientProvides: 'Delivery specifications and final sign-off.',
    reviewMeeting: 'Final delivery review and handoff.',
  },
  'Immersive': {
    objective: 'Develop immersive/interactive components.',
    clientProvides: 'Platform specifications and interaction requirements.',
    reviewMeeting: 'Interactive experience review and testing.',
  },
};

/**
 * Generate narrative text for a task
 */
export function generateNarrative(input: NarrativeInput): NarrativeOutput {
  const stepTemplate = STEP_NARRATIVES[input.stepName];
  const phaseDefaults = PHASE_DEFAULTS[input.phaseCategory];

  // Handle meetings and milestones differently
  if (input.taskType === 'meeting') {
    return {
      objective: `Scheduled meeting for project alignment and feedback.`,
      clientProvides: 'Attendance and any prepared notes or questions.',
      reviewMeeting: 'This is the review meeting.',
      expectedTurnaround: `Duration: ~1 hour`,
      fullNarrative: `This is a scheduled meeting for project alignment and feedback. Please come prepared with any questions or concerns.`,
    };
  }

  if (input.taskType === 'milestone') {
    return {
      objective: `Key project milestone marking completion of ${input.stepName.replace(' Complete', '').replace(' Milestone', '')}.`,
      clientProvides: 'Final approval and sign-off on completed work.',
      reviewMeeting: 'Milestone review and approval session.',
      expectedTurnaround: 'Milestone checkpoint',
      fullNarrative: `This milestone marks a key checkpoint in the project. Client approval is required before proceeding to the next phase.`,
    };
  }

  // For regular tasks
  const objective = stepTemplate?.objective || phaseDefaults?.objective || 'Complete this phase of work.';
  const clientProvides = stepTemplate?.clientProvides || phaseDefaults?.clientProvides || 'Relevant feedback and approvals.';
  const reviewMeeting = stepTemplate?.reviewMeeting || phaseDefaults?.reviewMeeting || 'Progress review and feedback session.';
  
  const turnaround = input.durationDays === 1 
    ? '1 working day'
    : `${input.durationDays} working days`;
  
  const reviewText = input.reviewRounds > 0 
    ? ` Includes ${input.reviewRounds} round${input.reviewRounds > 1 ? 's' : ''} of revisions.`
    : '';

  const fullNarrative = `**Objective:** ${objective}

**What we need from you:** ${clientProvides}

**Review session:** ${reviewMeeting}

**Expected turnaround:** ${turnaround}${reviewText}`;

  return {
    objective,
    clientProvides,
    reviewMeeting,
    expectedTurnaround: turnaround + reviewText,
    fullNarrative,
  };
}

/**
 * Generate narrative for a scheduled task
 */
export function generateNarrativeForTask(
  name: string,
  phaseCategory: PhaseCategory,
  taskType: 'task' | 'milestone' | 'meeting',
  reviewRounds: number,
  durationDays: number,
  clientVisible: boolean
): string {
  if (!clientVisible) {
    return ''; // No narrative needed for internal tasks
  }

  const narrative = generateNarrative({
    stepName: name,
    phaseCategory,
    taskType,
    reviewRounds,
    durationDays,
    isClientVisible: clientVisible,
  });

  return narrative.fullNarrative;
}
