"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/navigation/Header";
import BottomNav from "@/components/navigation/BottomNav";
import { StepType, TargetType } from "@/lib/running/interval-engine";
import { ArrowLeft, Plus, Trash2, Dumbbell, GripVertical } from "lucide-react";

interface FormStep {
  order: number;
  stepType: StepType;
  targetType: TargetType;
  targetValue: number; // meters or seconds
  repeatCount: number;
  groupIndex?: number | null;
  label: string;
  notes?: string;
}

export default function NewWorkoutPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState<FormStep[]>([
    {
      order: 1,
      stepType: "WARMUP",
      targetType: "DURATION",
      targetValue: 600, // 10 mins
      repeatCount: 1,
      label: "Warm Up Jog",
    },
    {
      order: 2,
      stepType: "RUN",
      targetType: "DISTANCE",
      targetValue: 400,
      repeatCount: 6,
      groupIndex: 1,
      label: "Fast Run",
    },
    {
      order: 3,
      stepType: "RECOVERY",
      targetType: "DISTANCE",
      targetValue: 200,
      repeatCount: 6,
      groupIndex: 1,
      label: "Jog Recovery",
    },
    {
      order: 4,
      stepType: "COOLDOWN",
      targetType: "DURATION",
      targetValue: 300, // 5 mins
      repeatCount: 1,
      label: "Cool Down",
    },
  ]);

  const [submitting, setSubmitting] = useState(false);

  const addStep = (type: StepType) => {
    const isDuration = type === "WARMUP" || type === "COOLDOWN" || type === "REST";
    setSteps((prev) => [
      ...prev,
      {
        order: prev.length + 1,
        stepType: type,
        targetType: isDuration ? "DURATION" : "DISTANCE",
        targetValue: isDuration ? 300 : 400,
        repeatCount: 1,
        groupIndex: null,
        label: `${type.charAt(0) + type.slice(1).toLowerCase()} Step`,
      },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const updateStep = (index: number, updates: Partial<FormStep>) => {
    setSteps((prev) =>
      prev.map((s, idx) => (idx === index ? { ...s, ...updates } : s))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert("Please provide a workout title");
      return;
    }
    if (steps.length === 0) {
      alert("Please add at least one step");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          steps: steps.map((s, idx) => ({ ...s, order: idx + 1 })),
        }),
      });

      if (res.ok) {
        router.push("/workouts");
      } else {
        const err = await res.json();
        alert(err.error || "Failed to create workout");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save workout");
    } finally {
      setSubmitting(false);
    }
  };

  const stepTypeOptions: StepType[] = [
    "WARMUP",
    "RUN",
    "RECOVERY",
    "WALK",
    "REST",
    "COOLDOWN",
    "FREE_RUN",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-12">
      <Header />

      <main className="max-w-3xl mx-auto px-4 pt-4 space-y-6">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Link
            href="/workouts"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-primary" />
              Build Interval Workout
            </h1>
            <p className="text-xs text-muted-foreground font-mono">
              Design custom repeat groups, distance targets, and recovery segments.
            </p>
          </div>

          {/* Basic Details */}
          <div className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
                Workout Name *
              </label>
              <input
                type="text"
                placeholder="e.g. 8x400m Mile Pace Intervals"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground block mb-1">
                Description / Purpose
              </label>
              <textarea
                placeholder="Notes on target pacing, heart rate zone, or purpose..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Workout Steps */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                STEP SEQUENCE ({steps.length} STEPS)
              </h3>
            </div>

            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-card border border-border space-y-3 relative group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono text-muted-foreground font-bold">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) => updateStep(idx, { label: e.target.value })}
                        placeholder="Step label..."
                        className="px-2 py-1 rounded bg-transparent border-b border-border/80 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
                      title="Remove step"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Step Configuration Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    {/* Step Type */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        TYPE
                      </label>
                      <select
                        value={step.stepType}
                        onChange={(e) =>
                          updateStep(idx, { stepType: e.target.value as StepType })
                        }
                        className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-xs font-mono"
                      >
                        {stepTypeOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Target Unit (Distance vs Duration) */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        TARGET BY
                      </label>
                      <select
                        value={step.targetType}
                        onChange={(e) => {
                          const newType = e.target.value as TargetType;
                          updateStep(idx, {
                            targetType: newType,
                            targetValue: newType === "DISTANCE" ? 400 : 300,
                          });
                        }}
                        className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-xs font-mono"
                      >
                        <option value="DISTANCE">Distance (meters)</option>
                        <option value="DURATION">Duration (seconds)</option>
                      </select>
                    </div>

                    {/* Target Value */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        TARGET VALUE
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={step.targetValue}
                        onChange={(e) =>
                          updateStep(idx, { targetValue: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-xs font-mono"
                      />
                    </div>

                    {/* Repeat Count */}
                    <div>
                      <label className="text-[10px] text-muted-foreground block mb-0.5">
                        REPEAT COUNT
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={step.repeatCount}
                        onChange={(e) =>
                          updateStep(idx, {
                            repeatCount: parseInt(e.target.value, 10) || 1,
                          })
                        }
                        className="w-full p-2 rounded-lg bg-muted border border-border text-foreground text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Add Step Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => addStep("RUN")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                Add Run Interval
              </button>
              <button
                type="button"
                onClick={() => addStep("RECOVERY")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                Add Recovery Jog
              </button>
              <button
                type="button"
                onClick={() => addStep("COOLDOWN")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-primary" />
                Add Cool Down
              </button>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm tracking-wide shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? "Saving Workout..." : "Save Workout Template"}
            </button>
          </div>
        </form>
      </main>

      <BottomNav />
    </div>
  );
}
