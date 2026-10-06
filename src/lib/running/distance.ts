export interface LatLng {
  latitude: number;
  longitude: number;
  altitude?: number | null;
}

const EARTH_RADIUS_METERS = 6371000;

/**
 * Calculates Haversine great-circle distance between two GPS coordinates in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculates total cumulative distance along a list of coordinates in meters.
 */
export function calculateTotalDistance(points: LatLng[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += calculateHaversineDistance(
      points[i - 1].latitude,
      points[i - 1].longitude,
      points[i].latitude,
      points[i].longitude
    );
  }
  return total;
}

/**
 * Calculates elevation gain and loss with threshold deadband (default 2 meters)
 * to filter out barometric and GPS altitude jitter.
 */
export function calculateElevationGainLoss(
  altitudes: (number | null | undefined)[],
  thresholdMeters = 2.0
): { gain: number; loss: number } {
  let gain = 0;
  let loss = 0;
  let lastValid: number | null = null;

  for (const alt of altitudes) {
    if (alt === null || alt === undefined || isNaN(alt)) continue;
    if (lastValid === null) {
      lastValid = alt;
      continue;
    }

    const diff = alt - lastValid;
    if (Math.abs(diff) >= thresholdMeters) {
      if (diff > 0) gain += diff;
      else loss += Math.abs(diff);
      lastValid = alt;
    }
  }

  return {
    gain: Math.round(gain * 10) / 10,
    loss: Math.round(loss * 10) / 10,
  };
}

/**
 * Formats meters into human readable distance string (e.g. "5.42 km" or "850 m")
 */
export function formatDistance(meters: number, unit: "METRIC" | "IMPERIAL" = "METRIC"): string {
  if (unit === "IMPERIAL") {
    const miles = meters / 1609.344;
    return `${miles.toFixed(2)} mi`;
  }
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km.toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}
