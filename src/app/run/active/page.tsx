"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useRunTracker } from "@/lib/running/useRunTracker";
import { formatPace, formatDuration } from "@/lib/running/pace";
import { formatDistance } from "@/lib/running/distance";
import { WORKOUT_PRESETS, IntervalWorkoutTemplate } from "@/lib/presets/workout-presets";
import { GhostRunSnapshot } from "@/lib/running/ghost";
import RunMap from "@/components/map";
import {
  Play,
  Pause,
  Square,
  Lock,
  Unlock,
  FastForward,
  Zap,
  Dumbbell,
  Compass,
  AlertTriangle,
  Smile,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

function ActiveRunTrackerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode") || "NORMAL";
  const workoutId = searchParams.get("workoutId");
  const ghostSource = searchParams.get("ghostSource");
  const activityType = searchParams.get("type") || "RUN";

  const {
    status,
    duration,
    distance,
    currentPace,
    averagePace,
    currentPosition,
    points,
    isLocked,
    gpsAccuracy,
    gpsQuality,
    gpsNotice,
    gpsDebug,
    currentSpeed,
    intervalSnapshot,
    ghostComparison,
    startRun,
    pauseRun,
    resumeRun,
    finishRun,
    toggleLock,
    manualAdvanceInterval,
  } = useRunTracker();

  const [hasStarted, setHasStarted] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showJournalModal, setShowJournalModal] = useState(false);
  const [completedPayload, setCompletedPayload] = useState<any>(null);

  // Map & Debug Panel states
  const [isMapCollapsed, setIsMapCollapsed] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [gpsTapCount, setGpsTapCount] = useState(0);
  const tapTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleGpsPillClick = () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    const nextCount = gpsTapCount + 1;
    if (nextCount >= 5) {
      setShowDebugPanel((prev) => !prev);
      setGpsTapCount(0);
    } else {
      setGpsTapCount(nextCount);
      tapTimeoutRef.current = setTimeout(() => {
        setGpsTapCount(0);
      }, 3000);
    }
  };

  // Journal form state
  const [feeling, setFeeling] = useState<string>("GOOD");
  const [energy, setEnergy] = useState<number>(4);
  const [legCondition, setLegCondition] = useState<number>(4);
  const [notes, setNotes] = useState<string>("");

  // Start run on mount
  useEffect(() => {
    if (hasStarted) return;
    setHasStarted(true);

    let selectedWorkout: IntervalWorkoutTemplate | null = null;
    let selectedGhost: GhostRunSnapshot | null = null;

    if (mode === "INTERVAL" && workoutId) {
      selectedWorkout = WORKOUT_PRESETS.find((w) => w.id === workoutId) || WORKOUT_PRESETS[0];
    }

    if (mode === "GHOST") {
      // Benchmark 5K ghost points
      selectedGhost = {
        runId: "ghost-pr",
        title: "Best 5K (26:15)",
        totalDistance: 5000,
        totalDuration: 1575, // 26:15
        averagePace: 315,
        points: [
          { elapsedTime: 0, distanceFromStart: 0 },
          { elapsedTime: 315, distanceFromStart: 1000 },
          { elapsedTime: 630, distanceFromStart: 2000 },
          { elapsedTime: 945, distanceFromStart: 3000 },
          { elapsedTime: 1260, distanceFromStart: 4000 },
          { elapsedTime: 1575, distanceFromStart: 5000 },
        ],
      };
    }

    startRun({
      workout: selectedWorkout,
      ghost: selectedGhost,
      activityType,
    });
  }, [hasStarted, mode, workoutId, activityType, startRun]);

  const handleConfirmFinish = async () => {
    setShowFinishModal(false);
    const payload = await finishRun();
    if (payload) {
      setCompletedPayload(payload);
      setShowJournalModal(true);
    } else {
      router.push("/runs");
    }
  };

  const handleSaveJournal = async () => {
    if (completedPayload) {
      completedPayload.feeling = feeling;
      completedPayload.energy = energy;
      completedPayload.legCondition = legCondition;
      completedPayload.notes = notes;

      try {
        await fetch("/api/runs/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(completedPayload),
        });
      } catch {
        // Will sync through offline queue
      }

      router.push(`/runs/${completedPayload.id}`);
    } else {
      router.push("/runs");
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground flex flex-col justify-between select-none">
      {/* Top Status Bar: GPS & Lock */}
      <div className="p-4 flex items-center justify-between border-b border-border/60 bg-card/40 backdrop-blur-md z-30">
        <div className="flex items-center gap-2">
          {/* GPS Signal Pill (Tap 5x to toggle Debug Panel) */}
          <button
            type="button"
            onClick={handleGpsPillClick}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-muted/90 border border-border cursor-pointer active:scale-95 transition-all"
            title="Tap 5x to open GPS Debug Panel"
          >
            <div
              className={`w-2 h-2 rounded-full ${
                gpsQuality === "EXCELLENT"
                  ? "bg-primary"
                  : gpsQuality === "GOOD"
                  ? "bg-accent"
                  : "bg-warning animate-pulse"
              }`}
            />
            <span className="text-muted-foreground uppercase">
              GPS {gpsQuality} {gpsAccuracy ? `(±${gpsAccuracy}m)` : ""}
            </span>
            {gpsTapCount > 0 && (
              <span className="text-[9px] bg-primary/20 text-primary px-1 rounded font-bold">
                {gpsTapCount}/5
              </span>
            )}
          </button>

          {/* Activity Category Badge */}
          <span className="text-[11px] font-mono px-2 py-1 rounded-full bg-muted border border-border text-muted-foreground uppercase">
            {activityType}
          </span>
        </div>

        {/* Lock / Unlock Accidental Touch Toggle */}
        <button
          onClick={toggleLock}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono border transition-all cursor-pointer ${
            isLocked
              ? "bg-warning/20 border-warning text-warning font-bold animate-pulse"
              : "bg-muted border-border text-muted-foreground hover:text-foreground"
          }`}
          aria-label={isLocked ? "Unlock Screen" : "Lock Screen"}
        >
          {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          <span>{isLocked ? "LOCKED" : "LOCK"}</span>
        </button>
      </div>

      {/* GPS Warning Notice Banner */}
      {gpsNotice && (
        <div className="mx-4 mt-2 p-3 rounded-xl bg-warning/15 border border-warning/40 text-warning flex items-start gap-2.5 text-xs z-20">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-warning-foreground">{gpsNotice}</p>
            {gpsDebug.callbacksCount === 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Belum ada data GPS dari browser/HP. Pastikan izin lokasi aktif dan mode akurasi tinggi menyala.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Screen Lock Overlay */}
      {isLocked && (
        <div className="absolute inset-x-0 top-16 bottom-28 z-40 bg-background/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <div className="p-4 rounded-full bg-warning/20 text-warning mb-3">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Screen Locked</h2>
          <p className="text-xs text-muted-foreground max-w-xs mt-1">
            Controls are disabled to prevent accidental touches while running.
          </p>
          <button
            onClick={toggleLock}
            className="mt-6 px-6 py-2.5 rounded-xl bg-warning text-warning-foreground font-bold text-sm tracking-wide shadow-lg cursor-pointer"
          >
            Tap to Unlock
          </button>
        </div>
      )}

      {/* Main Metric HUD (Mobile-First Runner View) */}
      <div className="flex-1 px-4 py-3 flex flex-col justify-between max-w-xl mx-auto w-full">
        {/* Metric 1: Huge Pace */}
        <div className="text-center pt-2">
          <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground font-semibold">
            CURRENT PACE
          </span>
          <div className="text-6xl sm:text-7xl font-extrabold tracking-tighter tabular-nums text-foreground mt-1">
            {formatPace(currentPace, "METRIC", false)}
          </div>
          <span className="text-xs font-mono text-muted-foreground tracking-widest">
            MIN / KM
          </span>
        </div>

        {/* Secondary Metrics: Distance & Elapsed Time */}
        <div className="grid grid-cols-2 gap-4 py-4 my-2 border-y border-border/60">
          {/* Distance */}
          <div className="text-center border-r border-border/60 pr-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              DISTANCE
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-primary mt-0.5">
              {(distance / 1000).toFixed(2)}
            </div>
            <span className="text-xs font-mono text-muted-foreground">KILOMETERS</span>
          </div>

          {/* Time */}
          <div className="text-center pl-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              TIME
            </span>
            <div className="text-4xl sm:text-5xl font-extrabold tracking-tight tabular-nums text-foreground mt-0.5">
              {formatDuration(duration)}
            </div>
            <span className="text-xs font-mono text-muted-foreground">ELAPSED</span>
          </div>
        </div>

        {/* Average Pace & Speed row */}
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-mono pb-2">
          <div className="p-2 rounded-lg bg-card border border-border/60">
            <span className="text-muted-foreground block text-[10px]">AVG PACE</span>
            <span className="font-bold text-foreground text-sm tabular-nums">
              {formatPace(averagePace)}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-card border border-border/60">
            <span className="text-muted-foreground block text-[10px]">CURRENT SPEED</span>
            <span className="font-bold text-foreground text-sm tabular-nums">
              {(currentPosition?.speed ? currentPosition.speed * 3.6 : 0).toFixed(1)} km/h
            </span>
          </div>
        </div>

        {/* Dynamic Interval Engine Card */}
        {intervalSnapshot && intervalSnapshot.currentStep && (
          <div className="my-2 p-3.5 rounded-xl bg-card border border-primary/50 shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-primary tracking-wide uppercase font-mono">
                <Dumbbell className="w-4 h-4" />
                {intervalSnapshot.currentStep.label}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                Step {intervalSnapshot.currentStepIndex + 1}/{intervalSnapshot.totalSteps}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden my-2">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${Math.round(intervalSnapshot.stepProgress * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>
                {intervalSnapshot.currentStep.targetType === "DISTANCE"
                  ? `${(intervalSnapshot.stepElapsedDistance / 1000).toFixed(2)} / ${(
                      intervalSnapshot.currentStep.targetValue / 1000
                    ).toFixed(2)} km`
                  : `${formatDuration(intervalSnapshot.stepElapsedSeconds)} / ${formatDuration(
                      intervalSnapshot.currentStep.targetValue
                    )}`}
              </span>
              {intervalSnapshot.remainingDistance !== null && (
                <span className="text-foreground font-semibold">
                  Rem: {formatDistance(intervalSnapshot.remainingDistance)}
                </span>
              )}
            </div>

            {/* Next Step Preview & Skip */}
            <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                {intervalSnapshot.nextStep
                  ? `Next: ${intervalSnapshot.nextStep.label}`
                  : "Final interval step"}
              </span>
              <button
                type="button"
                onClick={manualAdvanceInterval}
                className="flex items-center gap-1 text-[11px] font-mono text-primary hover:underline cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5" />
                Skip Step
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Ghost Runner Card */}
        {ghostComparison && (
          <div
            className={`my-2 p-3.5 rounded-xl border shadow-md ${
              ghostComparison.isAhead
                ? "bg-primary/10 border-primary/50"
                : "bg-warning/10 border-warning/50"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1.5 text-xs font-bold font-mono tracking-wider">
                <Zap className="w-4 h-4 text-warning" />
                GHOST PACE COMPARISON
              </span>
              <span
                className={`text-xs font-bold font-mono ${
                  ghostComparison.isAhead ? "text-primary" : "text-warning"
                }`}
              >
                {ghostComparison.deltaText}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-2 pt-2 border-t border-border/40">
              <div>
                <span className="text-muted-foreground block text-[10px]">YOU</span>
                <span className="font-bold text-foreground">
                  {(ghostComparison.runnerDistanceMeters / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground block text-[10px]">GHOST</span>
                <span className="font-bold text-muted-foreground">
                  {(ghostComparison.ghostDistanceMeters / 1000).toFixed(2)} km
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Real-Time Live Map (Collapsible & Isolated) */}
        <div className="w-full my-2 relative" style={{ isolation: "isolate", zIndex: 0 }}>
          <div className="flex items-center justify-between px-1 mb-1.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Compass className="w-3 h-3 text-primary" />
              Route Map
            </span>
            <button
              type="button"
              onClick={() => setIsMapCollapsed((prev) => !prev)}
              className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 cursor-pointer bg-muted/60 px-2 py-0.5 rounded-md border border-border/40"
            >
              {isMapCollapsed ? (
                <>
                  <ChevronDown className="w-3 h-3" /> Show Map
                </>
              ) : (
                <>
                  <ChevronUp className="w-3 h-3" /> Hide Map
                </>
              )}
            </button>
          </div>

          {!isMapCollapsed && (
            <div className="h-36 sm:h-44 w-full transition-all duration-300">
              <RunMap
                points={points}
                currentPosition={currentPosition}
                interactive={true}
                className="w-full h-full rounded-xl"
              />
            </div>
          )}
        </div>
      </div>

      {/* Runner Controls Bar (Large High-Contrast Tap Targets) */}
      <div className="p-4 bg-card/90 backdrop-blur-md border-t border-border z-30">
        <div className="max-w-xl mx-auto flex items-center justify-around gap-4">
          {status === "RUNNING" ? (
            <button
              onClick={pauseRun}
              className="flex-1 py-4 rounded-xl bg-warning text-warning-foreground font-black text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Pause className="w-6 h-6 fill-current" />
              PAUSE
            </button>
          ) : (
            <button
              onClick={resumeRun}
              className="flex-1 py-4 rounded-xl bg-primary text-primary-foreground font-black text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-6 h-6 fill-current" />
              RESUME
            </button>
          )}

          {/* Finish Button */}
          <button
            onClick={() => setShowFinishModal(true)}
            className="flex-1 py-4 rounded-xl bg-destructive text-destructive-foreground font-black text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <Square className="w-5 h-5 fill-current" />
            FINISH
          </button>
        </div>
      </div>

      {/* Confirmation Modal (Isolation & High z-index to cover map completely) */}
      {showFinishModal && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
          style={{ isolation: "isolate" }}
        >
          <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-destructive/15 text-destructive mx-auto flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Finish Activity?</h3>
              <p className="text-xs text-muted-foreground mt-1">
                You ran {(distance / 1000).toFixed(2)} km in {formatDuration(duration)}.
                Are you ready to log and evaluate your performance?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowFinishModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Continue Running
              </button>
              <button
                onClick={handleConfirmFinish}
                className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-xs font-bold cursor-pointer"
              >
                Yes, Finish Run
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Run Journal Quick Modal */}
      {showJournalModal && (
        <div
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex items-center justify-center p-4"
          style={{ isolation: "isolate" }}
        >
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl space-y-5">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/20 text-primary mx-auto flex items-center justify-center mb-2">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-foreground">Run Saved!</h3>
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {formatDistance(distance)} &bull; {formatDuration(duration)} &bull;{" "}
                {formatPace(averagePace)}
              </p>
            </div>

            {/* Quick Feeling Rating */}
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground block mb-2">
                How did this run feel?
              </label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: "TERRIBLE", emoji: "😫", label: "Tough" },
                  { id: "TIRED", emoji: "😐", label: "Heavy" },
                  { id: "GOOD", emoji: "🙂", label: "Good" },
                  { id: "STRONG", emoji: "🔥", label: "Strong" },
                  { id: "UNSTOPPABLE", emoji: "🏆", label: "Great" },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFeeling(item.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all cursor-pointer ${
                      feeling === item.id
                        ? "bg-primary/20 border-primary scale-105"
                        : "bg-muted/40 border-border opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Energy & Leg Condition Slider */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
                  Energy ({energy}/5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={energy}
                  onChange={(e) => setEnergy(parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
              </div>
              <div>
                <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
                  Legs ({legCondition}/5)
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={legCondition}
                  onChange={(e) => setLegCondition(parseInt(e.target.value, 10))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
                Post-Run Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Weather, terrain, gear, or mindset notes..."
                rows={2}
                className="w-full p-2.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
            </div>

            <button
              onClick={handleSaveJournal}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-lg cursor-pointer"
            >
              VIEW FULL RUN ANALYTICS &rarr;
            </button>
          </div>
        </div>
      )}

      {/* GPS Debug Telemetry Panel (Toggled by 5x tap on GPS Status Pill) */}
      {showDebugPanel && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
          style={{ isolation: "isolate" }}
        >
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 shadow-2xl space-y-4 text-xs font-mono my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                <h3 className="text-sm font-bold text-foreground">GPS Telemetry Debugger</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDebugPanel(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close Debug Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Metrics Counter */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-muted/60 border border-border">
                <span className="text-[10px] text-muted-foreground block">CALLBACKS</span>
                <span className="text-xl font-black text-foreground tabular-nums">
                  {gpsDebug.callbacksCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/40">
                <span className="text-[10px] text-primary block font-semibold">ACCEPTED</span>
                <span className="text-xl font-black text-primary tabular-nums">
                  {gpsDebug.acceptedPointsCount}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/40">
                <span className="text-[10px] text-destructive block font-semibold">REJECTED</span>
                <span className="text-xl font-black text-destructive tabular-nums">
                  {gpsDebug.rejectedPointsCount}
                </span>
              </div>
            </div>

            {/* Rejection Reasons Breakdown */}
            <div className="p-3 rounded-xl bg-card border border-border/80 space-y-2">
              <div className="text-[11px] font-bold text-foreground tracking-wider uppercase border-b border-border/40 pb-1">
                Rejected Points by Reason
              </div>
              <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 text-[11px]">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Accuracy (&gt;50m):</span>
                  <span className="font-bold text-foreground">{gpsDebug.rejectedReasons.accuracy}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Speed (&gt;18m/s):</span>
                  <span className="font-bold text-foreground">{gpsDebug.rejectedReasons.speed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Duplicate Point:</span>
                  <span className="font-bold text-foreground">{gpsDebug.rejectedReasons.duplicate}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Stationary Jitter:</span>
                  <span className="font-bold text-foreground">{gpsDebug.rejectedReasons.stationary}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Invalid Order/Time:</span>
                  <span className="font-bold text-foreground">{gpsDebug.rejectedReasons.timestamp}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Invalid Coords:</span>
                  <span className="font-bold text-foreground">{gpsDebug.rejectedReasons.invalid}</span>
                </div>
              </div>
            </div>

            {/* Last Fix Realtime Telemetry */}
            <div className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-2 text-[11px]">
              <div className="text-[11px] font-bold text-foreground tracking-wider uppercase border-b border-border/40 pb-1">
                Last GPS Fix Telemetry
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-muted-foreground block text-[10px]">LAST ACCURACY</span>
                  <span className="font-bold text-foreground">
                    {gpsDebug.lastAccuracy !== null ? `±${gpsDebug.lastAccuracy.toFixed(1)} m` : "Waiting for fix..."}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">LAST SPEED</span>
                  <span className="font-bold text-foreground">
                    {gpsDebug.lastSpeedMps !== null
                      ? `${gpsDebug.lastSpeedMps.toFixed(2)} m/s (${(gpsDebug.lastSpeedMps * 3.6).toFixed(1)} km/h)`
                      : "0.0 m/s"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px]">COORDINATES</span>
                  <span className="font-bold text-foreground">
                    {gpsDebug.lastCoords
                      ? `${gpsDebug.lastCoords.latitude.toFixed(6)}, ${gpsDebug.lastCoords.longitude.toFixed(6)}`
                      : "No valid position yet"}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px]">LAST REJECTION REASON</span>
                  <span className="font-semibold text-warning">
                    {gpsDebug.lastRejectedReason || "None (All points valid)"}
                  </span>
                </div>
                {gpsDebug.watchError && (
                  <div className="col-span-2 p-2 rounded bg-destructive/15 text-destructive font-semibold">
                    Watch Error: {gpsDebug.watchError}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1">
              <span>Tap GPS pill 5x to hide</span>
              <button
                type="button"
                onClick={() => setShowDebugPanel(false)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold cursor-pointer hover:opacity-90"
              >
                Close Debug
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ActiveRunPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-foreground font-mono">
          Initializing GPS Tracker...
        </div>
      }
    >
      <ActiveRunTrackerContent />
    </Suspense>
  );
}
