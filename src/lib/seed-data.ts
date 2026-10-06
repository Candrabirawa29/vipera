import { StoredRunPoint } from "./storage/indexed-db";
import { CalculatedSplit } from "./running/splits";
import { IntervalResultLap } from "./running/interval-engine";

export interface SeedRunData {
  id: string;
  title: string;
  activityType: "RUN" | "INTERVAL" | "TEMPO" | "LONG_RUN" | "EASY_RUN";
  startedAt: string;
  endedAt: string;
  duration: number; // seconds
  distance: number; // meters
  averagePace: number; // sec/km
  fastestPace: number;
  averageSpeed: number; // m/s
  maxSpeed: number;
  elevationGain: number;
  elevationLoss: number;
  calories: number;
  notes: string;
  feeling: "STRONG" | "GOOD" | "TIRED" | "UNSTOPPABLE" | "TERRIBLE";
  energy: number;
  legCondition: number;
  points: StoredRunPoint[];
  splits: CalculatedSplit[];
  intervals?: IntervalResultLap[];
  routeName?: string;
}

// Generate realistic polyline points for a loop around a central coordinate
export function generateRealisticGPSLoop(params: {
  runId: string;
  startLat: number;
  startLng: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  elevationBase?: number;
  elevationAmplitude?: number;
}): {
  points: StoredRunPoint[];
  splits: CalculatedSplit[];
} {
  const {
    runId,
    startLat,
    startLng,
    totalDistanceMeters,
    totalDurationSeconds,
    elevationBase = 15,
    elevationAmplitude = 18,
  } = params;

  const pointsCount = Math.max(80, Math.floor(totalDurationSeconds / 8));
  const points: StoredRunPoint[] = [];

  // Elliptical route path
  const radiusLat = (totalDistanceMeters / 1000) * 0.0035;
  const radiusLng = (totalDistanceMeters / 1000) * 0.005;

  const startTime = Date.now() - 3 * 24 * 3600 * 1000;

  for (let i = 0; i <= pointsCount; i++) {
    const progress = i / pointsCount;
    const angle = progress * 2 * Math.PI;

    // Slight curvature wobble to feel natural
    const wobble = Math.sin(angle * 3) * 0.0004;
    const lat = startLat + Math.sin(angle) * radiusLat + wobble;
    const lng = startLng + (1 - Math.cos(angle)) * radiusLng;

    const elapsedTime = Math.round(progress * totalDurationSeconds);
    const distanceFromStart = Math.round(progress * totalDistanceMeters);

    // Speed variation: faster in mid-run or intervals
    const instantSpeed =
      (totalDistanceMeters / totalDurationSeconds) * (1 + 0.12 * Math.sin(angle * 2));
    const altitude =
      elevationBase + Math.sin(angle * 2) * elevationAmplitude + Math.cos(angle * 5) * 2;

    const pace = instantSpeed > 0 ? 1000 / instantSpeed : 330;

    points.push({
      runId,
      latitude: Math.round(lat * 1000000) / 1000000,
      longitude: Math.round(lng * 1000000) / 1000000,
      altitude: Math.round(altitude * 10) / 10,
      accuracy: 4.5 + (i % 3) * 1.2,
      speed: Math.round(instantSpeed * 100) / 100,
      heading: Math.round(((angle * 180) / Math.PI + 90) % 360),
      timestamp: startTime + elapsedTime * 1000,
      elapsedTime,
      distanceFromStart,
      pace: Math.round(pace),
      isPaused: false,
    });
  }

  // Generate splits
  const splitCount = Math.ceil(totalDistanceMeters / 1000);
  const splits: CalculatedSplit[] = [];

  for (let s = 1; s <= splitCount; s++) {
    const isLast = s === splitCount;
    const dist = isLast ? totalDistanceMeters - (s - 1) * 1000 : 1000;
    const splitFraction = dist / totalDistanceMeters;
    const duration = Math.max(1, Math.round(splitFraction * totalDurationSeconds));
    const pace = (duration * 1000) / dist;

    splits.push({
      splitNumber: s,
      distance: Math.round(dist),
      duration,
      pace: Math.round(pace),
      averageSpeed: Math.round((dist / duration) * 100) / 100,
      elevationChange: Math.round((Math.sin(s) * 6) * 10) / 10,
      splitType: "KILOMETER",
      isPartial: isLast && dist < 950,
    });
  }

  return { points, splits };
}

// Pre-packaged realistic sample runs
export function getRealisticSeedRuns(): SeedRunData[] {
  const baseLat = -6.2088; // Jakarta Gelora Bung Karno / Sudirman sports hub
  const baseLng = 106.8456;

  // Run 1: Waterfront / Senayan 5K Tempo
  const run1Data = generateRealisticGPSLoop({
    runId: "seed-run-5k-tempo",
    startLat: baseLat,
    startLng: baseLng,
    totalDistanceMeters: 5040,
    totalDurationSeconds: 1590, // 26:30 (5:15/km)
    elevationBase: 12,
    elevationAmplitude: 14,
  });

  // Run 2: 6x400m Track Intervals
  const run2Data = generateRealisticGPSLoop({
    runId: "seed-run-intervals",
    startLat: baseLat + 0.005,
    startLng: baseLng + 0.004,
    totalDistanceMeters: 6200,
    totalDurationSeconds: 2040, // 34:00 (5:29/km)
    elevationBase: 10,
    elevationAmplitude: 5,
  });

  const intervalLaps: IntervalResultLap[] = [
    { stepOrder: 1, stepType: "WARMUP", targetLabel: "Warm Up", actualDistance: 1200, actualDuration: 420, averagePace: 350, completed: true },
    { stepOrder: 2, stepType: "RUN", targetLabel: "Fast 400m (Rep 1/6)", actualDistance: 402, actualDuration: 105, averagePace: 261, fastestPace: 252, completed: true },
    { stepOrder: 3, stepType: "RECOVERY", targetLabel: "Recovery 200m (1/6)", actualDistance: 205, actualDuration: 90, averagePace: 439, completed: true },
    { stepOrder: 4, stepType: "RUN", targetLabel: "Fast 400m (Rep 2/6)", actualDistance: 401, actualDuration: 103, averagePace: 257, fastestPace: 248, completed: true },
    { stepOrder: 5, stepType: "RECOVERY", targetLabel: "Recovery 200m (2/6)", actualDistance: 198, actualDuration: 88, averagePace: 444, completed: true },
    { stepOrder: 6, stepType: "RUN", targetLabel: "Fast 400m (Rep 3/6)", actualDistance: 404, actualDuration: 104, averagePace: 257, fastestPace: 250, completed: true },
    { stepOrder: 7, stepType: "RECOVERY", targetLabel: "Recovery 200m (3/6)", actualDistance: 200, actualDuration: 92, averagePace: 460, completed: true },
    { stepOrder: 8, stepType: "RUN", targetLabel: "Fast 400m (Rep 4/6)", actualDistance: 398, actualDuration: 106, averagePace: 266, fastestPace: 255, completed: true },
    { stepOrder: 9, stepType: "RECOVERY", targetLabel: "Recovery 200m (4/6)", actualDistance: 202, actualDuration: 95, averagePace: 470, completed: true },
    { stepOrder: 10, stepType: "RUN", targetLabel: "Fast 400m (Rep 5/6)", actualDistance: 403, actualDuration: 107, averagePace: 265, fastestPace: 252, completed: true },
    { stepOrder: 11, stepType: "RECOVERY", targetLabel: "Recovery 200m (5/6)", actualDistance: 200, actualDuration: 90, averagePace: 450, completed: true },
    { stepOrder: 12, stepType: "RUN", targetLabel: "Fast 400m (Rep 6/6)", actualDistance: 405, actualDuration: 101, averagePace: 249, fastestPace: 240, completed: true },
    { stepOrder: 13, stepType: "COOLDOWN", targetLabel: "Cool Down", actualDistance: 1082, actualDuration: 449, averagePace: 415, completed: true },
  ];

  // Run 3: Sunday 10K Long Run
  const run3Data = generateRealisticGPSLoop({
    runId: "seed-run-10k-long",
    startLat: baseLat - 0.003,
    startLng: baseLng - 0.002,
    totalDistanceMeters: 10250,
    totalDurationSeconds: 3540, // 59:00 (5:45/km)
    elevationBase: 14,
    elevationAmplitude: 28,
  });

  // Run 4: Easy Recovery Run
  const run4Data = generateRealisticGPSLoop({
    runId: "seed-run-easy-recovery",
    startLat: baseLat,
    startLng: baseLng,
    totalDistanceMeters: 4120,
    totalDurationSeconds: 1540, // 25:40 (6:13/km)
    elevationBase: 12,
    elevationAmplitude: 8,
  });

  const now = new Date();

  return [
    {
      id: "seed-run-5k-tempo",
      title: "Sudirman Evening 5K Tempo",
      activityType: "TEMPO",
      startedAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 1 * 24 * 3600 * 1000 + 1590 * 1000).toISOString(),
      duration: 1590,
      distance: 5040,
      averagePace: 315, // 5:15 /km
      fastestPace: 282,
      averageSpeed: 3.17,
      maxSpeed: 4.1,
      elevationGain: 28,
      elevationLoss: 26,
      calories: 360,
      notes: "Crisp evening tempo effort. Felt very smooth through kilometers 3-4, opened up stride on the final straight.",
      feeling: "STRONG",
      energy: 4,
      legCondition: 4,
      points: run1Data.points,
      splits: run1Data.splits,
      routeName: "City Sports Loop",
    },
    {
      id: "seed-run-intervals",
      title: "Track Session — 6 × 400m",
      activityType: "INTERVAL",
      startedAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000 + 2040 * 1000).toISOString(),
      duration: 2040,
      distance: 6200,
      averagePace: 329, // 5:29 /km
      fastestPace: 249, // 4:09 /km on final 400m rep!
      averageSpeed: 3.04,
      maxSpeed: 4.5,
      elevationGain: 12,
      elevationLoss: 11,
      calories: 450,
      notes: "Consistent pacing across all 6 reps. Final repetition was the fastest at 4:09/km pace.",
      feeling: "UNSTOPPABLE",
      energy: 5,
      legCondition: 4,
      points: run2Data.points,
      splits: run2Data.splits,
      intervals: intervalLaps,
    },
    {
      id: "seed-run-10k-long",
      title: "Sunday Aerobic Long Run",
      activityType: "LONG_RUN",
      startedAt: new Date(now.getTime() - 6 * 24 * 3600 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 6 * 24 * 3600 * 1000 + 3540 * 1000).toISOString(),
      duration: 3540,
      distance: 10250,
      averagePace: 345, // 5:45 /km
      fastestPace: 318,
      averageSpeed: 2.9,
      maxSpeed: 3.8,
      elevationGain: 68,
      elevationLoss: 65,
      calories: 780,
      notes: "Steady Zone 2 aerobic base mileage. Focused on light foot turnover and controlled breathing.",
      feeling: "GOOD",
      energy: 4,
      legCondition: 3,
      points: run3Data.points,
      splits: run3Data.splits,
    },
    {
      id: "seed-run-easy-recovery",
      title: "Morning Shakeout Jog",
      activityType: "EASY_RUN",
      startedAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString(),
      endedAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000 + 1540 * 1000).toISOString(),
      duration: 1540,
      distance: 4120,
      averagePace: 373, // 6:13 /km
      fastestPace: 350,
      averageSpeed: 2.67,
      maxSpeed: 3.2,
      elevationGain: 15,
      elevationLoss: 14,
      calories: 275,
      notes: "Gentle recovery pace following the weekend long run. Flushed the legs out nicely.",
      feeling: "GOOD",
      energy: 3,
      legCondition: 4,
      points: run4Data.points,
      splits: run4Data.splits,
      routeName: "City Sports Loop",
    },
  ];
}
