"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/navigation/Header";
import BottomNav from "@/components/navigation/BottomNav";
import UnfinishedRunAlert from "@/components/run/UnfinishedRunAlert";
import { formatDistance } from "@/lib/running/distance";
import { formatDuration, formatPace } from "@/lib/running/pace";
import {
  Play,
  Dumbbell,
  History,
  TrendingUp,
  Award,
  Target,
  Zap,
  Flame,
  ArrowRight,
  Calendar,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/athlete")
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load athlete summary:", err);
        setLoading(false);
      });
  }, []);

  const trainingLoad = data?.trainingLoad;
  const fingerprint = data?.fingerprint;
  const records = data?.personalRecords || [];
  const goals = data?.goals || [];
  const recentRuns = data?.recentRuns || [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-12">
      <Header />
      <UnfinishedRunAlert />

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Hero Athlete Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
                Welcome back, {data?.user?.name || "Runner"}
              </h1>
              {trainingLoad?.currentStreakDays > 0 && (
                <span className="flex items-center gap-1 text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  {trainingLoad.currentStreakDays}d Streak
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {fingerprint?.archetype || "Athlete"} &bull; Ready for your next session
            </p>
          </div>

          {/* Quick Action Launchers */}
          <div className="flex items-center gap-2">
            <Link
              href="/run/start"
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase tracking-wider shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
            >
              <Play className="w-4 h-4 fill-current" />
              START RUN
            </Link>
            <Link
              href="/workouts"
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-border text-foreground font-medium text-xs hover:bg-muted transition-colors"
            >
              <Dumbbell className="w-4 h-4 text-primary" />
              Intervals
            </Link>
          </div>
        </div>

        {/* Training Load & Weekly Volume */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              TRAINING LOAD
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {trainingLoad ? formatDistance(trainingLoad.thisMonthDistanceMeters) : "0 km"} this month
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* This Week */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                THIS WEEK
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-foreground mt-1">
                {trainingLoad ? (trainingLoad.thisWeekDistanceMeters / 1000).toFixed(1) : "0.0"}
                <span className="text-xs font-mono font-normal text-muted-foreground ml-1">km</span>
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs font-mono">
                {trainingLoad?.percentageChange !== undefined && (
                  <span
                    className={
                      trainingLoad.percentageChange >= 0 ? "text-primary" : "text-muted-foreground"
                    }
                  >
                    {trainingLoad.percentageChange >= 0 ? "+" : ""}
                    {trainingLoad.percentageChange}% vs last week
                  </span>
                )}
              </div>
            </div>

            {/* Last Week */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                LAST WEEK
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-muted-foreground mt-1">
                {trainingLoad ? (trainingLoad.lastWeekDistanceMeters / 1000).toFixed(1) : "0.0"}
                <span className="text-xs font-mono font-normal text-muted-foreground ml-1">km</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Previous 7 days base</p>
            </div>

            {/* Recent Pace Trend */}
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                RECENT PACE TREND
              </span>
              <div className="text-2xl sm:text-3xl font-extrabold tabular-nums text-foreground mt-1">
                {trainingLoad?.recentPaceTrendSecPerKm
                  ? formatPace(trainingLoad.recentPaceTrendSecPerKm, "METRIC", false)
                  : "--:--"}
                <span className="text-xs font-mono font-normal text-muted-foreground ml-1">/km</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">Average of last 3 runs</p>
            </div>
          </div>

          {/* Spike Warning if acute load jumps > 30% */}
          {trainingLoad?.isSpikeWarning && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/40 text-xs flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                Training load spike (+{trainingLoad.percentageChange}%). Keep recovery easy to prevent fatigue accumulation.
              </span>
            </div>
          )}
        </section>

        {/* 2-Column Section: Running Fingerprint & Personal Records */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Running Fingerprint */}
          <section className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-primary" />
                  Running Fingerprint
                </h3>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Archetype: <strong className="text-foreground">{fingerprint?.archetype}</strong>
                </span>
              </div>
              <div className="text-right">
                <span className="text-lg font-black font-mono text-primary tabular-nums">
                  {fingerprint?.overallScore || 70}
                </span>
                <span className="text-[10px] text-muted-foreground block font-mono">INDEX</span>
              </div>
            </div>

            {/* Trait Bars */}
            <div className="space-y-2.5">
              {[
                { label: "Endurance", value: fingerprint?.endurance || 65 },
                { label: "Speed Velocity", value: fingerprint?.speed || 60 },
                { label: "Weekly Consistency", value: fingerprint?.consistency || 80 },
                { label: "Pacing Discipline", value: fingerprint?.pacing || 75 },
                { label: "Hill Ability", value: fingerprint?.hillAbility || 55 },
              ].map((trait) => (
                <div key={trait.label}>
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-muted-foreground">{trait.label}</span>
                    <span className="text-foreground font-semibold">{trait.value}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary/90 rounded-full transition-all duration-500"
                      style={{ width: `${trait.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[11px] text-muted-foreground italic border-t border-border/50 pt-2">
              &ldquo;{fingerprint?.summary}&rdquo;
            </p>
          </section>

          {/* Personal Records */}
          <section className="p-5 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Award className="w-4 h-4 text-warning" />
                Personal Records (PR)
              </h3>
              <Link href="/profile" className="text-xs text-primary font-mono hover:underline">
                View All
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {records.slice(0, 4).map((pr: any) => (
                <div key={pr.category} className="p-3 rounded-xl bg-muted/40 border border-border/60">
                  <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                    {pr.label || pr.category.replace("FASTEST_", "").replace("_", " ")}
                  </span>
                  <div className="text-lg font-bold font-mono text-foreground mt-0.5 tabular-nums">
                    {pr.formattedValue ||
                      (pr.value > 1000
                        ? `${(pr.value / 1000).toFixed(2)} km`
                        : formatDuration(pr.value))}
                  </div>
                </div>
              ))}
            </div>

            {/* Active Goal Progress */}
            {goals.length > 0 && (
              <div className="border-t border-border/50 pt-3 space-y-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  Target Goal
                </span>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>{goals[0].title}</span>
                    <span className="font-mono text-primary">
                      {Math.round((goals[0].currentValue / goals[0].targetValue) * 100)}%
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-muted overflow-hidden mt-2">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.round((goals[0].currentValue / goals[0].targetValue) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Recent Runs List */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              RECENT ACTIVITIES
            </h2>
            <Link
              href="/runs"
              className="text-xs text-primary font-mono flex items-center gap-1 hover:underline"
            >
              All Activities <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2.5">
            {recentRuns.map((run: any) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-2">
                      {run.title}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {run.activityType}
                      </span>
                    </h4>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {new Date(run.startedAt).toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-extrabold font-mono text-foreground tabular-nums">
                      {formatDistance(run.distance)}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground block">
                      {formatDuration(run.duration)} &bull; {formatPace(run.averagePace)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
