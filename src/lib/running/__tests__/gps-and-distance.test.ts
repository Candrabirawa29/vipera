import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateHaversineDistance,
  calculateTotalDistance,
  calculateElevationGainLoss,
} from "../distance";
import { calculatePaceSecPerKm, formatPace, formatDuration } from "../pace";
import { evaluateGPSPoint, simplifyRoute } from "../gps-filter";

describe("GPS Distance & Pace Calculation", () => {
  it("calculates Haversine distance correctly between two known coordinates", () => {
    // Distance between Gelora Bung Karno and Monas Jakarta is ~4.5 km (4500m)
    const lat1 = -6.2185;
    const lon1 = 106.8026;
    const lat2 = -6.1754;
    const lon2 = 106.8272;

    const dist = calculateHaversineDistance(lat1, lon1, lat2, lon2);
    assert.ok(dist > 5000 && dist < 6000, `Expected ~5500m, got ${dist}`);
  });

  it("calculates total distance across multi-point track", () => {
    const points = [
      { latitude: -6.2, longitude: 106.8 },
      { latitude: -6.201, longitude: 106.8 },
      { latitude: -6.202, longitude: 106.8 },
    ];
    const total = calculateTotalDistance(points);
    assert.ok(total > 200 && total < 250);
  });

  it("calculates pace in seconds per kilometer", () => {
    // 1000 meters in 300 seconds = 5:00/km (300 sec/km)
    const pace = calculatePaceSecPerKm(1000, 300);
    assert.equal(pace, 300);
    assert.equal(formatPace(pace), "5:00 /km");

    // 5000 meters in 1500 seconds (25 min) = 5:00/km
    const pace5k = calculatePaceSecPerKm(5000, 1500);
    assert.equal(pace5k, 300);
  });

  it("formats durations accurately", () => {
    assert.equal(formatDuration(0), "00:00");
    assert.equal(formatDuration(59), "00:59");
    assert.equal(formatDuration(305), "05:05");
    assert.equal(formatDuration(3665), "1:01:05");
  });

  it("filters elevation jitter using threshold deadband", () => {
    // Altitude jittering +1, -1, +1 should not count as elevation gain
    const altitudes = [10, 11, 10, 11, 10, 10.5, 20];
    const { gain, loss } = calculateElevationGainLoss(altitudes, 2.0);
    // Only the jump to 20 should be counted as gain (+10)
    assert.equal(gain, 10);
    assert.equal(loss, 0);
  });
});

describe("GPS Anomaly & Quality Filtering", () => {
  it("rejects points with blurry GPS accuracy", () => {
    const result = evaluateGPSPoint(
      {
        latitude: -6.2,
        longitude: 106.8,
        accuracy: 45, // worse than 30m
        timestamp: Date.now(),
      },
      null,
      { maxAccuracyMeters: 30 }
    );
    assert.equal(result.isValid, false);
    assert.equal(result.reason, "ACCURACY_TOO_LOW");
  });

  it("rejects teleportation and impossible speed jumps", () => {
    const p1 = {
      latitude: -6.2,
      longitude: 106.8,
      accuracy: 5,
      timestamp: 1000000,
    };
    // Jump 1 km in 2 seconds = 500 m/s (~1800 km/h)
    const p2 = {
      latitude: -6.21,
      longitude: 106.8,
      accuracy: 5,
      timestamp: 1002000,
    };
    const result = evaluateGPSPoint(p2, p1);
    assert.equal(result.isValid, false);
    assert.equal(result.reason, "TELEPORTATION_UNREALISTIC_SPEED");
  });

  it("simplifies polyline using Douglas-Peucker without deleting extremities", () => {
    const points = [
      { latitude: -6.2, longitude: 106.8 },
      { latitude: -6.2001, longitude: 106.80005 }, // slight wobble along straight line
      { latitude: -6.201, longitude: 106.801 },
    ];
    const simplified = simplifyRoute(points, 10);
    assert.ok(simplified.length <= points.length);
    assert.equal(simplified[0].latitude, points[0].latitude);
    assert.equal(simplified[simplified.length - 1].latitude, points[points.length - 1].latitude);
  });
});
