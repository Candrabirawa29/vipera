"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/navigation/Header";
import BottomNav from "@/components/navigation/BottomNav";
import { WORKOUT_PRESETS, IntervalWorkoutTemplate } from "@/lib/presets/workout-presets";
import { formatStepType } from "@/lib/running/interval-engine";
import { formatDuration } from "@/lib/running/pace";
import { formatDistance } from "@/lib/running/distance";
import {
  Dumbbell,
  Play,
  Plus,
  Trash2,
  ChevronRight,
  Flame,
  CheckCircle2,
} from "lucide-react";

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<IntervalWorkoutTemplate[]>(WORKOUT_PRESETS);
  const [filter, setFilter] = useState<string>("ALL");

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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Delete this custom workout?")) {
      await fetch(`/api/workouts/${id}`, { method: "DELETE" });
      setWorkouts((prev) => prev.filter((w) => w.id !== id));
    }
  };

  const filtered = workouts.filter((w) => {
    if (filter === "PRESET") return w.isPreset;
    if (filter === "CUSTOM") return !w.isPreset;
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-12">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* Title & Create CTA */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Interval Training
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Structured workouts &bull; Real-time voice cues &bull; Automatic lap splits
            </p>
          </div>

          <Link
            href="/workouts/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs tracking-wide shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Workout
          </Link>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2">
          {["ALL", "PRESET", "CUSTOM"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-mono transition-colors cursor-pointer ${
                filter === f
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground border border-border/60"
              }`}
            >
              {f === "ALL" ? "All Workouts" : f === "PRESET" ? "Presets" : "Custom Built"}
            </button>
          ))}
        </div>

        {/* Workouts Grid */}
        <div className="space-y-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              className="p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">{w.title}</h3>
                    {w.isPreset ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border/80 text-muted-foreground">
                        Preset
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {w.description}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!w.isPreset && (
                    <button
                      onClick={(e) => handleDelete(w.id, e)}
                      className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Delete workout"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <Link
                    href={`/run/active?mode=INTERVAL&workoutId=${w.id}`}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    START
                  </Link>
                </div>
              </div>

              {/* Step Sequence Chips */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/40 text-xs font-mono">
                {w.steps.map((step, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-muted/60 border border-border/60 text-[11px] text-foreground flex items-center gap-1"
                  >
                    <span className="text-muted-foreground font-normal">
                      {formatStepType(step.stepType)}:
                    </span>
                    <strong>
                      {step.targetType === "DISTANCE"
                        ? formatDistance(step.targetValue)
                        : formatDuration(step.targetValue)}
                    </strong>
                    {step.repeatCount && step.repeatCount > 1 && (
                      <span className="text-primary font-bold ml-0.5">
                        &times;{step.repeatCount}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
