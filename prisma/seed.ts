import { PrismaClient } from "@prisma/client";
import { getRealisticSeedRuns } from "../src/lib/seed-data";
import { WORKOUT_PRESETS } from "../src/lib/presets/workout-presets";
import { calculateRouteGeometry } from "../src/lib/running/route-memory";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting Vipera Run database seeding...");

  // 1. Upsert default athlete user
  const user = await prisma.user.upsert({
    where: { email: "runner@vipera.local" },
    update: {},
    create: {
      email: "runner@vipera.local",
      name: "Alex Rivers",
      role: "USER",
      settings: {
        create: {
          unitSystem: "METRIC",
          paceFormat: "MIN_PER_KM",
          autoPause: false,
          gpsAccuracyThreshold: 25.0,
          voiceCues: true,
          soundEffects: true,
          vibration: true,
          screenWakeLock: true,
          mapTheme: "sport-dark",
        },
      },
    },
  });

  console.log(`👤 User ready: ${user.name} (${user.id})`);

  // 2. Upsert Interval Workout Presets
  for (const preset of WORKOUT_PRESETS) {
    const existing = await prisma.intervalWorkout.findFirst({
      where: { userId: user.id, title: preset.title },
    });

    if (!existing) {
      await prisma.intervalWorkout.create({
        data: {
          userId: user.id,
          title: preset.title,
          description: preset.description,
          isPreset: true,
          steps: {
            create: preset.steps.map((s) => ({
              order: s.order,
              stepType: s.stepType,
              targetType: s.targetType,
              targetValue: s.targetValue,
              targetUnit: s.targetUnit || "METERS",
              repeatCount: s.repeatCount || 1,
              groupIndex: s.groupIndex,
              label: s.label,
              notes: s.notes,
            })),
          },
        },
      });
      console.log(`📋 Created workout preset: ${preset.title}`);
    }
  }

  // 3. Upsert Recognized Route
  const seedRuns = getRealisticSeedRuns();
  const routePoints = seedRuns[0].points;
  const geo = calculateRouteGeometry(routePoints);

  const route = await prisma.route.upsert({
    where: { id: "seed-route-sports-loop" },
    update: {},
    create: {
      id: "seed-route-sports-loop",
      userId: user.id,
      name: "City Sports Loop",
      startLat: geo.startLat,
      startLng: geo.startLng,
      endLat: geo.endLat,
      endLng: geo.endLng,
      centerLat: geo.centerLat,
      centerLng: geo.centerLng,
      boundingBox: geo.boundingBox as object,
      polyline: JSON.stringify(routePoints.map((p) => [p.latitude, p.longitude])),
      averageDistance: 5040,
      runCount: 2,
      bestTime: 1590,
      averageTime: 1620,
    },
  });

  console.log(`🗺️ Created route: ${route.name}`);

  // 4. Upsert Seed Runs
  for (const runData of seedRuns) {
    const existingRun = await prisma.run.findUnique({
      where: { id: runData.id },
    });

    if (!existingRun) {
      await prisma.run.create({
        data: {
          id: runData.id,
          userId: user.id,
          title: runData.title,
          startedAt: new Date(runData.startedAt),
          endedAt: new Date(runData.endedAt),
          duration: runData.duration,
          distance: runData.distance,
          averagePace: runData.averagePace,
          fastestPace: runData.fastestPace,
          averageSpeed: runData.averageSpeed,
          maxSpeed: runData.maxSpeed,
          elevationGain: runData.elevationGain,
          elevationLoss: runData.elevationLoss,
          calories: runData.calories,
          activityType: runData.activityType,
          status: "COMPLETED",
          notes: runData.notes,
          feeling: runData.feeling,
          energy: runData.energy,
          legCondition: runData.legCondition,
          routeId: runData.routeName ? route.id : null,
          splits: {
            create: runData.splits.map((s) => ({
              splitNumber: s.splitNumber,
              distance: s.distance,
              duration: s.duration,
              pace: s.pace,
              averageSpeed: s.averageSpeed,
              elevationChange: s.elevationChange,
              splitType: s.splitType,
            })),
          },
          intervals: runData.intervals
            ? {
                create: runData.intervals.map((iv) => ({
                  stepOrder: iv.stepOrder,
                  stepType: iv.stepType,
                  targetLabel: iv.targetLabel,
                  targetDistance: iv.targetDistance,
                  targetDuration: iv.targetDuration,
                  actualDistance: iv.actualDistance,
                  actualDuration: iv.actualDuration,
                  averagePace: iv.averagePace,
                  fastestPace: iv.fastestPace,
                  completed: iv.completed,
                })),
              }
            : undefined,
          journal: {
            create: {
              feeling: runData.feeling,
              energy: runData.energy,
              legCondition: runData.legCondition,
              sleepQuality: 4,
              notes: runData.notes,
            },
          },
        },
      });

      // Insert points in batches
      const pointsData = runData.points.map((p) => ({
        runId: runData.id,
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
      }));

      await prisma.runPoint.createMany({
        data: pointsData,
      });

      console.log(`🏃 Seeded run: ${runData.title} (${runData.points.length} GPS points)`);
    }
  }

  // 5. Personal Records
  const prs = [
    { category: "FASTEST_1K" as const, value: 249, runId: "seed-run-intervals" },
    { category: "FASTEST_3K" as const, value: 915, runId: "seed-run-5k-tempo" },
    { category: "FASTEST_5K" as const, value: 1590, runId: "seed-run-5k-tempo" },
    { category: "FASTEST_10K" as const, value: 3540, runId: "seed-run-10k-long" },
    { category: "LONGEST_DISTANCE" as const, value: 10250, runId: "seed-run-10k-long" },
    { category: "FASTEST_AVERAGE_PACE" as const, value: 315, runId: "seed-run-5k-tempo" },
  ];

  for (const pr of prs) {
    const existingPR = await prisma.personalRecord.findFirst({
      where: { userId: user.id, category: pr.category },
    });
    if (!existingPR) {
      await prisma.personalRecord.create({
        data: {
          userId: user.id,
          category: pr.category,
          value: pr.value,
          achievedAt: new Date(),
          runId: pr.runId,
          isCurrent: true,
        },
      });
    }
  }
  console.log("🏆 Personal records seeded.");

  // 6. Goals
  const existingGoal = await prisma.goal.findFirst({
    where: { userId: user.id },
  });
  if (!existingGoal) {
    await prisma.goal.createMany({
      data: [
        {
          userId: user.id,
          title: "Sub-25:00 5K Time Trial",
          goalType: "DISTANCE_TIME",
          targetValue: 1500, // 25:00 in seconds
          currentValue: 1590, // current 5K PR: 26:30
          status: "ACTIVE",
        },
        {
          userId: user.id,
          title: "Weekly Volume 25 km",
          goalType: "WEEKLY_DISTANCE",
          targetValue: 25000,
          currentValue: 21300,
          status: "ACTIVE",
        },
      ],
    });
    console.log("🎯 Active athlete goals seeded.");
  }

  console.log("✅ Vipera Run database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
