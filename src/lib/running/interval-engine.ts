import { calculatePaceSecPerKm } from "./pace";

export type StepType =
  | "WARMUP"
  | "RUN"
  | "RECOVERY"
  | "WALK"
  | "REST"
  | "COOLDOWN"
  | "FREE_RUN";

export type TargetType = "DISTANCE" | "DURATION" | "OPEN";
export type TargetUnit = "METERS" | "SECONDS";

export interface WorkoutStepConfig {
  id?: string;
  order: number;
  stepType: StepType;
  targetType: TargetType;
  targetValue: number; // meters or seconds
  targetUnit?: TargetUnit;
  repeatCount?: number; // >1 if this step or block repeats
  groupIndex?: number | null; // common group id for repeating sets
  label?: string;
  notes?: string;
}

export interface FlattenedIntervalStep {
  queueIndex: number;
  originalStepOrder: number;
  stepType: StepType;
  targetType: TargetType;
  targetValue: number; // meters or seconds
  label: string;
  iteration: number;
  totalIterations: number;
  notes?: string;
}

export interface IntervalResultLap {
  stepOrder: number;
  stepType: StepType;
  targetLabel: string;
  targetDistance?: number;
  targetDuration?: number;
  actualDistance: number; // meters
  actualDuration: number; // seconds
  averagePace: number; // sec / km
  fastestPace?: number;
  elevationChange?: number;
  completed: boolean;
}

export interface IntervalEngineSnapshot {
  status: "IDLE" | "ACTIVE" | "PAUSED" | "COMPLETED";
  currentStepIndex: number;
  totalSteps: number;
  currentStep: FlattenedIntervalStep | null;
  nextStep: FlattenedIntervalStep | null;
  stepElapsedSeconds: number;
  stepElapsedDistance: number; // meters
  stepProgress: number; // 0.0 to 1.0
  remainingDistance: number | null; // meters or null if time-based
  remainingSeconds: number | null; // seconds or null if distance-based
  completedLaps: IntervalResultLap[];
  isLastStep: boolean;
}

export interface StepTransitionEvent {
  completedStep: FlattenedIntervalStep;
  nextStep: FlattenedIntervalStep | null;
  lapResult: IntervalResultLap;
}

/**
 * Expands workout step definitions (including repeat groups) into a linear execution queue.
 */
export function flattenWorkoutSteps(steps: WorkoutStepConfig[]): FlattenedIntervalStep[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  const queue: FlattenedIntervalStep[] = [];

  // Group steps by groupIndex if specified, or process sequential steps
  let i = 0;
  while (i < sorted.length) {
    const step = sorted[i];

    if (step.groupIndex !== undefined && step.groupIndex !== null) {
      // Find all steps belonging to this same groupIndex
      const groupSteps: WorkoutStepConfig[] = [];
      const currentGroup = step.groupIndex;
      while (i < sorted.length && sorted[i].groupIndex === currentGroup) {
        groupSteps.push(sorted[i]);
        i++;
      }

      // Check repeat count of the group (use max repeatCount among members or step's count)
      const repeatCount = Math.max(...groupSteps.map((s) => s.repeatCount || 1), 1);

      for (let rep = 1; rep <= repeatCount; rep++) {
        for (const gStep of groupSteps) {
          queue.push({
            queueIndex: queue.length,
            originalStepOrder: gStep.order,
            stepType: gStep.stepType,
            targetType: gStep.targetType,
            targetValue: gStep.targetValue,
            label:
              gStep.label ||
              `${formatStepType(gStep.stepType)} (${rep}/${repeatCount})`,
            iteration: rep,
            totalIterations: repeatCount,
            notes: gStep.notes,
          });
        }
      }
    } else {
      // Single step (e.g. Warm up or Cool down)
      const repeats = step.repeatCount && step.repeatCount > 1 ? step.repeatCount : 1;
      for (let rep = 1; rep <= repeats; rep++) {
        queue.push({
          queueIndex: queue.length,
          originalStepOrder: step.order,
          stepType: step.stepType,
          targetType: step.targetType,
          targetValue: step.targetValue,
          label:
            step.label ||
            (repeats > 1
              ? `${formatStepType(step.stepType)} (${rep}/${repeats})`
              : formatStepType(step.stepType)),
          iteration: rep,
          totalIterations: repeats,
          notes: step.notes,
        });
      }
      i++;
    }
  }

  return queue;
}

export function formatStepType(type: StepType): string {
  switch (type) {
    case "WARMUP":
      return "Warm Up";
    case "RUN":
      return "Run";
    case "RECOVERY":
      return "Recovery";
    case "WALK":
      return "Walk";
    case "REST":
      return "Rest";
    case "COOLDOWN":
      return "Cool Down";
    case "FREE_RUN":
      return "Free Run";
  }
}

/**
 * Deterministic Interval Training Engine.
 */
export class IntervalEngine {
  private queue: FlattenedIntervalStep[] = [];
  private currentIndex = 0;
  private status: "IDLE" | "ACTIVE" | "PAUSED" | "COMPLETED" = "IDLE";

  // Step accumulators
  private stepStartTotalDistance = 0;
  private stepStartTotalSeconds = 0;
  private stepElapsedSeconds = 0;
  private stepElapsedDistance = 0;

  private completedLaps: IntervalResultLap[] = [];

  // Callbacks
  public onTransition?: (event: StepTransitionEvent) => void;
  public onWorkoutComplete?: (laps: IntervalResultLap[]) => void;
  public onCountdownCue?: (secondsRemaining: number, currentStep: FlattenedIntervalStep) => void;

  private notifiedCountdowns = new Set<number>();

  constructor(steps: WorkoutStepConfig[]) {
    this.queue = flattenWorkoutSteps(steps);
  }

  public start(currentTotalDistance = 0, currentTotalSeconds = 0) {
    if (this.queue.length === 0) {
      this.status = "COMPLETED";
      return;
    }
    this.status = "ACTIVE";
    this.currentIndex = 0;
    this.stepStartTotalDistance = currentTotalDistance;
    this.stepStartTotalSeconds = currentTotalSeconds;
    this.stepElapsedDistance = 0;
    this.stepElapsedSeconds = 0;
    this.notifiedCountdowns.clear();
  }

  public pause() {
    if (this.status === "ACTIVE") {
      this.status = "PAUSED";
    }
  }

  public resume() {
    if (this.status === "PAUSED") {
      this.status = "ACTIVE";
    }
  }

  /**
   * Updates interval state based on latest run totals.
   * Can trigger step completion and transitions.
   */
  public update(currentTotalDistance: number, currentTotalSeconds: number): IntervalEngineSnapshot {
    if (this.status !== "ACTIVE" || this.currentIndex >= this.queue.length) {
      return this.getSnapshot();
    }

    const currentStep = this.queue[this.currentIndex];
    this.stepElapsedDistance = Math.max(0, currentTotalDistance - this.stepStartTotalDistance);
    this.stepElapsedSeconds = Math.max(0, currentTotalSeconds - this.stepStartTotalSeconds);

    // Check countdown triggers (3, 2, 1 seconds before completion)
    if (currentStep.targetType === "DURATION") {
      const remainingSec = Math.max(0, currentStep.targetValue - this.stepElapsedSeconds);
      if (remainingSec <= 3 && remainingSec >= 1 && !this.notifiedCountdowns.has(remainingSec)) {
        this.notifiedCountdowns.add(remainingSec);
        this.onCountdownCue?.(remainingSec, currentStep);
      }
    } else if (currentStep.targetType === "DISTANCE") {
      const remainingMeters = Math.max(0, currentStep.targetValue - this.stepElapsedDistance);
      // Countdown trigger when approx 15m remaining (approx 3 sec running)
      if (remainingMeters <= 15 && !this.notifiedCountdowns.has(15)) {
        this.notifiedCountdowns.add(15);
      }
    }

    // Check if current step target reached
    let stepCompleted = false;
    if (currentStep.targetType === "DISTANCE") {
      if (this.stepElapsedDistance >= currentStep.targetValue) {
        stepCompleted = true;
      }
    } else if (currentStep.targetType === "DURATION") {
      if (this.stepElapsedSeconds >= currentStep.targetValue) {
        stepCompleted = true;
      }
    }

    if (stepCompleted) {
      this.advanceStep(currentTotalDistance, currentTotalSeconds);
    }

    return this.getSnapshot();
  }

  /**
   * Manually skip or advance to the next interval step.
   */
  public manualAdvance(currentTotalDistance: number, currentTotalSeconds: number) {
    if (this.status === "ACTIVE" && this.currentIndex < this.queue.length) {
      this.advanceStep(currentTotalDistance, currentTotalSeconds);
    }
  }

  private advanceStep(currentTotalDistance: number, currentTotalSeconds: number) {
    const completedStep = this.queue[this.currentIndex];
    const duration = Math.max(1, this.stepElapsedSeconds);
    const distance = this.stepElapsedDistance;
    const pace = calculatePaceSecPerKm(distance, duration);

    const lapResult: IntervalResultLap = {
      stepOrder: completedStep.originalStepOrder,
      stepType: completedStep.stepType,
      targetLabel: completedStep.label,
      targetDistance:
        completedStep.targetType === "DISTANCE" ? completedStep.targetValue : undefined,
      targetDuration:
        completedStep.targetType === "DURATION" ? completedStep.targetValue : undefined,
      actualDistance: Math.round(distance),
      actualDuration: duration,
      averagePace: pace,
      completed: true,
    };

    this.completedLaps.push(lapResult);

    this.currentIndex++;
    this.stepStartTotalDistance = currentTotalDistance;
    this.stepStartTotalSeconds = currentTotalSeconds;
    this.stepElapsedDistance = 0;
    this.stepElapsedSeconds = 0;
    this.notifiedCountdowns.clear();

    const nextStep = this.currentIndex < this.queue.length ? this.queue[this.currentIndex] : null;

    this.onTransition?.({
      completedStep,
      nextStep,
      lapResult,
    });

    if (!nextStep) {
      this.status = "COMPLETED";
      this.onWorkoutComplete?.(this.completedLaps);
    }
  }

  public getSnapshot(): IntervalEngineSnapshot {
    const currentStep =
      this.currentIndex < this.queue.length ? this.queue[this.currentIndex] : null;
    const nextStep =
      this.currentIndex + 1 < this.queue.length ? this.queue[this.currentIndex + 1] : null;

    let stepProgress = 0;
    let remainingDistance: number | null = null;
    let remainingSeconds: number | null = null;

    if (currentStep) {
      if (currentStep.targetType === "DISTANCE") {
        stepProgress = Math.min(1.0, this.stepElapsedDistance / currentStep.targetValue);
        remainingDistance = Math.max(0, currentStep.targetValue - this.stepElapsedDistance);
      } else if (currentStep.targetType === "DURATION") {
        stepProgress = Math.min(1.0, this.stepElapsedSeconds / currentStep.targetValue);
        remainingSeconds = Math.max(0, currentStep.targetValue - this.stepElapsedSeconds);
      } else {
        stepProgress = 0;
      }
    }

    return {
      status: this.status,
      currentStepIndex: this.currentIndex,
      totalSteps: this.queue.length,
      currentStep,
      nextStep,
      stepElapsedSeconds: this.stepElapsedSeconds,
      stepElapsedDistance: this.stepElapsedDistance,
      stepProgress,
      remainingDistance,
      remainingSeconds,
      completedLaps: [...this.completedLaps],
      isLastStep: this.currentIndex === this.queue.length - 1,
    };
  }
}
