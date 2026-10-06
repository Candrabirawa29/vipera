"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  saveActiveRunDraft,
  getActiveRunDraft,
  clearActiveRunDraft,
  appendActivePoint,
  queueRunForSync,
  StoredRunPoint,
  ActiveRunState,
  CompletedRunPayload,
} from "../storage/indexed-db";
import { evaluateGPSPoint, RawGPSPoint } from "./gps-filter";
import { calculatePaceSecPerKm, calculateSmoothedPace } from "./pace";
import { calculateSplits } from "./splits";
import { calculateElevationGainLoss } from "./distance";
import {
  IntervalEngine,
  IntervalEngineSnapshot,
  WorkoutStepConfig,
} from "./interval-engine";
import {
  calculateGhostComparison,
  GhostRunSnapshot,
  GhostComparisonResult,
} from "./ghost";
import {
  cueCountdown,
  cueStepTransition,
  cueWorkoutComplete,
  speakCue,
} from "./audio-cues";
import { wakeManager } from "./wake-lock";
import { syncEngine } from "../storage/sync-engine";

export type RunTrackerStatus = "IDLE" | "STARTING" | "RUNNING" | "PAUSED" | "FINISHED";

export interface TrackerInitOptions {
  workout?: {
    id?: string;
    title: string;
    steps: WorkoutStepConfig[];
  } | null;
  ghost?: GhostRunSnapshot | null;
  activityType?: string;
}

export function useRunTracker() {
  const [status, setStatus] = useState<RunTrackerStatus>("IDLE");
  const [duration, setDuration] = useState(0); // active seconds
  const [distance, setDistance] = useState(0); // active meters
  const [currentPace, setCurrentPace] = useState(0); // smoothed sec/km
  const [averagePace, setAveragePace] = useState(0); // sec/km
  const [currentSpeed, setCurrentSpeed] = useState(0); // m/s
  const [currentPosition, setCurrentPosition] = useState<StoredRunPoint | null>(null);
  const [points, setPoints] = useState<StoredRunPoint[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsQuality, setGpsQuality] = useState<"EXCELLENT" | "GOOD" | "WEAK" | "SEARCHING">("SEARCHING");
  const [intervalSnapshot, setIntervalSnapshot] = useState<IntervalEngineSnapshot | null>(null);
  const [ghostComparison, setGhostComparison] = useState<GhostComparisonResult | null>(null);

  // Settings
  const [audioSettings] = useState({
    voiceEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  // Internal references
  const runIdRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastValidRawRef = useRef<RawGPSPoint | null>(null);
  const recentPointsWindowRef = useRef<StoredRunPoint[]>([]);
  const intervalEngineRef = useRef<IntervalEngine | null>(null);
  const ghostRef = useRef<GhostRunSnapshot | null>(null);
  const activityTypeRef = useRef<string>("RUN");
  const workoutConfigRef = useRef<TrackerInitOptions["workout"] | null>(null);

  // State mirror refs for interval updates without stale closures
  const distanceRef = useRef(0);
  const durationRef = useRef(0);
  distanceRef.current = distance;
  durationRef.current = duration;

  // Active duration ticker
  useEffect(() => {
    if (status === "RUNNING") {
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const nextDuration = prev + 1;

          // Update average pace
          if (distanceRef.current >= 10) {
            setAveragePace(calculatePaceSecPerKm(distanceRef.current, nextDuration));
          }

          // Update interval engine
          if (intervalEngineRef.current) {
            const snapshot = intervalEngineRef.current.update(
              distanceRef.current,
              nextDuration
            );
            setIntervalSnapshot(snapshot);
          }

          // Update ghost runner comparison
          if (ghostRef.current) {
            const comp = calculateGhostComparison(
              ghostRef.current,
              nextDuration,
              distanceRef.current,
              currentPace
            );
            setGhostComparison(comp);
          }

          // Periodic local state draft auto-save every 5 seconds
          if (nextDuration % 5 === 0 && runIdRef.current) {
            saveActiveRunDraft({
              id: runIdRef.current,
              userId: "current-user",
              title: workoutConfigRef.current?.title
                ? `Interval: ${workoutConfigRef.current.title}`
                : "Active Run",
              activityType: activityTypeRef.current,
              startedAt: new Date(Date.now() - nextDuration * 1000).toISOString(),
              duration: nextDuration,
              distance: distanceRef.current,
              isPaused: false,
              totalPausedDuration: 0,
              workout: workoutConfigRef.current,
              ghost: ghostRef.current,
              lastUpdated: Date.now(),
            }).catch(() => {});
          }

          return nextDuration;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, currentPace]);

  // GPS Watch Position Handler
  const handleGPSUpdate = useCallback(
    (pos: GeolocationPosition) => {
      const raw: RawGPSPoint = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: pos.coords.altitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      };

      setGpsAccuracy(Math.round(raw.accuracy));
      if (raw.accuracy <= 8) setGpsQuality("EXCELLENT");
      else if (raw.accuracy <= 20) setGpsQuality("GOOD");
      else setGpsQuality("WEAK");

      if (status !== "RUNNING") return;

      const filterResult = evaluateGPSPoint(raw, lastValidRawRef.current, {
        maxAccuracyMeters: 30,
      });

      if (!filterResult.isValid) {
        // Point rejected by anomaly filter
        return;
      }

      lastValidRawRef.current = raw;

      const newDistance = distanceRef.current + filterResult.calculatedDistanceDelta;
      setDistance(newDistance);

      if (filterResult.calculatedSpeedMps !== undefined) {
        setCurrentSpeed(filterResult.calculatedSpeedMps);
      }

      // Smooth pace rolling window
      const newPoint: StoredRunPoint = {
        runId: runIdRef.current,
        latitude: raw.latitude,
        longitude: raw.longitude,
        altitude: raw.altitude,
        accuracy: raw.accuracy,
        speed: filterResult.calculatedSpeedMps,
        heading: raw.heading,
        timestamp: raw.timestamp,
        elapsedTime: durationRef.current,
        distanceFromStart: newDistance,
        pace: calculatePaceSecPerKm(
          filterResult.calculatedDistanceDelta,
          Math.max(1, (raw.timestamp - (lastValidRawRef.current?.timestamp || raw.timestamp)) / 1000)
        ),
        isPaused: false,
      };

      recentPointsWindowRef.current.push(newPoint);
      if (recentPointsWindowRef.current.length > 5) {
        recentPointsWindowRef.current.shift();
      }

      const smoothed = calculateSmoothedPace(recentPointsWindowRef.current);
      if (smoothed > 0) {
        setCurrentPace(smoothed);
      }

      setCurrentPosition(newPoint);
      setPoints((prev) => [...prev, newPoint]);

      // Append to local IndexedDB stream
      appendActivePoint(newPoint).catch((err) => {
        console.error("Failed to append point locally:", err);
      });
    },
    [status]
  );

  // Geolocation Watcher Lifecycle
  const startGeolocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleGPSUpdate,
      (err) => {
        console.warn("Geolocation warning:", err.message);
        setGpsQuality("WEAK");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      }
    );
  }, [handleGPSUpdate]);

  const stopGeolocation = useCallback(() => {
    if (watchIdRef.current !== null && typeof window !== "undefined") {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  // START RUN
  const startRun = useCallback(
    async (options: TrackerInitOptions = {}) => {
      const runId = `run-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      runIdRef.current = runId;
      activityTypeRef.current = options.activityType || (options.workout ? "INTERVAL" : "RUN");
      workoutConfigRef.current = options.workout || null;
      ghostRef.current = options.ghost || null;

      // Initialize Interval Engine if workout attached
      if (options.workout && options.workout.steps.length > 0) {
        const engine = new IntervalEngine(options.workout.steps);

        engine.onTransition = ({ completedStep, nextStep }) => {
          const nextDescription = nextStep
            ? `Next: ${nextStep.label}`
            : "Final step completed!";
          cueStepTransition(nextDescription, audioSettings);
        };

        engine.onCountdownCue = (sec) => {
          cueCountdown(sec, audioSettings);
        };

        engine.onWorkoutComplete = () => {
          cueWorkoutComplete(audioSettings);
        };

        engine.start(0, 0);
        intervalEngineRef.current = engine;
        setIntervalSnapshot(engine.getSnapshot());

        speakCue(`Workout started. ${options.workout.steps[0].label || "Warm Up"}`, audioSettings.voiceEnabled);
      } else {
        intervalEngineRef.current = null;
        setIntervalSnapshot(null);
        speakCue("Activity started. Have a strong run!", audioSettings.voiceEnabled);
      }

      setDuration(0);
      setDistance(0);
      setCurrentPace(0);
      setAveragePace(0);
      setPoints([]);
      lastValidRawRef.current = null;
      recentPointsWindowRef.current = [];

      // Request screen wake lock
      await wakeManager.requestLock();

      // Save initial draft
      await saveActiveRunDraft({
        id: runId,
        userId: "current-user",
        title: options.workout?.title || "Active Run",
        activityType: activityTypeRef.current,
        startedAt: new Date().toISOString(),
        duration: 0,
        distance: 0,
        isPaused: false,
        totalPausedDuration: 0,
        workout: options.workout || null,
        ghost: options.ghost || null,
        lastUpdated: Date.now(),
      });

      startGeolocation();
      setStatus("RUNNING");
    },
    [audioSettings, startGeolocation]
  );

  // PAUSE RUN
  const pauseRun = useCallback(() => {
    setStatus("PAUSED");
    intervalEngineRef.current?.pause();
    speakCue("Run paused", audioSettings.voiceEnabled);
  }, [audioSettings]);

  // RESUME RUN
  const resumeRun = useCallback(() => {
    setStatus("RUNNING");
    intervalEngineRef.current?.resume();
    speakCue("Resuming run", audioSettings.voiceEnabled);
  }, [audioSettings]);

  // SKIP / ADVANCE INTERVAL
  const manualAdvanceInterval = useCallback(() => {
    if (intervalEngineRef.current) {
      intervalEngineRef.current.manualAdvance(distanceRef.current, durationRef.current);
      setIntervalSnapshot(intervalEngineRef.current.getSnapshot());
    }
  }, []);

  // TOGGLE LOCK SCREEN (Accidental tap prevention)
  const toggleLock = useCallback(() => {
    setIsLocked((prev) => !prev);
  }, []);

  // FINISH RUN
  const finishRun = useCallback(async (): Promise<CompletedRunPayload | null> => {
    stopGeolocation();
    await wakeManager.releaseLock();
    setStatus("FINISHED");

    const finalDuration = durationRef.current;
    const finalDistance = distanceRef.current;
    const finalPace = calculatePaceSecPerKm(finalDistance, finalDuration);

    const processedPoints = points.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
      altitude: p.altitude,
      distanceFromStart: p.distanceFromStart,
      elapsedTime: p.elapsedTime,
      timestamp: p.timestamp,
    }));

    // Calculate splits
    const splits = calculateSplits(processedPoints, "METRIC");

    // Calculate elevation
    const { gain, loss } = calculateElevationGainLoss(
      points.map((p) => p.altitude),
      2.0
    );

    // Approximate calories burned (approx 1 kcal per kg per km, default 70kg runner ~ 70 kcal/km)
    const calories = Math.round((finalDistance / 1000) * 68);

    const completedLaps = intervalEngineRef.current?.getSnapshot().completedLaps || [];

    const payload: CompletedRunPayload = {
      id: runIdRef.current,
      userId: "current-user",
      title: workoutConfigRef.current?.title || "Run Activity",
      startedAt: new Date(Date.now() - finalDuration * 1000).toISOString(),
      endedAt: new Date().toISOString(),
      duration: finalDuration,
      distance: finalDistance,
      averagePace: finalPace,
      fastestPace: points.length > 0 ? Math.min(...points.map((p) => p.pace || 999).filter((p) => p > 120)) : finalPace,
      averageSpeed: finalDuration > 0 ? finalDistance / finalDuration : 0,
      maxSpeed: points.length > 0 ? Math.max(...points.map((p) => p.speed || 0)) : 0,
      elevationGain: gain,
      elevationLoss: loss,
      calories,
      activityType: activityTypeRef.current,
      idempotencyKey: runIdRef.current,
      points,
      splits,
      intervals: completedLaps,
      workoutId: workoutConfigRef.current?.id,
      workoutTitle: workoutConfigRef.current?.title,
    };

    // 1. Queue to IndexedDB for offline resilience
    await queueRunForSync(payload);

    // 2. Clear active draft
    await clearActiveRunDraft(runIdRef.current);

    // 3. Trigger sync with server in background
    syncEngine.processQueue().catch(() => {});

    speakCue("Run finished. Great effort!", audioSettings.voiceEnabled);

    return payload;
  }, [points, stopGeolocation, audioSettings]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopGeolocation();
      wakeManager.releaseLock().catch(() => {});
    };
  }, [stopGeolocation]);

  return {
    status,
    duration,
    distance,
    currentPace,
    averagePace,
    currentSpeed,
    currentPosition,
    points,
    isLocked,
    gpsAccuracy,
    gpsQuality,
    intervalSnapshot,
    ghostComparison,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    toggleLock,
    manualAdvanceInterval,
  };
}
