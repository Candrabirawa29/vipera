import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { calculateTrainingLoad } from "@/lib/running/training-load";
import { calculateRunningFingerprint } from "@/lib/running/fingerprint";
import { getRealisticSeedRuns } from "@/lib/seed-data";

export async function GET() {
  try {
    const user = await getCurrentUser();

    let runs: any[] = [];
    let prs: any[] = [];
    let goals: any[] = [];
    let routes: any[] = [];

    try {
      runs = await prisma.run.findMany({
        where: { userId: user.userId },
        orderBy: { startedAt: "desc" },
        take: 30,
        select: {
          id: true,
          title: true,
          startedAt: true,
          duration: true,
          distance: true,
          averagePace: true,
          fastestPace: true,
          elevationGain: true,
          activityType: true,
          feeling: true,
        },
      });

      prs = await prisma.personalRecord.findMany({
        where: { userId: user.userId, isCurrent: true },
        orderBy: { category: "asc" },
      });

      goals = await prisma.goal.findMany({
        where: { userId: user.userId, status: "ACTIVE" },
      });

      routes = await prisma.route.findMany({
        where: { userId: user.userId },
        orderBy: { runCount: "desc" },
      });
    } catch (err) {
      console.warn("Database athlete query fallback:", err);
    }

    // Fallback to seed data if empty
    if (runs.length === 0) {
      const seed = getRealisticSeedRuns();
      runs = seed.map((r) => ({
        id: r.id,
        title: r.title,
        startedAt: r.startedAt,
        duration: r.duration,
        distance: r.distance,
        averagePace: r.averagePace,
        fastestPace: r.fastestPace,
        elevationGain: r.elevationGain,
        activityType: r.activityType,
        feeling: r.feeling,
      }));

      prs = [
        { category: "FASTEST_1K", value: 249, formattedValue: "4:09", label: "Fastest 1K" },
        { category: "FASTEST_3K", value: 915, formattedValue: "15:15", label: "Fastest 3K" },
        { category: "FASTEST_5K", value: 1590, formattedValue: "26:30", label: "Fastest 5K" },
        { category: "FASTEST_10K", value: 3540, formattedValue: "59:00", label: "Fastest 10K" },
        { category: "LONGEST_DISTANCE", value: 10250, formattedValue: "10.25 km", label: "Longest Run" },
      ];

      goals = [
        {
          id: "g1",
          title: "Sub-25:00 5K Time Trial",
          goalType: "DISTANCE_TIME",
          targetValue: 1500,
          currentValue: 1590,
          status: "ACTIVE",
        },
        {
          id: "g2",
          title: "Weekly Volume 25 km",
          goalType: "WEEKLY_DISTANCE",
          targetValue: 25000,
          currentValue: 21300,
          status: "ACTIVE",
        },
      ];
    }

    const trainingLoad = calculateTrainingLoad(runs);
    const fingerprint = calculateRunningFingerprint(runs);

    return NextResponse.json({
      user,
      trainingLoad,
      fingerprint,
      personalRecords: prs,
      goals,
      routes,
      recentRuns: runs.slice(0, 5),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
