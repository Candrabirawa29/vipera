"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { WORKOUT_PRESETS, IntervalWorkoutTemplate } from "@/lib/presets/workout-presets";
import { Play, Dumbbell, Zap, Ghost, Compass, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function StartRunPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"NORMAL" | "INTERVAL" | "GHOST">("NORMAL");
  const [activityType, setActivityType] = useState<string>("RUN");
  const [workouts, setWorkouts] = useState<IntervalWorkoutTemplate[]>(WORKOUT_PRESETS);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string>(WORKOUT_PRESETS[0].id);
  const [ghostSource, setGhostSource] = useState<string>("BEST_5K");

  // Fetch custom workouts if any
  useEffect(() => {
    fetch("/api/workouts")
      .then((res) => res.json())
      .then((data) => {
        if (data.workouts && data.workouts.length > 0) {
          setWorkouts(data.workouts);
        }
      })
      .catch(() => {});
  }, []);

  const handleLaunchRun = () => {
    const params = new URLSearchParams();
    params.set("mode", mode);
    params.set("type", activityType);

    if (mode === "INTERVAL") {
      params.set("workoutId", selectedWorkoutId);
    } else if (mode === "GHOST") {
      params.set("ghostSource", ghostSource);
    }

    router.push(`/run/active?${params.toString()}`);
  };

  const activityTypes = [
    { id: "RUN", label: "Standard Run" },
    { id: "TEMPO", label: "Tempo" },
    { id: "LONG_RUN", label: "Long Run" },
    { id: "EASY_RUN", label: "Easy Run" },
    { id: "WALK", label: "Walk / Hike" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <h1 className="text-sm font-bold uppercase tracking-wider font-mono">
          Ready to Run
        </h1>
        <div className="w-12" />
      </div>

      <main className="max-w-xl mx-auto px-4 pt-4 space-y-6">
        {/* Mode Selector Tabs */}
        <div>
          <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider mb-2 block">
            Session Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setMode("NORMAL")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                mode === "NORMAL"
                  ? "bg-primary/15 border-primary text-primary font-bold shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Compass className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Free Run</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("INTERVAL")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                mode === "INTERVAL"
                  ? "bg-primary/15 border-primary text-primary font-bold shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Dumbbell className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Interval</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("GHOST")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer ${
                mode === "GHOST"
                  ? "bg-primary/15 border-primary text-primary font-bold shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Ghost className="w-5 h-5 mb-1.5" />
              <span className="text-xs">Ghost Pace</span>
            </button>
          </div>
        </div>

        {/* Free Run Activity Type */}
        {mode === "NORMAL" && (
          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider mb-2 block">
              Activity Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {activityTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setActivityType(type.id)}
                  className={`px-3 py-2.5 rounded-lg border text-xs font-medium text-left transition-colors cursor-pointer ${
                    activityType === type.id
                      ? "bg-primary/15 border-primary text-primary"
                      : "bg-card border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interval Workout Picker */}
        {mode === "INTERVAL" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block">
                Select Interval Workout
              </label>
              <Link
                href="/workouts/new"
                className="text-xs text-primary hover:underline font-mono"
              >
                + Custom Workout
              </Link>
            </div>

            <div className="space-y-2">
              {workouts.map((w) => (
                <div
                  key={w.id}
                  onClick={() => setSelectedWorkoutId(w.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    selectedWorkoutId === w.id
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-card border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        {w.title}
                        {w.isPreset && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                            Preset
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {w.description}
                      </p>
                    </div>
                    {selectedWorkoutId === w.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 ml-2" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                    <span>{w.steps.length} Steps</span>
                    <span>&bull;</span>
                    <span>Audio & Vibration Cues Enabled</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ghost Runner Selection */}
        {mode === "GHOST" && (
          <div className="space-y-3">
            <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block">
              Select Your Ghost Target
            </label>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ghost Runner lets you compete live against your own past performances. As you run, your distance is compared in real-time against your ghost.
            </p>

            <div className="space-y-2">
              {[
                {
                  id: "BEST_5K",
                  title: "Personal Best 5K (26:15)",
                  desc: "Pace: 5:15 /km &bull; Target your all-time fastest 5K benchmark.",
                },
                {
                  id: "LAST_RUN",
                  title: "Previous Run (5.04 km in 26:30)",
                  desc: "Pace: 5:18 /km &bull; Beat your most recent session on this route.",
                },
                {
                  id: "ROUTE_AVERAGE",
                  title: "Route Average (27:00)",
                  desc: "Pace: 5:24 /km &bull; Run faster than your historical average.",
                },
              ].map((g) => (
                <div
                  key={g.id}
                  onClick={() => setGhostSource(g.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    ghostSource === g.id
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-card border-border hover:border-border/80"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-warning" />
                        {g.title}
                      </h4>
                      <p
                        className="text-xs text-muted-foreground mt-1"
                        dangerouslySetInnerHTML={{ __html: g.desc }}
                      />
                    </div>
                    {ghostSource === g.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0 ml-2" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Big Athletic Launch Button */}
        <div className="pt-4">
          <button
            type="button"
            onClick={handleLaunchRun}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-extrabold text-base tracking-wider uppercase flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Play className="w-5 h-5 fill-current" />
            START RECORDING
          </button>
          <p className="text-center text-[11px] text-muted-foreground font-mono mt-2">
            GPS filtering, audio guidance, and offline IndexedDB recording active
          </p>
        </div>
      </main>
    </div>
  );
}
