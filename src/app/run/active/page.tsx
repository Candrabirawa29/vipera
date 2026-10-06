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
          {/* GPS Signal Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-muted/90 border border-border">
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
          </div>

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

        {/* Real-Time Live Map */}
        <div className="h-44 sm:h-52 w-full my-2">
          <RunMap
            points={points}
            currentPosition={currentPosition}
            interactive={false}
            className="w-full h-full rounded-xl"
          />
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

      {/* Confirmation Modal */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
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
        <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-center justify-center p-4">
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
