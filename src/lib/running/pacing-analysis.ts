import { CalculatedSplit } from "./splits";
import { formatPace, formatDuration } from "./pace";

export interface PacingInsight {
  splitType: "NEGATIVE_SPLIT" | "POSITIVE_SPLIT" | "EVEN_PACING";
  headline: string;
  description: string;
  fastestSplitNumber: number;
  fastestSplitPace: number;
  slowestSplitNumber: number;
  slowestSplitPace: number;
  paceVarianceSeconds: number; // difference between fastest and slowest
  consistencyScore: number; // 0 to 100 (100 = perfectly even pacing)
  possibleFatigueKm?: number | null;
}

export interface BadRunDiagnostic {
  isStruggleRun: boolean;
  factors: Array<{
    title: string;
    description: string;
    severity: "HIGH" | "MEDIUM" | "LOW";
  }>;
}

/**
 * Analyzes splits to evaluate negative/positive pacing, consistency, and dropoff.
 */
export function analyzeRunPacing(splits: CalculatedSplit[]): PacingInsight | null {
  const fullSplits = splits.filter((s) => !s.isPartial && s.pace > 0);
  if (fullSplits.length < 2) return null;

  let fastest = fullSplits[0];
  let slowest = fullSplits[0];
  let totalPace = 0;

  for (const s of fullSplits) {
    totalPace += s.pace;
    if (s.pace < fastest.pace) fastest = s;
    if (s.pace > slowest.pace) slowest = s;
  }

  const avgPace = totalPace / fullSplits.length;
  const paceVariance = slowest.pace - fastest.pace;

  // Split into first half vs second half
  const mid = Math.floor(fullSplits.length / 2);
  const firstHalf = fullSplits.slice(0, mid);
  const secondHalf = fullSplits.slice(mid);

  const avgFirstHalf = firstHalf.reduce((sum, s) => sum + s.pace, 0) / firstHalf.length;
  const avgSecondHalf = secondHalf.reduce((sum, s) => sum + s.pace, 0) / secondHalf.length;

  const halfDiff = avgSecondHalf - avgFirstHalf; // positive means second half was slower (sec/km higher)

  let splitType: "NEGATIVE_SPLIT" | "POSITIVE_SPLIT" | "EVEN_PACING" = "EVEN_PACING";
  let headline = "Disciplined, Even Pacing";
  let description = `Maintained a steady rhythm throughout, varying by only ${Math.round(paceVariance)}s between your fastest and slowest kilometers.`;

  if (halfDiff <= -5) {
    // Second half faster
    splitType = "NEGATIVE_SPLIT";
    headline = "Negative Split Achieved ⚡";
    description = `Your second half was ${Math.round(Math.abs(halfDiff))}s/km faster than your first half. Outstanding pacing control and finishing kick.`;
  } else if (halfDiff >= 12) {
    // Second half noticeably slower
    splitType = "POSITIVE_SPLIT";
    headline = "Fast Start, Late Fade";
    description = `You started briskly in km 1-${mid}, but pace slowed by ${Math.round(halfDiff)}s/km in the latter half.`;
  }

  // Detect sudden pace dropoff point (e.g. slowed by > 20s/km from previous km)
  let dropoffKm: number | null = null;
  for (let i = 1; i < fullSplits.length; i++) {
    const jump = fullSplits[i].pace - fullSplits[i - 1].pace;
    if (jump >= 20) {
      dropoffKm = fullSplits[i].splitNumber;
      break;
    }
  }

  // Consistency score: 100 minus variance penalty
  const consistencyScore = Math.max(20, Math.min(98, Math.round(100 - paceVariance * 0.8)));

  return {
    splitType,
    headline,
    description,
    fastestSplitNumber: fastest.splitNumber,
    fastestSplitPace: fastest.pace,
    slowestSplitNumber: slowest.splitNumber,
    slowestSplitPace: slowest.pace,
    paceVarianceSeconds: Math.round(paceVariance),
    consistencyScore,
    possibleFatigueKm: dropoffKm,
  };
}

/**
 * Evaluates possible factors why a run may have felt difficult or subpar.
 */
export function diagnoseStruggleRun(params: {
  feeling?: string | null;
  energy?: number | null;
  legCondition?: number | null;
  sleepQuality?: number | null;
  splits: CalculatedSplit[];
  elevationGain: number;
  historicalAvgPace: number;
  historicalAvgElevationGain: number;
  weeklyLoadIncreasePercent?: number | null;
}): BadRunDiagnostic {
  const factors: BadRunDiagnostic["factors"] = [];
  const {
    feeling,
    energy,
    legCondition,
    sleepQuality,
    splits,
    elevationGain,
    historicalAvgPace,
    historicalAvgElevationGain,
    weeklyLoadIncreasePercent,
  } = params;

  // 1. Check subjective ratings
  if (feeling === "TERRIBLE" || feeling === "TIRED" || (energy && energy <= 2)) {
    factors.push({
      title: "Low Starting Energy",
      description: "You logged lower energy/freshness ratings entering or during this activity.",
      severity: "MEDIUM",
    });
  }

  if (legCondition && legCondition <= 2) {
    factors.push({
      title: "Leg Muscular Fatigue",
      description: "Leg condition was reported low, indicating residual muscular tightness or fatigue.",
      severity: "MEDIUM",
    });
  }

  if (sleepQuality && sleepQuality <= 2) {
    factors.push({
      title: "Suboptimal Sleep / Rest",
      description: "Rest and sleep were rated lower than usual prior to this session.",
      severity: "LOW",
    });
  }

  // 2. Early surge pacing factor (started > 25s faster than historical average)
  if (splits.length >= 2 && historicalAvgPace > 0) {
    const firstKm = splits[0].pace;
    if (firstKm > 0 && historicalAvgPace - firstKm >= 25) {
      factors.push({
        title: "Aggressive Early Pacing",
        description: `KM 1 was run at ${formatPace(firstKm)}, which was significantly quicker than your usual pace (${formatPace(historicalAvgPace)}), likely accelerating early glycogen depletion.`,
        severity: "HIGH",
      });
    }
  }

  // 3. Elevation factor
  if (historicalAvgElevationGain > 0 && elevationGain >= historicalAvgElevationGain * 1.5 && elevationGain > 40) {
    factors.push({
      title: "Higher Elevation Demands",
      description: `This route featured ${Math.round(elevationGain)}m of climbing, considerably steeper than your typical route.`,
      severity: "MEDIUM",
    });
  }

  // 4. Sudden training load increase
  if (weeklyLoadIncreasePercent && weeklyLoadIncreasePercent > 25) {
    factors.push({
      title: "Elevated Weekly Training Load",
      description: `Weekly mileage increased by +${Math.round(weeklyLoadIncreasePercent)}% recently, which accumulates acute physiological fatigue.`,
      severity: "HIGH",
    });
  }

  const isStruggleRun =
    feeling === "TERRIBLE" ||
    (energy !== null && energy !== undefined && energy <= 2) ||
    factors.length >= 2;

  return {
    isStruggleRun,
    factors,
  };
}
