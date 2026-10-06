import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeRunPacing, diagnoseStruggleRun } from "../pacing-analysis";
import { matchRoute, compareRoutePerformance } from "../route-memory";
import { calculateRunningFingerprint } from "../fingerprint";

describe("Pacing Analysis & Struggle Diagnostics", () => {
  it("detects Negative Split when runner finishes stronger in the second half", () => {
    const splits = [
      { splitNumber: 1, distance: 1000, duration: 320, pace: 320, averageSpeed: 3.1, elevationChange: 0, splitType: "KILOMETER" as const, isPartial: false },
      { splitNumber: 2, distance: 1000, duration: 315, pace: 315, averageSpeed: 3.17, elevationChange: 0, splitType: "KILOMETER" as const, isPartial: false },
      { splitNumber: 3, distance: 1000, duration: 300, pace: 300, averageSpeed: 3.33, elevationChange: 0, splitType: "KILOMETER" as const, isPartial: false },
      { splitNumber: 4, distance: 1000, duration: 290, pace: 290, averageSpeed: 3.44, elevationChange: 0, splitType: "KILOMETER" as const, isPartial: false },
    ];
    const analysis = analyzeRunPacing(splits);
    assert.ok(analysis !== null);
    assert.equal(analysis.splitType, "NEGATIVE_SPLIT");
    assert.ok(analysis.description.includes("faster than your first half"));
  });

  it("diagnoses possible factors for a struggle run based on data", () => {
    const splits = [
      { splitNumber: 1, distance: 1000, duration: 260, pace: 260, averageSpeed: 3.8, elevationChange: 0, splitType: "KILOMETER" as const, isPartial: false }, // aggressive start
      { splitNumber: 2, distance: 1000, duration: 340, pace: 340, averageSpeed: 2.9, elevationChange: 0, splitType: "KILOMETER" as const, isPartial: false },
    ];
    const diag = diagnoseStruggleRun({
      feeling: "TIRED",
      energy: 2,
      splits,
      elevationGain: 65,
      historicalAvgPace: 320, // started 60s faster than 320!
      historicalAvgElevationGain: 20,
      weeklyLoadIncreasePercent: 35,
    });
    assert.equal(diag.isStruggleRun, true);
    assert.ok(diag.factors.length >= 3);
    const titles = diag.factors.map((f) => f.title);
    assert.ok(titles.includes("Aggressive Early Pacing"));
    assert.ok(titles.includes("Elevated Weekly Training Load"));
  });
});

describe("Route Memory & Matching", () => {
  it("matches a run against an existing route with proximity and similar distance", () => {
    const routeCandidate = {
      id: "route-loop-1",
      name: "River Loop",
      startLat: -6.2,
      startLng: 106.8,
      endLat: -6.2001,
      endLng: 106.8001,
      centerLat: -6.205,
      centerLng: 106.805,
      boundingBox: { minLat: -6.21, maxLat: -6.2, minLng: 106.8, maxLng: 106.81 },
      averageDistance: 5000,
      runCount: 5,
      bestTime: 1600,
      averageTime: 1700,
    };

    const runPoints = [
      { latitude: -6.20005, longitude: 106.80005 },
      { latitude: -6.205, longitude: 106.805 },
      { latitude: -6.21, longitude: 106.808 },
      { latitude: -6.206, longitude: 106.806 },
      { latitude: -6.2001, longitude: 106.8001 },
    ];

    const match = matchRoute(runPoints, 5050, [routeCandidate]);
    assert.ok(match !== null);
    assert.equal(match.id, "route-loop-1");

    const comp = compareRoutePerformance(match, 1620, 324);
    assert.equal(comp.isFasterThanAverage, true);
    assert.equal(comp.timeVsAverageSeconds, -80);
  });
});

describe("Running Fingerprint Multi-Factor Profile", () => {
  it("calculates multi-axis scores (0-100) from athlete history", () => {
    const runs = [
      { distance: 5000, duration: 1500, averagePace: 300, fastestPace: 260, elevationGain: 20, startedAt: new Date().toISOString() },
      { distance: 10000, duration: 3400, averagePace: 340, fastestPace: 280, elevationGain: 50, startedAt: new Date().toISOString() },
      { distance: 8000, duration: 2500, averagePace: 312, fastestPace: 270, elevationGain: 35, startedAt: new Date().toISOString() },
    ];

    const fingerprint = calculateRunningFingerprint(runs);
    assert.ok(fingerprint.endurance >= 40 && fingerprint.endurance <= 100);
    assert.ok(fingerprint.speed >= 40 && fingerprint.speed <= 100);
    assert.ok(fingerprint.consistency >= 30 && fingerprint.consistency <= 100);
    assert.ok(fingerprint.pacing >= 40 && fingerprint.pacing <= 100);
    assert.ok(fingerprint.overallScore > 0);
    assert.ok(typeof fingerprint.archetype === "string");
  });
});
