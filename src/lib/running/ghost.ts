export interface GhostRunSnapshot {
  runId: string;
  title: string;
  totalDistance: number;
  totalDuration: number;
  averagePace: number;
  points: Array<{
    elapsedTime: number; // active seconds
    distanceFromStart: number; // meters
  }>;
}

export interface GhostComparisonResult {
  ghostDistanceMeters: number;
  runnerDistanceMeters: number;
  distanceDeltaMeters: number; // positive = runner ahead, negative = runner behind
  isAhead: boolean;
  isTied: boolean;
  deltaText: string; // e.g. "Ahead by 80m" or "Behind by 120m"
  estimatedTimeDeltaSeconds: number; // seconds ahead/behind based on current pace
  ghostCompleted: boolean;
}

/**
 * Calculates ghost position at runner's current elapsed active time via linear interpolation.
 */
export function calculateGhostComparison(
  ghost: GhostRunSnapshot,
  runnerElapsedTime: number,
  runnerDistance: number,
  runnerCurrentPaceSecPerKm: number
): GhostComparisonResult {
  const points = ghost.points;
  if (!points || points.length === 0) {
    return {
      ghostDistanceMeters: 0,
      runnerDistanceMeters: runnerDistance,
      distanceDeltaMeters: 0,
      isAhead: true,
      isTied: true,
      deltaText: "On pace with ghost",
      estimatedTimeDeltaSeconds: 0,
      ghostCompleted: false,
    };
  }

  const lastGhostPoint = points[points.length - 1];
  let ghostDistance = 0;
  let ghostCompleted = false;

  if (runnerElapsedTime >= lastGhostPoint.elapsedTime) {
    ghostDistance = lastGhostPoint.distanceFromStart;
    ghostCompleted = true;
  } else if (runnerElapsedTime <= points[0].elapsedTime) {
    ghostDistance = points[0].distanceFromStart;
  } else {
    // Binary search or linear scan for interval
    let low = 0;
    let high = points.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid].elapsedTime <= runnerElapsedTime) {
        if (mid === points.length - 1 || points[mid + 1].elapsedTime > runnerElapsedTime) {
          // Found bracket
          const p1 = points[mid];
          const p2 = points[mid + 1];
          const timeSpan = p2.elapsedTime - p1.elapsedTime;
          const fraction = timeSpan > 0 ? (runnerElapsedTime - p1.elapsedTime) / timeSpan : 0;
          ghostDistance = p1.distanceFromStart + fraction * (p2.distanceFromStart - p1.distanceFromStart);
          break;
        }
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
  }

  const distanceDelta = runnerDistance - ghostDistance;
  const isAhead = distanceDelta > 3; // 3m deadband
  const isBehind = distanceDelta < -3;
  const isTied = !isAhead && !isBehind;

  let deltaText = "Tied with Ghost";
  if (isAhead) {
    deltaText = `Ahead by ${Math.round(distanceDelta)}m`;
  } else if (isBehind) {
    deltaText = `Behind by ${Math.round(Math.abs(distanceDelta))}m`;
  }

  // Estimated time delta (seconds)
  let timeDeltaSeconds = 0;
  if (runnerCurrentPaceSecPerKm > 0) {
    timeDeltaSeconds = Math.round((Math.abs(distanceDelta) / 1000) * runnerCurrentPaceSecPerKm);
  }

  return {
    ghostDistanceMeters: Math.round(ghostDistance),
    runnerDistanceMeters: Math.round(runnerDistance),
    distanceDeltaMeters: Math.round(distanceDelta),
    isAhead,
    isTied,
    deltaText,
    estimatedTimeDeltaSeconds: isBehind ? -timeDeltaSeconds : timeDeltaSeconds,
    ghostCompleted,
  };
}
