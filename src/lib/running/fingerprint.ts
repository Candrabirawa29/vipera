export interface RunningFingerprint {
  endurance: number; // 0 - 100
  speed: number; // 0 - 100
  consistency: number; // 0 - 100
  pacing: number; // 0 - 100
  hillAbility: number; // 0 - 100
  overallScore: number;
  archetype: string;
  summary: string;
}

export interface HistoricalRunSummary {
  distance: number; // meters
  duration: number; // seconds
  averagePace: number; // sec/km
  fastestPace: number; // sec/km
  elevationGain: number; // meters
  startedAt: string | Date;
}

/**
 * Calculates the multi-factor Running Fingerprint (0-100) from historical runs.
 */
export function calculateRunningFingerprint(runs: HistoricalRunSummary[]): RunningFingerprint {
  if (runs.length === 0) {
    return {
      endurance: 40,
      speed: 40,
      consistency: 40,
      pacing: 40,
      hillAbility: 40,
      overallScore: 40,
      archetype: "Emerging Runner",
      summary: "Start recording your runs to build your personal running fingerprint.",
    };
  }

  // 1. Endurance (based on longest run and average distance)
  const maxDistanceKm = Math.max(...runs.map((r) => r.distance)) / 1000;
  const avgDistanceKm = runs.reduce((acc, r) => acc + r.distance, 0) / runs.length / 1000;
  // Score: 5km = ~55, 10km = ~75, 15km = ~88, 21km+ = ~95
  let endurance = Math.min(98, Math.round(maxDistanceKm * 4.2 + avgDistanceKm * 3.5 + 25));
  endurance = Math.max(30, endurance);

  // 2. Speed (based on fastest pace recorded and average pace)
  const validPaces = runs.map((r) => r.averagePace).filter((p) => p > 150 && p < 1200);
  const bestPace = validPaces.length > 0 ? Math.min(...validPaces) : 360;
  // e.g. 4:00/km (240s) -> 92, 5:00/km (300s) -> 78, 6:00/km (360s) -> 64, 7:00/km (420s) -> 50
  let speed = Math.round(110 - (bestPace - 180) * 0.22);
  speed = Math.max(25, Math.min(98, speed));

  // 3. Consistency (frequency across the last 28 days)
  const now = new Date().getTime();
  const twentyEightDaysAgo = now - 28 * 24 * 3600 * 1000;
  const recentRuns = runs.filter((r) => new Date(r.startedAt).getTime() >= twentyEightDaysAgo);
  const runsPerWeek = (recentRuns.length / 4);
  // 1 run/wk = 45, 2 runs/wk = 65, 3 runs/wk = 82, 4+ runs/wk = 94
  let consistency = Math.round(30 + runsPerWeek * 16);
  consistency = Math.max(25, Math.min(98, consistency));

  // 4. Pacing (variance between fastest and average pace across runs)
  const paceVariances = runs
    .filter((r) => r.averagePace > 0 && r.fastestPace > 0)
    .map((r) => Math.max(0, r.averagePace - r.fastestPace));
  const avgPaceVariance =
    paceVariances.length > 0
      ? paceVariances.reduce((a, b) => a + b, 0) / paceVariances.length
      : 50;
  // Lower variance = higher pacing control
  let pacing = Math.round(92 - avgPaceVariance * 0.45);
  pacing = Math.max(35, Math.min(95, pacing));

  // 5. Hill Ability (elevation gain per 10km)
  const totalGain = runs.reduce((acc, r) => acc + r.elevationGain, 0);
  const totalKm = runs.reduce((acc, r) => acc + r.distance, 0) / 1000;
  const gainPer10k = totalKm > 0 ? (totalGain / totalKm) * 10 : 0;
  // 20m/10k = 40, 80m/10k = 65, 150m/10k = 85, 250m+/10k = 95
  let hillAbility = Math.round(35 + gainPer10k * 0.24);
  hillAbility = Math.max(25, Math.min(95, hillAbility));

  const overallScore = Math.round(
    endurance * 0.25 + speed * 0.25 + consistency * 0.25 + pacing * 0.15 + hillAbility * 0.1
  );

  // Determine Archetype
  let archetype = "Balanced Athlete";
  if (endurance >= 75 && speed < 65) archetype = "Diesel Engine";
  else if (speed >= 75 && endurance < 65) archetype = "Speed Merchant";
  else if (consistency >= 80) archetype = "Metronome";
  else if (hillAbility >= 75) archetype = "Mountain Goat";
  else if (pacing >= 80) archetype = "Tactician";

  let summary = `Strong all-round profile with highlight in ${
    endurance >= speed ? "aerobic endurance" : "pace velocity"
  }.`;
  if (consistency >= 80) {
    summary += " Outstanding weekly training consistency.";
  }

  return {
    endurance,
    speed,
    consistency,
    pacing,
    hillAbility,
    overallScore,
    archetype,
    summary,
  };
}
