import { calculatePaceSecPerKm } from "./pace";

export interface ProcessedPoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  distanceFromStart: number; // cumulative meters
  elapsedTime: number; // cumulative seconds active
  timestamp: number;
}

export interface CalculatedSplit {
  splitNumber: number;
  distance: number; // meters in this split
  duration: number; // seconds in this split
  pace: number; // seconds per km
  averageSpeed: number; // m/s
  elevationChange: number; // meters net
  splitType: "KILOMETER" | "MILE";
  isPartial: boolean;
}

/**
 * Calculates kilometer or mile splits accurately by linear interpolation
 * across boundary crossing GPS points.
 */
export function calculateSplits(
  points: ProcessedPoint[],
  unit: "METRIC" | "IMPERIAL" = "METRIC"
): CalculatedSplit[] {
  if (points.length < 2) return [];

  const splitTargetMeters = unit === "IMPERIAL" ? 1609.344 : 1000;
  const splits: CalculatedSplit[] = [];

  let currentSplitIndex = 1;
  let splitStartDistance = 0;
  let splitStartTime = points[0].elapsedTime;
  let splitStartAltitude = points[0].altitude ?? 0;

  for (let i = 1; i < points.length; i++) {
    const pPrev = points[i - 1];
    const pCurr = points[i];

    let targetCrossing = currentSplitIndex * splitTargetMeters;

    // Check if we crossed a split boundary between pPrev and pCurr
    while (pPrev.distanceFromStart < targetCrossing && pCurr.distanceFromStart >= targetCrossing) {
      // Linear interpolation fraction
      const segDistance = pCurr.distanceFromStart - pPrev.distanceFromStart;
      const fraction =
        segDistance > 0 ? (targetCrossing - pPrev.distanceFromStart) / segDistance : 0;

      const crossedTime =
        pPrev.elapsedTime + fraction * (pCurr.elapsedTime - pPrev.elapsedTime);

      const crossedAlt =
        (pPrev.altitude ?? 0) +
        fraction * ((pCurr.altitude ?? 0) - (pPrev.altitude ?? 0));

      const splitDuration = Math.max(1, Math.round(crossedTime - splitStartTime));
      const splitDistance = splitTargetMeters;
      const pace = calculatePaceSecPerKm(splitDistance, splitDuration);
      const speed = splitDistance / splitDuration;
      const elevChange = Math.round((crossedAlt - splitStartAltitude) * 10) / 10;

      splits.push({
        splitNumber: currentSplitIndex,
        distance: splitDistance,
        duration: splitDuration,
        pace,
        averageSpeed: Math.round(speed * 100) / 100,
        elevationChange: elevChange,
        splitType: unit === "IMPERIAL" ? "MILE" : "KILOMETER",
        isPartial: false,
      });

      // Advance to next split
      splitStartDistance = targetCrossing;
      splitStartTime = crossedTime;
      splitStartAltitude = crossedAlt;
      currentSplitIndex++;
      targetCrossing = currentSplitIndex * splitTargetMeters;
    }
  }

  // Handle final remainder/partial split if >= 100m
  const lastPoint = points[points.length - 1];
  const remainingDist = lastPoint.distanceFromStart - splitStartDistance;
  const remainingTime = Math.round(lastPoint.elapsedTime - splitStartTime);

  if (remainingDist >= 100 && remainingTime > 0) {
    const pace = calculatePaceSecPerKm(remainingDist, remainingTime);
    const speed = remainingDist / remainingTime;
    const elevChange =
      Math.round(((lastPoint.altitude ?? 0) - splitStartAltitude) * 10) / 10;

    splits.push({
      splitNumber: currentSplitIndex,
      distance: Math.round(remainingDist),
      duration: remainingTime,
      pace,
      averageSpeed: Math.round(speed * 100) / 100,
      elevationChange: elevChange,
      splitType: unit === "IMPERIAL" ? "MILE" : "KILOMETER",
      isPartial: true,
    });
  }

  return splits;
}
