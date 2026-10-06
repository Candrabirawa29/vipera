"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  saveActiveRunDraft,
  clearActiveRunDraft,
  appendActivePoint,
  queueRunForSync,
  StoredRunPoint,
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

export interface GPSDebugMetrics {
  callbacksCount: number;
  acceptedPointsCount: number;
  rejectedPointsCount: number;
  rejectedReasons: {
    accuracy: number;
    speed: number;
    duplicate: number;
    stationary: number;
    timestamp: number;
    invalid: number;
  };
  lastCallbackTime: number | null;
  lastAcceptedTime: number | null;
  lastRejectedReason: string | null;
  lastCoords: { latitude: number; longitude: number } | null;
  lastAccuracy: number | null;
  lastSpeedMps: number | null;
  watchError: string | null;
  isSearching: boolean;
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
  const [gpsNotice, setGpsNotice] = useState<string | null>("Initializing GPS...");
  const [intervalSnapshot, setIntervalSnapshot] = useState<IntervalEngineSnapshot | null>(null);
  const [ghostComparison, setGhostComparison] = useState<GhostComparisonResult | null>(null);

  // GPS Debug Information
  const [gpsDebug, setGpsDebug] = useState<GPSDebugMetrics>({
    callbacksCount: 0,
    acceptedPointsCount: 0,
    rejectedPointsCount: 0,
    rejectedReasons: {
      accuracy: 0,
      speed: 0,
      duplicate: 0,
      stationary: 0,
      timestamp: 0,
      invalid: 0,
    },
    lastCallbackTime: null,
    lastAcceptedTime: null,
    lastRejectedReason: null,
    lastCoords: null,
    lastAccuracy: null,
    lastSpeedMps: null,
    watchError: null,
    isSearching: true,
  });

  // Settings
  const [audioSettings] = useState({
    voiceEnabled: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  // Internal references to prevent stale closures in watchPosition callbacks
  const statusRef = useRef<RunTrackerStatus>("IDLE");
  const runIdRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastValidRawRef = useRef<RawGPSPoint | null>(null);
  const recentPointsWindowRef = useRef<StoredRunPoint[]>([]);
  const intervalEngineRef = useRef<IntervalEngine | null>(null);
  const ghostRef = useRef<GhostRunSnapshot | null>(null);
  const activityTypeRef = useRef<string>("RUN");
  const workoutConfigRef = useRef<TrackerInitOptions["workout"] | null>(null);

  // Synchronous accumulator refs
  const distanceRef = useRef(0);
  const durationRef = useRef(0);

  // Sync state mirrors
  statusRef.current = status;
  distanceRef.current = distance;
  durationRef.current = duration;

  // Active duration ticker
  useEffect(() => {
    if (status === "RUNNING") {
      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          const nextDuration = prev + 1;
          durationRef.current = nextDuration;

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

  // GPS Watch Position Callback Handler
  const handleGPSUpdate = useCallback((pos: GeolocationPosition) => {
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
    if (raw.accuracy <= 10) setGpsQuality("EXCELLENT");
    else if (raw.accuracy <= 25) setGpsQuality("GOOD");
    else setGpsQuality("WEAK");

    setGpsNotice(null);

    // Update debug stats for every callback
    setGpsDebug((prev) => ({
      ...prev,
      callbacksCount: prev.callbacksCount + 1,
      lastCallbackTime: Date.now(),
      lastCoords: { latitude: raw.latitude, longitude: raw.longitude },
      lastAccuracy: Math.round(raw.accuracy),
      lastSpeedMps: raw.speed !== null && raw.speed !== undefined ? Math.round(raw.speed * 10) / 10 : null,
      isSearching: false,
      watchError: null,
    }));

    // Check against filtering rules (Accuracy <= 50m, Speed <= 18 m/s)
    const filterResult = evaluateGPSPoint(raw, lastValidRawRef.current, {
      maxAccuracyMeters: 50,
      maxRunningSpeedMps: 18.0,
      minTimeDeltaMs: 250,
      minDistanceMeters: 0.8,
    });

    if (!filterResult.isValid) {
      // Record rejection reason in debug
      const reason = filterResult.reason || "UNKNOWN";
      setGpsDebug((prev) => {
        const nextReasons = { ...prev.rejectedReasons };
        if (reason === "ACCURACY_TOO_LOW") nextReasons.accuracy += 1;
        else if (reason === "TELEPORTATION_UNREALISTIC_SPEED") nextReasons.speed += 1;
        else if (reason === "DUPLICATE_POINT") nextReasons.duplicate += 1;
        else if (reason === "STATIONARY_JITTER") nextReasons.stationary += 1;
        else if (reason === "TIMESTAMP_REGRESSION" || reason === "TIME_DELTA_TOO_SMALL") nextReasons.timestamp += 1;
        else nextReasons.invalid += 1;

        return {
          ...prev,
          rejectedPointsCount: prev.rejectedPointsCount + 1,
          lastRejectedReason: reason,
          rejectedReasons: nextReasons,
        };
      });
      return;
    }

    // Point ACCEPTED
    lastValidRawRef.current = raw;

    // Even if paused or starting, update currentPosition so map centers on actual GPS
    const isActuallyRunning = statusRef.current === "RUNNING";
    const deltaDist = isActuallyRunning ? filterResult.calculatedDistanceDelta : 0;
    const newDistance = distanceRef.current + deltaDist;
    distanceRef.current = newDistance;

    if (isActuallyRunning) {
      setDistance(newDistance);
    }

    if (filterResult.calculatedSpeedMps !== undefined) {
      setCurrentSpeed(filterResult.calculatedSpeedMps);
    }

    const calculatedPace = deltaDist > 0 && lastValidRawRef.current
      ? calculatePaceSecPerKm(deltaDist, Math.max(1, (raw.timestamp - lastValidRawRef.current.timestamp) / 1000))
      : 0;

    const newPoint: StoredRunPoint = {
      runId: runIdRef.current || "active-run",
      latitude: raw.latitude,
      longitude: raw.longitude,
      altitude: raw.altitude,
      accuracy: raw.accuracy,
      speed: filterResult.calculatedSpeedMps,
      heading: raw.heading,
      timestamp: raw.timestamp,
      elapsedTime: durationRef.current,
      distanceFromStart: newDistance,
      pace: calculatedPace,
      isPaused: !isActuallyRunning,
    };

    recentPointsWindowRef.current.push(newPoint);
    if (recentPointsWindowRef.current.length > 5) {
      recentPointsWindowRef.current.shift();
    }

    const smoothed = calculateSmoothedPace(recentPointsWindowRef.current);
    if (smoothed > 0) {
      setCurrentPace(smoothed);
    }

    // Update state & map polyline points
    setCurrentPosition(newPoint);
    if (isActuallyRunning) {
      setPoints((prev) => [...prev, newPoint]);
    }

    // Update debug accepted count
    setGpsDebug((prev) => ({
      ...prev,
      acceptedPointsCount: prev.acceptedPointsCount + 1,
      lastAcceptedTime: Date.now(),
      lastRejectedReason: null,
    }));

    // Append to local IndexedDB stream if running
    if (isActuallyRunning && runIdRef.current) {
      appendActivePoint(newPoint).catch((err) => {
        console.error("Failed to append point locally:", err);
      });
    }
  }, []);

  // Geolocation Watcher Lifecycle
  const startGeolocation = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsNotice("Geolocation API is not supported on this browser.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    setGpsNotice("Acquiring GPS satellite fix...");

    // Start a 6-second timeout: if callbacksCount remains 0, notify user
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setGpsDebug((prev) => {
        if (prev.callbacksCount === 0) {
          setGpsNotice(
            "Waiting for GPS signal... Please ensure location is enabled and you have a clear view of the sky."
          );
        }
        return prev;
      });
    }, 6000);

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleGPSUpdate,
      (err) => {
        console.warn("Geolocation watch error:", err);
        let errorMsg = "GPS signal weak or unavailable.";
        if (err.code === 1) {
          errorMsg = "Location permission denied. Please allow location access in your browser.";
        } else if (err.code === 2) {
          errorMsg = "GPS position unavailable. Ensure device Location/GPS is turned ON.";
        } else if (err.code === 3) {
          errorMsg = "GPS signal timeout. Re-establishing connection...";
        }
        setGpsQuality("WEAK");
        setGpsNotice(errorMsg);
        setGpsDebug((prev) => ({
          ...prev,
          watchError: `${err.code}: ${err.message}`,
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 15000,
      }
    );
  }, [handleGPSUpdate]);

  const stopGeolocation = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
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
      durationRef.current = 0;
      setDistance(0);
      distanceRef.current = 0;
      setCurrentPace(0);
      setAveragePace(0);
      setPoints([]);
      lastValidRawRef.current = null;
      recentPointsWindowRef.current = [];

      // Update status synchronously via ref and state
      statusRef.current = "RUNNING";
      setStatus("RUNNING");

      // Activate screen wake lock immediately
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
    },
    [audioSettings, startGeolocation]
  );

  // PAUSE RUN
  const pauseRun = useCallback(() => {
    statusRef.current = "PAUSED";
    setStatus("PAUSED");
    intervalEngineRef.current?.pause();
    speakCue("Run paused", audioSettings.voiceEnabled);
  }, [audioSettings]);

  // RESUME RUN
  const resumeRun = useCallback(async () => {
    statusRef.current = "RUNNING";
    setStatus("RUNNING");
    intervalEngineRef.current?.resume();
    await wakeManager.requestLock();
    speakCue("Resuming run", audioSettings.voiceEnabled);
  }, [audioSettings]);

  // SKIP / ADVANCE INTERVAL
  const manualAdvanceInterval = useCallback(() => {
    if (intervalEngineRef.current) {
      intervalEngineRef.current.manualAdvance(distanceRef.current, durationRef.current);
      setIntervalSnapshot(intervalEngineRef.current.getSnapshot());
    }
  }, []);

  // TOGGLE LOCK SCREEN
  const toggleLock = useCallback(() => {
    setIsLocked((prev) => !prev);
  }, []);

  // FINISH RUN
  const finishRun = useCallback(async (): Promise<CompletedRunPayload | null> => {
    statusRef.current = "FINISHED";
    setStatus("FINISHED");
    stopGeolocation();
    await wakeManager.releaseLock();

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
    gpsNotice,
    gpsDebug,
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
