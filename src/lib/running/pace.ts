/**
 * Pace and speed calculation and formatting utilities.
 */

/**
 * Calculates pace in seconds per kilometer (sec/km).
 * Returns null or 0 if distance is negligible.
 */
export function calculatePaceSecPerKm(
  distanceMeters: number,
  durationSeconds: number
): number {
  if (distanceMeters < 5 || durationSeconds <= 0) return 0;
  // sec / km = durationSeconds / (distanceMeters / 1000)
  const pace = (durationSeconds * 1000) / distanceMeters;
  // Limit unrealistic paces (e.g. slower than 30:00/km or faster than 2:00/km)
  if (pace > 1800) return 1800;
  if (pace < 120) return 120;
  return pace;
}

/**
 * Converts pace in seconds per kilometer into seconds per mile.
 */
export function paceSecPerKmToSecPerMile(paceSecPerKm: number): number {
  return paceSecPerKm * 1.609344;
}

/**
 * Formats pace in seconds per kilometer (e.g., 324s -> "5:24 /km").
 */
export function formatPace(
  paceSecPerKm: number,
  unit: "METRIC" | "IMPERIAL" = "METRIC",
  showUnitSuffix = true
): string {
  if (!paceSecPerKm || paceSecPerKm <= 0 || !isFinite(paceSecPerKm)) {
    return `--:--${showUnitSuffix ? (unit === "IMPERIAL" ? " /mi" : " /km") : ""}`;
  }

  const effectivePace =
    unit === "IMPERIAL" ? paceSecPerKmToSecPerMile(paceSecPerKm) : paceSecPerKm;

  const minutes = Math.floor(effectivePace / 60);
  const seconds = Math.floor(effectivePace % 60);
  const formatted = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  if (!showUnitSuffix) return formatted;
  return `${formatted} ${unit === "IMPERIAL" ? "/mi" : "/km"}`;
}

/**
 * Formats duration in seconds into "mm:ss" or "hh:mm:ss".
 */
export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0 || !isFinite(totalSeconds)) {
    return "00:00";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Converts speed in meters per second to km/h.
 */
export function speedMpsToKmh(mps: number): number {
  return mps * 3.6;
}

/**
 * Calculates smoothed rolling pace from recent GPS points.
 */
export function calculateSmoothedPace(
  recentPoints: Array<{
    distanceFromStart: number;
    elapsedTime: number;
  }>
): number {
  if (recentPoints.length < 2) return 0;

  const first = recentPoints[0];
  const last = recentPoints[recentPoints.length - 1];

  const deltaDist = last.distanceFromStart - first.distanceFromStart;
  const deltaTime = last.elapsedTime - first.elapsedTime;

  if (deltaDist < 10 || deltaTime <= 1) return 0;
  return calculatePaceSecPerKm(deltaDist, deltaTime);
}
