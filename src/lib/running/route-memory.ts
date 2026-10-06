import { calculateHaversineDistance } from "./distance";
import { formatDuration, formatPace } from "./pace";

export interface RouteBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface RouteMatchCandidate {
  id: string;
  name: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  centerLat: number;
  centerLng: number;
  boundingBox: RouteBoundingBox;
  averageDistance: number;
  runCount: number;
  bestTime?: number | null;
  averageTime?: number | null;
}

export interface RouteComparisonResult {
  routeId: string;
  routeName: string;
  isRecognizedRoute: boolean;
  totalRunsOnRoute: number;
  bestTimeSeconds?: number | null;
  averageTimeSeconds?: number | null;
  timeVsAverageSeconds: number; // negative = faster than avg, positive = slower
  isFasterThanAverage: boolean;
  summaryMessage: string;
}

/**
 * Calculates centroid and bounding box from coordinates.
 */
export function calculateRouteGeometry(
  points: Array<{ latitude: number; longitude: number }>
): {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  centerLat: number;
  centerLng: number;
  boundingBox: RouteBoundingBox;
} {
  if (points.length === 0) {
    return {
      startLat: 0,
      startLng: 0,
      endLat: 0,
      endLng: 0,
      centerLat: 0,
      centerLng: 0,
      boundingBox: { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 },
    };
  }

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;
  let sumLat = 0;
  let sumLng = 0;

  for (const p of points) {
    if (p.latitude < minLat) minLat = p.latitude;
    if (p.latitude > maxLat) maxLat = p.latitude;
    if (p.longitude < minLng) minLng = p.longitude;
    if (p.longitude > maxLng) maxLng = p.longitude;
    sumLat += p.latitude;
    sumLng += p.longitude;
  }

  return {
    startLat: points[0].latitude,
    startLng: points[0].longitude,
    endLat: points[points.length - 1].latitude,
    endLng: points[points.length - 1].longitude,
    centerLat: sumLat / points.length,
    centerLng: sumLng / points.length,
    boundingBox: { minLat, maxLat, minLng, maxLng },
  };
}

/**
 * Finds the closest matching historical route based on start/end proximity,
 * centroid distance, and distance similarity.
 */
export function matchRoute(
  runPoints: Array<{ latitude: number; longitude: number }>,
  runDistanceMeters: number,
  existingRoutes: RouteMatchCandidate[]
): RouteMatchCandidate | null {
  if (runPoints.length < 5 || existingRoutes.length === 0) return null;

  const currentGeo = calculateRouteGeometry(runPoints);

  let bestMatch: RouteMatchCandidate | null = null;
  let lowestScore = Infinity;

  for (const candidate of existingRoutes) {
    // 1. Distance difference check (within 20%)
    const distDiffRatio = Math.abs(runDistanceMeters - candidate.averageDistance) / candidate.averageDistance;
    if (distDiffRatio > 0.22) continue;

    // 2. Start proximity (within 200m)
    const startDist = calculateHaversineDistance(
      currentGeo.startLat,
      currentGeo.startLng,
      candidate.startLat,
      candidate.startLng
    );
    if (startDist > 250) continue;

    // 3. End proximity (within 250m)
    const endDist = calculateHaversineDistance(
      currentGeo.endLat,
      currentGeo.endLng,
      candidate.endLat,
      candidate.endLng
    );
    if (endDist > 300) continue;

    // 4. Centroid proximity (within 350m)
    const centerDist = calculateHaversineDistance(
      currentGeo.centerLat,
      currentGeo.centerLng,
      candidate.centerLat,
      candidate.centerLng
    );
    if (centerDist > 400) continue;

    // Composite similarity score
    const score = startDist * 0.35 + endDist * 0.35 + centerDist * 0.3;
    if (score < lowestScore) {
      lowestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

/**
 * Generates comparison metrics against matched historical route.
 */
export function compareRoutePerformance(
  matchedRoute: RouteMatchCandidate,
  currentDurationSeconds: number,
  currentPaceSecPerKm: number
): RouteComparisonResult {
  const avgTime = matchedRoute.averageTime || currentDurationSeconds;
  const timeDelta = currentDurationSeconds - avgTime;
  const isFaster = timeDelta < 0;
  const deltaAbs = Math.abs(timeDelta);

  let summaryMessage = "";
  if (isFaster && deltaAbs >= 10) {
    summaryMessage = `You were ${formatDuration(deltaAbs)} faster than your average on this route!`;
  } else if (!isFaster && deltaAbs >= 10) {
    summaryMessage = `You were ${formatDuration(deltaAbs)} off your route average.`;
  } else {
    summaryMessage = `Right on your average route pace (${formatPace(currentPaceSecPerKm)}).`;
  }

  return {
    routeId: matchedRoute.id,
    routeName: matchedRoute.name,
    isRecognizedRoute: true,
    totalRunsOnRoute: matchedRoute.runCount + 1,
    bestTimeSeconds: matchedRoute.bestTime,
    averageTimeSeconds: avgTime,
    timeVsAverageSeconds: timeDelta,
    isFasterThanAverage: isFaster,
    summaryMessage,
  };
}
