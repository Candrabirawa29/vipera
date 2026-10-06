export interface TrainingLoadMetrics {
  thisWeekDistanceMeters: number;
  lastWeekDistanceMeters: number;
  percentageChange: number; // e.g. +29
  changeDirection: "INCREASED" | "DECREASED" | "STABLE";
  isSpikeWarning: boolean;
  thisMonthDistanceMeters: number;
  currentStreakDays: number;
  totalRunsCount: number;
  recentPaceTrendSecPerKm: number; // average pace of last 3 runs
  weeklyTargetMeters?: number;
}

export function calculateTrainingLoad(
  runs: Array<{
    distance: number; // meters
    duration: number; // seconds
    averagePace: number;
    startedAt: string | Date;
  }>
): TrainingLoadMetrics {
  const now = new Date();

  // Start of current week (Monday)
  const currentDay = now.getDay();
  const diffToMonday = (currentDay + 6) % 7;
  const startOfThisWeek = new Date(now);
  startOfThisWeek.setDate(now.getDate() - diffToMonday);
  startOfThisWeek.setHours(0, 0, 0, 0);

  const startOfLastWeek = new Date(startOfThisWeek);
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let thisWeekDist = 0;
  let lastWeekDist = 0;
  let thisMonthDist = 0;

  for (const r of runs) {
    const d = new Date(r.startedAt);
    if (d >= startOfThisWeek) {
      thisWeekDist += r.distance;
    } else if (d >= startOfLastWeek && d < startOfThisWeek) {
      lastWeekDist += r.distance;
    }

    if (d >= startOfThisMonth) {
      thisMonthDist += r.distance;
    }
  }

  // Calculate percentage change
  let percentageChange = 0;
  if (lastWeekDist > 0) {
    percentageChange = Math.round(((thisWeekDist - lastWeekDist) / lastWeekDist) * 100);
  } else if (thisWeekDist > 0) {
    percentageChange = 100;
  }

  const changeDirection =
    percentageChange > 5 ? "INCREASED" : percentageChange < -5 ? "DECREASED" : "STABLE";

  // Safe training principle: increases > 30% week-over-week carry higher acute load spike
  const isSpikeWarning = percentageChange > 30 && thisWeekDist >= 15000;

  // Streak calculation (days with at least 1 run)
  const runDates = new Set(
    runs.map((r) => {
      const d = new Date(r.startedAt);
      return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    })
  );

  let streak = 0;
  const checkDate = new Date(now);
  // Check if ran today or yesterday
  const todayKey = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;
  checkDate.setDate(checkDate.getDate() - 1);
  const yesterdayKey = `${checkDate.getFullYear()}-${checkDate.getMonth() + 1}-${checkDate.getDate()}`;

  let cursor = runDates.has(todayKey)
    ? new Date(now)
    : runDates.has(yesterdayKey)
    ? checkDate
    : null;

  if (cursor) {
    while (true) {
      const k = `${cursor.getFullYear()}-${cursor.getMonth() + 1}-${cursor.getDate()}`;
      if (runDates.has(k)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Recent pace trend (average of last 3 runs)
  const sorted = [...runs].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  const last3 = sorted.slice(0, 3).filter((r) => r.averagePace > 0);
  const recentPaceTrend =
    last3.length > 0 ? Math.round(last3.reduce((acc, r) => acc + r.averagePace, 0) / last3.length) : 0;

  return {
    thisWeekDistanceMeters: thisWeekDist,
    lastWeekDistanceMeters: lastWeekDist,
    percentageChange,
    changeDirection,
    isSpikeWarning,
    thisMonthDistanceMeters: thisMonthDist,
    currentStreakDays: streak,
    totalRunsCount: runs.length,
    recentPaceTrendSecPerKm: recentPaceTrend,
  };
}
