

# Simplified Project Creation with Per-Phase Feedback Rounds

## Current State
The wizard has 5 steps: Basics → Phase Weights → Select Steps → Feedback → Dependencies. The approved plan reduces this to 2 steps (Basics → Phase Weights & Check-ins). Now we need to add **per-phase feedback round counts** to the Phase Weights step.

## What "Feedbacks per Phase" Means

Each phase (Pre-Production, Production, Post-Production, Delivery) gets a configurable number of client feedback rounds (0, 1, 2, 3...). When the project is created, the single phase task is split into alternating **work** and **review** segments:

```text
Example: Production with 2 feedbacks

┌──── work ────┐  ┌─ review ─┐  ┌──── work ────┐  ┌─ review ─┐  ┌──── work ────┐
│              │  │          │  │              │  │          │  │              │
└──────────────┘  └──────────┘  └──────────────┘  └──────────┘  └──────────────┘
     seg 0            seg 1          seg 2            seg 3          seg 4

2 feedbacks = 3 work segments + 2 review segments = 5 total segments
```

Work segments get ~80% of the phase's time, review segments get ~20%. These segments are fully draggable/resizable on the Gantt chart after creation.

## UX Design

### Phase Weights Step (Step 2)
Below the existing timeline slider, each phase gets a small row with a +/- stepper for feedback count:

```text
┌─────────────────────────────────────────────────────┐
│  Phase Time Allocation                    [Reset]   │
│  ┌──────┬──────────────────────────┬────────┬──┐    │
│  │ Pre  │      Production          │  Post  │🏁│    │
│  └──────┴──────────────────────────┴────────┴──┘    │
│                                                     │
│  Client Feedback Rounds                             │
│  ┌──────────────────────────────────────────────┐   │
│  │ Pre-Production     [ - ]  1  [ + ]           │   │
│  │ Production         [ - ]  2  [ + ]           │   │
│  │ Post-Production    [ - ]  1  [ + ]           │   │
│  │ Delivery           [ - ]  0  [ + ]           │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ▶ Weekly Check-in Settings                         │
│    (collapsible: frequency, day, time, timezone)    │
└─────────────────────────────────────────────────────┘
```

## Technical Plan

### Files to Change

**`src/components/steps/PhaseWeightsConfig.tsx`**
- Add `phaseFeedbackRounds` prop: `Record<string, number>` (e.g., `{ 'Pre-Production': 1, 'Production': 2, ... }`)
- Add `onFeedbackRoundsChange` callback
- Render a stepper (minus / count / plus) for each of the 4 phases below the slider
- Add `feedbackSettings` and `onFeedbackChange` props for the collapsible check-in section
- Import and embed the check-in UI (frequency, weekday, time, timezone, zoom link) as a collapsible section

**`src/pages/NewProject.tsx`**
- Reduce `WizardStep` to `'basics' | 'phases'`
- Remove wizard steps 3-5 (steps, feedback, dependencies) from the array and their UI sections
- Remove `canonicalSteps`, `selectedStepIds`, `customSteps`, `dependencies` state and related handlers
- Remove `fetchCanonicalSteps` useEffect
- Add `phaseFeedbackRounds` state: `{ 'Pre-Production': 1, 'Production': 2, 'Post-Production': 1, 'Delivery': 0 }`
- Keep `feedbackSettings` state (for check-in config only)
- Pass `phaseFeedbackRounds`, `feedbackSettings`, and their setters to `PhaseWeightsConfig`
- Hide "Default Review Rounds" input from the basics step (no longer relevant)
- **Simplify `handleSubmit`**:
  1. Create project record
  2. Create 4 phases (Pre-Production, Production, Post-Production, Delivery)
  3. Create 4 tasks (one per phase), with dates computed from phase weights
  4. For each task, create work+review segments based on `phaseFeedbackRounds[phase]`
  5. Create weekly call task if check-ins are enabled
  6. Skip `project_steps`, `dependencies`, and `canonical_steps` insertions entirely
  7. No need to call `computeSchedule()` -- direct date math using `addWorkingDays`

### Segment Creation Logic (in handleSubmit)

For a phase with N feedback rounds:
- Total segments = 2N + 1 (alternating work/review, starting and ending with work)
- Work gets ~80% of phase days, split equally across N+1 work segments
- Review gets ~20% of phase days, split equally across N review segments
- If N = 0, create a single work segment spanning the full phase
- All dates snap to working days using existing `addWorkingDays` utility

### No Database Changes
Same tables: `phases`, `tasks`, `task_segments`. We're just inserting fewer rows with a simpler pattern.

### Backward Compatibility
- Existing projects with step-level detail are unaffected
- All removed components (`StepLibrary`, `FeedbackConfig`, `DependencyEditor`) remain in the codebase
- The `computeSchedule` engine remains available for potential future "advanced mode"

