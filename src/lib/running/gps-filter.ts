import { calculateHaversineDistance } from "./distance";

export interface RawGPSPoint {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy: number;
  speed?: number | null;
  heading?: number | null;
  timestamp: number; // millisecond epoch
}

export interface FilterOptions {
  maxAccuracyMeters?: number; // Reject if accuracy worse than this (e.g. 35m)
  maxRunningSpeedMps?: number; // Max plausible speed (e.g. 12 m/s ~ 43.2 km/h, Bolt runs 12.2 m/s)
  minTimeDeltaMs?: number; // Ignore if < 200ms (duplicate polling)
  minDistanceMeters?: number; // Ignore sub-meter jitter when standing still
}

const DEFAULT_OPTIONS: Required<FilterOptions> = {
  maxAccuracyMeters: 30,
  maxRunningSpeedMps: 11.5, // 41.4 km/h
  minTimeDeltaMs: 400,
  minDistanceMeters: 1.2,
};

export type AnomalyReason =
  | "INVALID_COORDINATES"
  | "ACCURACY_TOO_LOW"
  | "TIMESTAMP_REGRESSION"
  | "TIME_DELTA_TOO_SMALL"
  | "TELEPORTATION_UNREALISTIC_SPEED"
  | "STATIONARY_JITTER";

export interface FilterResult {
  isValid: boolean;
  reason?: AnomalyReason;
  calculatedDistanceDelta: number; // meters from previous point
  calculatedSpeedMps?: number;
}

/**
 * Evaluates a new incoming GPS point against the last accepted point.
 * Returns whether the point should be added to the path, along with diagnostic reason.
 */
export function evaluateGPSPoint(
  newPoint: RawGPSPoint,
  lastValidPoint: RawGPSPoint | null,
  options: FilterOptions = {}
): FilterResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. Basic coordinate sanity
  if (
    isNaN(newPoint.latitude) ||
    isNaN(newPoint.longitude) ||
    newPoint.latitude < -90 ||
    newPoint.latitude > 90 ||
    newPoint.longitude < -180 ||
    newPoint.longitude > 180
  ) {
    return { isValid: false, reason: "INVALID_COORDINATES", calculatedDistanceDelta: 0 };
  }

  // 2. Accuracy check (reject blurry fixes)
  if (newPoint.accuracy > opts.maxAccuracyMeters) {
    return { isValid: false, reason: "ACCURACY_TOO_LOW", calculatedDistanceDelta: 0 };
  }

  // First point check
  if (!lastValidPoint) {
    return { isValid: true, calculatedDistanceDelta: 0, calculatedSpeedMps: 0 };
  }

  // 3. Timestamp regression check
  const timeDeltaMs = newPoint.timestamp - lastValidPoint.timestamp;
  if (timeDeltaMs <= 0) {
    return { isValid: false, reason: "TIMESTAMP_REGRESSION", calculatedDistanceDelta: 0 };
  }

  if (timeDeltaMs < opts.minTimeDeltaMs) {
    return { isValid: false, reason: "TIME_DELTA_TOO_SMALL", calculatedDistanceDelta: 0 };
  }

  // 4. Distance and speed bounds
  const distanceDelta = calculateHaversineDistance(
    lastValidPoint.latitude,
    lastValidPoint.longitude,
    newPoint.latitude,
    newPoint.longitude
  );

  const timeDeltaSec = timeDeltaMs / 1000;
  const speedMps = distanceDelta / timeDeltaSec;

  // 5. Stationary jitter filter (if runner is stationary, GPS might wander 1-2m in circles)
  if (distanceDelta < opts.minDistanceMeters && speedMps < 0.4) {
    return {
      isValid: false,
      reason: "STATIONARY_JITTER",
      calculatedDistanceDelta: 0,
      calculatedSpeedMps: 0,
    };
  }

  // 6. Impossible teleportation jump / unrealistic speed
  if (speedMps > opts.maxRunningSpeedMps) {
    return {
      isValid: false,
      reason: "TELEPORTATION_UNREALISTIC_SPEED",
      calculatedDistanceDelta: 0,
      calculatedSpeedMps: speedMps,
    };
  }

  return {
    isValid: true,
    calculatedDistanceDelta: distanceDelta,
    calculatedSpeedMps: speedMps,
  };
}

/**
 * Douglas-Peucker route simplification for clean map rendering.
 */
export function simplifyRoute<T extends { latitude: number; longitude: number }>(
  points: T[],
  toleranceMeters = 3.0
): T[] {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance from line between first and last
  let maxDistance = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], first, last);
    if (d > maxDistance) {
      maxDistance = d;
      index = i;
    }
  }

  if (maxDistance > toleranceMeters) {
    const left = simplifyRoute(points.slice(0, index + 1), toleranceMeters);
    const right = simplifyRoute(points.slice(index), toleranceMeters);
    return left.slice(0, -1).concat(right);
  } else {
    return [first, last];
  }
}

function perpendicularDistance(
  p: { latitude: number; longitude: number },
  lineStart: { latitude: number; longitude: number },
  lineEnd: { latitude: number; longitude: number }
): number {
  const lineDist = calculateHaversineDistance(
    lineStart.latitude,
    lineStart.longitude,
    lineEnd.latitude,
    lineEnd.longitude
  );
  if (lineDist === 0) {
    return calculateHaversineDistance(p.latitude, p.longitude, lineStart.latitude, lineStart.longitude);
  }

  // Project point to segment approximation
  const d1 = calculateHaversineDistance(p.latitude, p.longitude, lineStart.latitude, lineStart.longitude);
  const d2 = calculateHaversineDistance(p.latitude, p.longitude, lineEnd.latitude, lineEnd.longitude);

  // Area of triangle using Heron's formula
  const s = (lineDist + d1 + d2) / 2;
  const areaSq = s * (s - lineDist) * (s - d1) * (s - d2);
  if (areaSq <= 0) return 0;
  return (2 * Math.sqrt(areaSq)) / lineDist;
}
