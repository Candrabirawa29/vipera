import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  IntervalEngine,
  flattenWorkoutSteps,
  WorkoutStepConfig,
} from "../interval-engine";
import { findBestEffortSegment } from "../records";
import { calculateGhostComparison } from "../ghost";
import { calculateSplits } from "../splits";

describe("Interval Workout Engine", () => {
  it("flattens repeat groups into exact sequence of execution steps", () => {
    const steps: WorkoutStepConfig[] = [
      {
        order: 1,
        stepType: "WARMUP",
        targetType: "DURATION",
        targetValue: 600,
        repeatCount: 1,
      },
      {
        order: 2,
        stepType: "RUN",
        targetType: "DISTANCE",
        targetValue: 400,
        repeatCount: 3,
        groupIndex: 1,
      },
      {
        order: 3,
        stepType: "RECOVERY",
        targetType: "DISTANCE",
        targetValue: 200,
        repeatCount: 3,
        groupIndex: 1,
      },
      {
        order: 4,
        stepType: "COOLDOWN",
        targetType: "DURATION",
        targetValue: 300,
        repeatCount: 1,
      },
    ];

    const queue = flattenWorkoutSteps(steps);
    // Expected: 1 Warmup + (3 * 2 intervals) + 1 Cooldown = 8 steps
    assert.equal(queue.length, 8);
    assert.equal(queue[0].stepType, "WARMUP");
    assert.equal(queue[1].stepType, "RUN");
    assert.equal(queue[1].iteration, 1);
    assert.equal(queue[2].stepType, "RECOVERY");
    assert.equal(queue[2].iteration, 1);
    assert.equal(queue[3].stepType, "RUN");
    assert.equal(queue[3].iteration, 2);
    assert.equal(queue[7].stepType, "COOLDOWN");
  });

  it("advances step deterministically when target distance is reached", () => {
    const steps: WorkoutStepConfig[] = [
      { order: 1, stepType: "RUN", targetType: "DISTANCE", targetValue: 400 },
      { order: 2, stepType: "RECOVERY", targetType: "DISTANCE", targetValue: 200 },
    ];

    const engine = new IntervalEngine(steps);
    engine.start(0, 0);

    let snapshot = engine.getSnapshot();
    assert.equal(snapshot.currentStep?.stepType, "RUN");
    assert.equal(snapshot.currentStepIndex, 0);

    // Runner covers 200m in 50s
    snapshot = engine.update(200, 50);
    assert.equal(snapshot.currentStepIndex, 0);
    assert.equal(snapshot.stepProgress, 0.5);

    // Runner covers 405m in 100s -> step should complete and advance to RECOVERY
    snapshot = engine.update(405, 100);
    assert.equal(snapshot.currentStepIndex, 1);
    assert.equal(snapshot.currentStep?.stepType, "RECOVERY");
    assert.equal(snapshot.completedLaps.length, 1);
    assert.equal(snapshot.completedLaps[0].stepType, "RUN");
    assert.equal(snapshot.completedLaps[0].actualDistance, 405);
  });
});

describe("Moving Window Best Effort & Ghost Comparison", () => {
  it("finds fastest 1K window inside an 8km run using two pointers", () => {
    // Synthetic run with a fast kilometer in the middle
    const points = [];
    let dist = 0;
    let time = 0;

    // First 1000m: 6:00/km (360s)
    for (let i = 0; i < 10; i++) {
      dist += 100;
      time += 36;
      points.push({
        latitude: 0,
        longitude: 0,
        distanceFromStart: dist,
        elapsedTime: time,
        timestamp: time * 1000,
      });
    }

    // Next 1000m: 4:30/km (270s) -> Fast segment!
    for (let i = 0; i < 10; i++) {
      dist += 100;
      time += 27;
      points.push({
        latitude: 0,
        longitude: 0,
        distanceFromStart: dist,
        elapsedTime: time,
        timestamp: time * 1000,
      });
    }

    // Next 1000m: 5:30/km (330s)
    for (let i = 0; i < 10; i++) {
      dist += 100;
      time += 33;
      points.push({
        latitude: 0,
        longitude: 0,
        distanceFromStart: dist,
        elapsedTime: time,
        timestamp: time * 1000,
      });
    }

    const best1k = findBestEffortSegment(points, 1000);
    assert.ok(best1k !== null);
    assert.equal(best1k.bestTimeSeconds, 270);
    assert.equal(best1k.averagePaceSecPerKm, 270);
  });

  it("calculates accurate ahead/behind delta vs Ghost Runner", () => {
    const ghost = {
      runId: "ghost-1",
      title: "Previous Best 5K",
      totalDistance: 5000,
      totalDuration: 1500, // 25:00 (5:00/km -> 3.33 m/s)
      averagePace: 300,
      points: [
        { elapsedTime: 0, distanceFromStart: 0 },
        { elapsedTime: 300, distanceFromStart: 1000 },
        { elapsedTime: 600, distanceFromStart: 2000 },
        { elapsedTime: 900, distanceFromStart: 3000 },
        { elapsedTime: 1200, distanceFromStart: 4000 },
        { elapsedTime: 1500, distanceFromStart: 5000 },
      ],
    };

    // At 600 seconds, ghost is at 2000m.
    // If runner is at 2100m, runner is 100m ahead
    const comparison = calculateGhostComparison(ghost, 600, 2100, 280);
    assert.equal(comparison.isAhead, true);
    assert.equal(comparison.distanceDeltaMeters, 100);
    assert.equal(comparison.deltaText, "Ahead by 100m");

    // If runner is at 1920m, runner is 80m behind
    const compBehind = calculateGhostComparison(ghost, 600, 1920, 310);
    assert.equal(compBehind.isAhead, false);
    assert.equal(compBehind.distanceDeltaMeters, -80);
    assert.equal(compBehind.deltaText, "Behind by 80m");
  });

  it("calculates interpolated splits", () => {
    const points = [
      { latitude: 0, longitude: 0, distanceFromStart: 0, elapsedTime: 0, timestamp: 0 },
      { latitude: 0, longitude: 0, distanceFromStart: 600, elapsedTime: 180, timestamp: 180000 },
      { latitude: 0, longitude: 0, distanceFromStart: 1200, elapsedTime: 360, timestamp: 360000 },
    ];
    const splits = calculateSplits(points);
    assert.equal(splits.length, 2);
    assert.equal(splits[0].splitNumber, 1);
    assert.equal(splits[0].distance, 1000);
    assert.equal(splits[0].duration, 300);
  });
});
