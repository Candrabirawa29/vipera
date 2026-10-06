import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { analyzeRunPacing, diagnoseStruggleRun } from "@/lib/running/pacing-analysis";
import { compareRoutePerformance } from "@/lib/running/route-memory";
import { getRealisticSeedRuns } from "@/lib/seed-data";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    let run: any = null;

    try {
      run = await prisma.run.findUnique({
        where: { id },
        include: {
          points: { orderBy: { elapsedTime: "asc" } },
          splits: { orderBy: { splitNumber: "asc" } },
          intervals: { orderBy: { stepOrder: "asc" } },
          journal: true,
          route: true,
        },
      });
    } catch (dbErr) {
      console.warn("DB query failed, checking seed data for ID:", id);
    }

    // Fallback check in seed data if not found in DB
    if (!run) {
      const seedRuns = getRealisticSeedRuns();
      const match = seedRuns.find((r) => r.id === id);
      if (match) {
        run = {
          ...match,
          userId: user.userId,
          journal: {
            feeling: match.feeling,
            energy: match.energy,
            legCondition: match.legCondition,
            notes: match.notes,
          },
          route: match.routeName ? { id: "seed-route", name: match.routeName } : null,
        };
      }
    }

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    // Generate analytical insights
    const pacingAnalysis = analyzeRunPacing(run.splits);
    const struggleDiagnostic = diagnoseStruggleRun({
      feeling: run.feeling,
      energy: run.energy,
      legCondition: run.legCondition,
      sleepQuality: run.journal?.sleepQuality,
      splits: run.splits,
      elevationGain: run.elevationGain,
      historicalAvgPace: 330,
      historicalAvgElevationGain: 25,
      weeklyLoadIncreasePercent: 15,
    });

    let routeComparison = null;
    if (run.route) {
      routeComparison = compareRoutePerformance(
        {
          id: run.route.id,
          name: run.route.name,
          startLat: 0,
          startLng: 0,
          endLat: 0,
          endLng: 0,
          centerLat: 0,
          centerLng: 0,
          boundingBox: {} as any,
          averageDistance: run.distance,
          runCount: run.route.runCount || 3,
          bestTime: run.route.bestTime || run.duration - 40,
          averageTime: run.route.averageTime || run.duration + 35,
        },
        run.duration,
        run.averagePace
      );
    }

    return NextResponse.json({
      run,
      analysis: {
        pacing: pacingAnalysis,
        diagnostic: struggleDiagnostic,
        routeComparison,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    const { id } = await params;

    await prisma.run.deleteMany({
      where: { id, userId: user.userId },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
