import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/user";
import { CompletedRunPayload } from "@/lib/storage/indexed-db";
import { evaluatePersonalRecords } from "@/lib/running/records";
import { matchRoute, calculateRouteGeometry } from "@/lib/running/route-memory";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const payload = (await req.json()) as CompletedRunPayload;

    if (!payload.id || payload.distance === undefined || payload.duration === undefined) {
      return NextResponse.json({ error: "Invalid run payload" }, { status: 400 });
    }

    // 1. Idempotency Check
    const existingRun = await prisma.run.findFirst({
      where: {
        OR: [
          { id: payload.id },
          { idempotencyKey: payload.idempotencyKey || payload.id },
        ],
      },
    });

    if (existingRun) {
      return NextResponse.json({
        success: true,
        message: "Run already synced",
        runId: existingRun.id,
      });
    }

    // 2. Fetch existing routes for matching
    const existingRoutes = await prisma.route.findMany({
      where: { userId: user.userId },
    });

    let matchedRouteId: string | null = null;
    if (payload.points.length >= 5) {
      const match = matchRoute(
        payload.points,
        payload.distance,
        existingRoutes.map((r) => ({
          id: r.id,
          name: r.name,
          startLat: r.startLat,
          startLng: r.startLng,
          endLat: r.endLat,
          endLng: r.endLng,
          centerLat: r.centerLat,
          centerLng: r.centerLng,
          boundingBox: r.boundingBox as any,
          averageDistance: r.averageDistance,
          runCount: r.runCount,
          bestTime: r.bestTime,
          averageTime: r.averageTime,
        }))
      );

      if (match) {
        matchedRouteId = match.id;
        // Update route statistics
        const newRunCount = match.runCount + 1;
        const newAvgTime = Math.round(
          ((match.averageTime || payload.duration) * match.runCount + payload.duration) / newRunCount
        );
        const newBestTime = match.bestTime ? Math.min(match.bestTime, payload.duration) : payload.duration;

        await prisma.route.update({
          where: { id: match.id },
          data: {
            runCount: newRunCount,
            averageTime: newAvgTime,
            bestTime: newBestTime,
          },
        });
      }
    }

    // 3. Evaluate Personal Records
    const existingPRs = await prisma.personalRecord.findMany({
      where: { userId: user.userId, isCurrent: true },
    });

    const evaluatedPRs = evaluatePersonalRecords(
      payload.points.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        altitude: p.altitude,
        distanceFromStart: p.distanceFromStart,
        elapsedTime: p.elapsedTime,
        timestamp: p.timestamp,
      })),
      payload.distance,
      payload.duration,
      payload.averagePace,
      existingPRs.map((pr) => ({ category: pr.category, value: pr.value }))
    );

    const newRecordAlerts = evaluatedPRs.filter((pr) => pr.isNewRecord);

    // Update PRs in database
    for (const pr of newRecordAlerts) {
      // Mark old as not current
      await prisma.personalRecord.updateMany({
        where: { userId: user.userId, category: pr.category as any, isCurrent: true },
        data: { isCurrent: false },
      });

      await prisma.personalRecord.create({
        data: {
          userId: user.userId,
          category: pr.category as any,
          value: pr.value,
          previousValue: pr.previousRecordValue,
          improvement: pr.improvement,
          achievedAt: new Date(payload.startedAt),
          runId: payload.id,
          isCurrent: true,
        },
      });
    }

    // 4. Create Run in Database
    const createdRun = await prisma.run.create({
      data: {
        id: payload.id,
        userId: user.userId,
        title: payload.title || "Run",
        startedAt: new Date(payload.startedAt),
        endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
        duration: payload.duration,
        distance: payload.distance,
        averagePace: payload.averagePace,
        fastestPace: payload.fastestPace,
        averageSpeed: payload.averageSpeed,
        maxSpeed: payload.maxSpeed,
        elevationGain: payload.elevationGain,
        elevationLoss: payload.elevationLoss,
        calories: payload.calories,
        activityType: (payload.activityType as any) || "RUN",
        status: "COMPLETED",
        notes: payload.notes,
        feeling: payload.feeling,
        energy: payload.energy,
        legCondition: payload.legCondition,
        weatherSnapshot: payload.weatherSnapshot as any,
        idempotencyKey: payload.idempotencyKey || payload.id,
        syncStatus: "SYNCED",
        routeId: matchedRouteId,
        splits: {
          create: payload.splits.map((s) => ({
            splitNumber: s.splitNumber,
            distance: s.distance,
            duration: s.duration,
            pace: s.pace,
            averageSpeed: s.averageSpeed,
            elevationChange: s.elevationChange,
            splitType: s.splitType,
          })),
        },
        intervals: payload.intervals && payload.intervals.length > 0
          ? {
              create: payload.intervals.map((iv) => ({
                stepOrder: iv.stepOrder,
                stepType: iv.stepType as any,
                targetLabel: iv.targetLabel,
                targetDistance: iv.targetDistance,
                targetDuration: iv.targetDuration,
                actualDistance: iv.actualDistance,
                actualDuration: iv.actualDuration,
                averagePace: iv.averagePace,
                fastestPace: iv.fastestPace,
                elevationChange: iv.elevationChange || 0,
                completed: iv.completed,
              })),
            }
          : undefined,
        journal: payload.feeling
          ? {
              create: {
                feeling: payload.feeling,
                energy: payload.energy || 3,
                legCondition: payload.legCondition || 3,
                notes: payload.notes,
              },
            }
          : undefined,
      },
    });

    // 5. Store GPS points (batch insert)
    if (payload.points.length > 0) {
      // If excessive points (> 2000), sample appropriately while keeping start/end
      const pointsToSave =
        payload.points.length > 2000
          ? payload.points.filter(
              (_, idx) =>
                idx === 0 ||
                idx === payload.points.length - 1 ||
                idx % Math.ceil(payload.points.length / 1500) === 0
            )
          : payload.points;

      await prisma.runPoint.createMany({
        data: pointsToSave.map((p) => ({
          runId: createdRun.id,
          latitude: p.latitude,
          longitude: p.longitude,
          altitude: p.altitude,
          accuracy: p.accuracy,
          speed: p.speed,
          heading: p.heading,
          timestamp: new Date(p.timestamp),
          elapsedTime: p.elapsedTime,
          distanceFromStart: p.distanceFromStart,
          pace: p.pace,
          isPaused: p.isPaused,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      runId: createdRun.id,
      newRecords: newRecordAlerts,
      matchedRouteId,
    });
  } catch (err: any) {
    console.error("Run sync failed:", err);
    return NextResponse.json(
      { error: err.message || "Failed to sync run" },
      { status: 500 }
    );
  }
}
