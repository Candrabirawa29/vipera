import { WorkoutStepConfig } from "../running/interval-engine";

export interface IntervalWorkoutTemplate {
  id: string;
  title: string;
  description: string;
  category: "TRACK" | "TIME_BASED" | "TEMPO" | "BEGINNER";
  isPreset: boolean;
  steps: WorkoutStepConfig[];
}

export const WORKOUT_PRESETS: IntervalWorkoutTemplate[] = [
  {
    id: "preset-400m-repeats",
    title: "6 × 400m Track Repeats",
    description: "Classic speed & VO2max builder. Warm up, 6 fast 400m intervals with 200m active jog recoveries, cool down.",
    category: "TRACK",
    isPreset: true,
    steps: [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 600, // 10 mins
        targetUnit: "SECONDS",
        label: "Warm Up Jog",
        notes: "Easy aerobic pace, dynamic breathing",
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DISTANCE",
        targetValue: 400,
        targetUnit: "METERS",
        repeatCount: 6,
        groupIndex: 1,
        label: "Fast 400m",
        notes: "Target 5K race pace or slightly faster",
      },
      {
        order: 3,
        stepType: "RECOVERY",
        targetType: "DISTANCE",
        targetValue: 200,
        targetUnit: "METERS",
        repeatCount: 6,
        groupIndex: 1,
        label: "Jog Recovery 200m",
        notes: "Slow, relaxed jog to lower heart rate",
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300, // 5 mins
        targetUnit: "SECONDS",
        label: "Cool Down",
        notes: "Easy flush-out jog and walk",
      },
    ],
  },
  {
    id: "preset-800m-repeats",
    title: "4 × 800m Cruise Repeats",
    description: "Aerobic power and lactate threshold stamina builder. 800m efforts with 400m easy jog recovery.",
    category: "TRACK",
    isPreset: true,
    steps: [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 600,
        targetUnit: "SECONDS",
        label: "Warm Up",
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DISTANCE",
        targetValue: 800,
        targetUnit: "METERS",
        repeatCount: 4,
        groupIndex: 1,
        label: "Strong 800m",
        notes: "Controlled, steady 10K pace",
      },
      {
        order: 3,
        stepType: "RECOVERY",
        targetType: "DISTANCE",
        targetValue: 400,
        targetUnit: "METERS",
        repeatCount: 4,
        groupIndex: 1,
        label: "Float Recovery 400m",
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300,
        targetUnit: "SECONDS",
        label: "Cool Down",
      },
    ],
  },
  {
    id: "preset-1k-repeats",
    title: "4 × 1K Threshold Repeats",
    description: "The gold standard 5K/10K pacing workout. 1-kilometer repeats at threshold with 2-minute recoveries.",
    category: "TRACK",
    isPreset: true,
    steps: [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 600,
        targetUnit: "SECONDS",
        label: "Warm Up 10 min",
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DISTANCE",
        targetValue: 1000,
        targetUnit: "METERS",
        repeatCount: 4,
        groupIndex: 1,
        label: "Threshold 1K",
      },
      {
        order: 3,
        stepType: "REST",
        targetType: "DURATION",
        targetValue: 120, // 2 mins
        targetUnit: "SECONDS",
        repeatCount: 4,
        groupIndex: 1,
        label: "Rest / Walk 2 min",
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300,
        targetUnit: "SECONDS",
        label: "Cool Down",
      },
    ],
  },
  {
    id: "preset-30-30",
    title: "10 × 30s / 30s Fartlek",
    description: "Short high-intensity bursts. 30 seconds fast running followed immediately by 30 seconds easy walking/jogging.",
    category: "TIME_BASED",
    isPreset: true,
    steps: [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 300,
        targetUnit: "SECONDS",
        label: "Warm Up 5 min",
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DURATION",
        targetValue: 30,
        targetUnit: "SECONDS",
        repeatCount: 10,
        groupIndex: 1,
        label: "Surge 30s",
      },
      {
        order: 3,
        stepType: "RECOVERY",
        targetType: "DURATION",
        targetValue: 30,
        targetUnit: "SECONDS",
        repeatCount: 10,
        groupIndex: 1,
        label: "Easy 30s",
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300,
        targetUnit: "SECONDS",
        label: "Cool Down",
      },
    ],
  },
  {
    id: "preset-2min-1min",
    title: "6 × 2min / 1min Intervals",
    description: "Time-based interval session without needing a measured track. 2 minutes fast, 1 minute recovery.",
    category: "TIME_BASED",
    isPreset: true,
    steps: [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 480, // 8 min
        targetUnit: "SECONDS",
        label: "Warm Up",
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DURATION",
        targetValue: 120, // 2 min
        targetUnit: "SECONDS",
        repeatCount: 6,
        groupIndex: 1,
        label: "Hard Effort 2 min",
      },
      {
        order: 3,
        stepType: "RECOVERY",
        targetType: "DURATION",
        targetValue: 60, // 1 min
        targetUnit: "SECONDS",
        repeatCount: 6,
        groupIndex: 1,
        label: "Jog 1 min",
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300,
        targetUnit: "SECONDS",
        label: "Cool Down",
      },
    ],
  },
  {
    id: "preset-5min-tempo",
    title: "3 × 5min Cruise Tempo",
    description: "Lactate threshold block repeats. 5 minutes at comfortably hard tempo pace with 2 minutes jog recovery.",
    category: "TEMPO",
    isPreset: true,
    steps: [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 600,
        targetUnit: "SECONDS",
        label: "Warm Up 10 min",
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DURATION",
        targetValue: 300, // 5 min
        targetUnit: "SECONDS",
        repeatCount: 3,
        groupIndex: 1,
        label: "Tempo 5 min",
      },
      {
        order: 3,
        stepType: "RECOVERY",
        targetType: "DURATION",
        targetValue: 120, // 2 min
        targetUnit: "SECONDS",
        repeatCount: 3,
        groupIndex: 1,
        label: "Float 2 min",
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300,
        targetUnit: "SECONDS",
        label: "Cool Down",
      },
    ],
  },
];
