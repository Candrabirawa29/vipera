import { ProcessedPoint } from "./splits";

export interface RecordTarget {
  category:
    | "FASTEST_1K"
    | "FASTEST_3K"
    | "FASTEST_5K"
    | "FASTEST_10K"
    | "LONGEST_DISTANCE"
    | "LONGEST_DURATION"
    | "FASTEST_AVERAGE_PACE";
  distanceMeters: number;
  label: string;
}

export const STANDARD_TARGETS: RecordTarget[] = [
  { category: "FASTEST_1K", distanceMeters: 1000, label: "Fastest 1K" },
  { category: "FASTEST_3K", distanceMeters: 3000, label: "Fastest 3K" },
  { category: "FASTEST_5K", distanceMeters: 5000, label: "Fastest 5K" },
  { category: "FASTEST_10K", distanceMeters: 10000, label: "Fastest 10K" },
];

export interface BestEffortResult {
  category: string;
  label: string;
  distanceMeters: number;
  bestTimeSeconds: number; // minimum time in seconds
  averagePaceSecPerKm: number;
  windowStartIndex: number;
  windowEndIndex: number;
}

export interface PRComparison {
  category: string;
  label: string;
  isNewRecord: boolean;
  value: number; // seconds or meters
  previousRecordValue?: number | null;
  improvement?: number | null; // delta
  formattedValue: string;
  formattedPrevious?: string | null;
}

/**
 * Finds the fastest continuous window of target distance in the GPS track using sliding two pointers.
 */
export function findBestEffortSegment(
  points: ProcessedPoint[],
  targetDistanceMeters: number
): BestEffortResult | null {
  if (points.length < 2) return null;

  const totalDist = points[points.length - 1].distanceFromStart - points[0].distanceFromStart;
  if (totalDist < targetDistanceMeters) {
    return null; // Run was shorter than target
  }

  let minTime = Infinity;
  let bestStartIdx = 0;
  let bestEndIdx = 0;

  let right = 0;

  for (let left = 0; left < points.length; left++) {
    while (
      right < points.length &&
      points[right].distanceFromStart - points[left].distanceFromStart < targetDistanceMeters
    ) {
      right++;
    }

    if (right >= points.length) break;

    // Window between left and right covers >= targetDistanceMeters
    const pLeft = points[left];
    const pPrevRight = points[right - 1];
    const pRight = points[right];

    // Distance covered before right
    const distBeforeRight = pPrevRight.distanceFromStart - pLeft.distanceFromStart;
    const stepDist = pRight.distanceFromStart - pPrevRight.distanceFromStart;

    // Interpolate exact crossing point
    const remainingToTarget = targetDistanceMeters - distBeforeRight;
    const fraction = stepDist > 0 ? remainingToTarget / stepDist : 0;

    const interpolatedEndTime =
      pPrevRight.elapsedTime + fraction * (pRight.elapsedTime - pPrevRight.elapsedTime);

    const windowDuration = interpolatedEndTime - pLeft.elapsedTime;

    if (windowDuration > 0 && windowDuration < minTime) {
      minTime = windowDuration;
      bestStartIdx = left;
      bestEndIdx = right;
    }
  }

  if (!isFinite(minTime)) return null;

  const pace = (minTime * 1000) / targetDistanceMeters;

  return {
    category: "",
    label: "",
    distanceMeters: targetDistanceMeters,
    bestTimeSeconds: Math.round(minTime),
    averagePaceSecPerKm: Math.round(pace),
    windowStartIndex: bestStartIdx,
    windowEndIndex: bestEndIdx,
  };
}

/**
 * Evaluates all potential personal records for a completed run against historical PRs.
 */
export function evaluatePersonalRecords(
  points: ProcessedPoint[],
  totalDistance: number,
  totalDuration: number,
  averagePace: number,
  existingPRs: Array<{ category: string; value: number }>
): PRComparison[] {
  const prMap = new Map(existingPRs.map((pr) => [pr.category, pr.value]));
  const results: PRComparison[] = [];

  // 1. Standard distance best efforts (1K, 3K, 5K, 10K)
  for (const target of STANDARD_TARGETS) {
    const bestEffort = findBestEffortSegment(points, target.distanceMeters);
    if (bestEffort) {
      const prev = prMap.get(target.category);
      const isNewRecord = prev === undefined || bestEffort.bestTimeSeconds < prev;
      const improvement = prev !== undefined && isNewRecord ? prev - bestEffort.bestTimeSeconds : null;

      results.push({
        category: target.category,
        label: target.label,
        isNewRecord,
        value: bestEffort.bestTimeSeconds,
        previousRecordValue: prev,
        improvement,
        formattedValue: formatTime(bestEffort.bestTimeSeconds),
        formattedPrevious: prev ? formatTime(prev) : null,
      });
    }
  }

  // 2. Longest Distance
  const prevLongest = prMap.get("LONGEST_DISTANCE");
  const isNewLongest = prevLongest === undefined || totalDistance > prevLongest;
  results.push({
    category: "LONGEST_DISTANCE",
    label: "Longest Distance",
    isNewRecord: isNewLongest && totalDistance >= 1000,
    value: Math.round(totalDistance),
    previousRecordValue: prevLongest,
    improvement: prevLongest ? totalDistance - prevLongest : null,
    formattedValue: `${(totalDistance / 1000).toFixed(2)} km`,
    formattedPrevious: prevLongest ? `${(prevLongest / 1000).toFixed(2)} km` : null,
  });

  // 3. Fastest Average Pace (for runs >= 3 km)
  if (totalDistance >= 3000 && averagePace > 0) {
    const prevFastestPace = prMap.get("FASTEST_AVERAGE_PACE");
    const isNewFastestPace = prevFastestPace === undefined || averagePace < prevFastestPace;
    results.push({
      category: "FASTEST_AVERAGE_PACE",
      label: "Fastest Avg Pace (3K+)",
      isNewRecord: isNewFastestPace,
      value: Math.round(averagePace),
      previousRecordValue: prevFastestPace,
      improvement: prevFastestPace ? prevFastestPace - averagePace : null,
      formattedValue: formatPaceDisplay(averagePace),
      formattedPrevious: prevFastestPace ? formatPaceDisplay(prevFastestPace) : null,
    });
  }

  return results;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatPaceDisplay(secPerKm: number): string {
  const mins = Math.floor(secPerKm / 60);
  const secs = Math.floor(secPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, "0")} /km`;
}
