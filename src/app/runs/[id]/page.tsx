"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/navigation/Header";
import BottomNav from "@/components/navigation/BottomNav";
import RunMap from "@/components/map";
import { formatDistance } from "@/lib/running/distance";
import { formatDuration, formatPace } from "@/lib/running/pace";
import { getCachedRunById } from "@/lib/storage/indexed-db";
import {
  ArrowLeft,
  Calendar,
  Clock,
  Compass,
  TrendingUp,
  Zap,
  Flame,
  Award,
  AlertTriangle,
  Dumbbell,
  MapPin,
  Trash2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function RunDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/runs/${id}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.run) {
          setData(res);
        } else {
          loadOfflineFallback();
        }
        setLoading(false);
      })
      .catch(() => {
        loadOfflineFallback();
        setLoading(false);
      });
  }, [id]);

  const loadOfflineFallback = async () => {
    const cached = await getCachedRunById(id);
    if (cached) {
      setData({ run: cached, analysis: null });
    }
  };

  const handleDelete = async () => {
    if (confirm("Delete this activity? This cannot be undone.")) {
      await fetch(`/api/runs/${id}`, { method: "DELETE" });
      router.push("/runs");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center font-mono text-xs">
        Loading run analytics...
      </div>
    );
  }

  const run = data?.run;
  const analysis = data?.analysis;

  if (!run) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6 text-center space-y-4">
        <h2 className="text-base font-bold">Activity not found</h2>
        <Link href="/runs" className="text-primary text-xs font-mono hover:underline">
          &larr; Back to Activities
        </Link>
      </div>
    );
  }

  // Prepare chart data from points
  const chartData = (run.points || [])
    .filter((_: any, idx: number) => idx % Math.max(1, Math.floor(run.points.length / 40)) === 0)
    .map((p: any) => ({
      distanceKm: (p.distanceFromStart / 1000).toFixed(2),
      paceMinutes: p.pace && p.pace > 120 && p.pace < 1200 ? +(p.pace / 60).toFixed(2) : null,
      altitude: p.altitude ? Math.round(p.altitude) : 10,
    }));

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-12">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-4 space-y-6">
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/runs"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Activities</span>
          </Link>

          <button
            onClick={handleDelete}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive font-mono cursor-pointer"
            title="Delete activity"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>

        {/* Activity Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {run.title}
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
              {run.activityType}
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            {new Date(run.startedAt).toLocaleDateString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {/* Hero Athletic Metrics Matrix */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl bg-card border border-border">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              DISTANCE
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-primary mt-1 tabular-nums">
              {formatDistance(run.distance)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              TIME
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground mt-1 tabular-nums">
              {formatDuration(run.duration)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              AVG PACE
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground mt-1 tabular-nums">
              {formatPace(run.averagePace)}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <span className="text-[10px] font-mono uppercase text-muted-foreground block">
              ELEVATION GAIN
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold font-mono text-foreground mt-1 tabular-nums">
              +{Math.round(run.elevationGain)}m
            </div>
          </div>
        </div>

        {/* Route Memory Insight (if recognized) */}
        {analysis?.routeComparison && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/40 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-primary">
                  Route Memory &bull; {analysis.routeComparison.routeName}
                </h4>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Run #{analysis.routeComparison.totalRunsOnRoute}
                </span>
              </div>
              <p className="text-xs text-foreground mt-1">
                {analysis.routeComparison.summaryMessage}
              </p>
            </div>
          </div>
        )}

        {/* Pacing Analysis Banner */}
        {analysis?.pacing && (
          <div className="p-4 rounded-xl bg-card border border-border space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold font-mono tracking-wider text-foreground flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-warning" />
                {analysis.pacing.headline}
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                Consistency: <strong className="text-foreground">{analysis.pacing.consistencyScore}%</strong>
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {analysis.pacing.description}
            </p>
          </div>
        )}

        {/* Struggle Diagnostic ('Why was this run bad?') */}
        {analysis?.diagnostic?.isStruggleRun && (
          <div className="p-4 rounded-xl bg-warning/10 border border-warning/40 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-warning font-mono uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4" />
              Session Difficulty Analysis
            </div>
            <p className="text-xs text-muted-foreground">
              Based on comparison with your historical averages, here are possible contributing factors for today:
            </p>
            <div className="space-y-1.5 mt-2">
              {analysis.diagnostic.factors.map((factor: any) => (
                <div key={factor.title} className="text-xs">
                  <strong className="text-foreground font-semibold">&bull; {factor.title}: </strong>
                  <span className="text-muted-foreground">{factor.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Map */}
        <div className="h-72 sm:h-96 w-full rounded-2xl overflow-hidden border border-border">
          <RunMap points={run.points || []} interactive={true} className="w-full h-full" />
        </div>

        {/* Charts: Pace over Distance & Elevation Profile */}
        {chartData.length > 5 && (
          <div className="space-y-4">
            {/* Elevation Profile Chart */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <span className="text-xs font-mono uppercase text-muted-foreground font-semibold block">
                Elevation Profile (m)
              </span>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="elevationGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="distanceKm"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(val) => `${val}k`}
                    />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit="m" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#161b22",
                        borderColor: "#30363d",
                        fontSize: 12,
                        borderRadius: 8,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="altitude"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#elevationGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Kilometer Splits Table */}
        {run.splits && run.splits.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              KILOMETER SPLITS
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground">
                    <th className="py-2.5 px-3">KM</th>
                    <th className="py-2.5 px-3">PACE</th>
                    <th className="py-2.5 px-3">TIME</th>
                    <th className="py-2.5 px-3">SPEED</th>
                    <th className="py-2.5 px-3 text-right">ELEVATION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {run.splits.map((split: any) => (
                    <tr key={split.splitNumber} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-bold text-foreground">
                        {split.splitNumber}
                        {split.isPartial ? " (rem)" : ""}
                      </td>
                      <td className="py-2 px-3 text-primary font-bold">
                        {formatPace(split.pace, "METRIC", false)}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {formatDuration(split.duration)}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {(split.averageSpeed * 3.6).toFixed(1)} km/h
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground">
                        {split.elevationChange > 0 ? `+${split.elevationChange}m` : `${split.elevationChange}m`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Interval Laps Table (If interval activity) */}
        {run.intervals && run.intervals.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
              <Dumbbell className="w-3.5 h-3.5 text-primary" />
              INTERVAL PERFORMANCE LAPS
            </h3>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/30 text-muted-foreground">
                    <th className="py-2.5 px-3">STEP</th>
                    <th className="py-2.5 px-3">TYPE</th>
                    <th className="py-2.5 px-3">ACTUAL DIST</th>
                    <th className="py-2.5 px-3">TIME</th>
                    <th className="py-2.5 px-3 text-right">LAP PACE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {run.intervals.map((iv: any, idx: number) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="py-2 px-3 font-semibold text-foreground">
                        {iv.targetLabel || `Lap ${idx + 1}`}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                          {iv.stepType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        {formatDistance(iv.actualDistance)}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {formatDuration(iv.actualDuration)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-primary">
                        {formatPace(iv.averagePace, "METRIC", false)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Post-Run Journal Snapshot */}
        {(run.feeling || run.journal || run.notes) && (
          <div className="p-4 rounded-xl bg-card border border-border space-y-2">
            <h3 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              RUN JOURNAL SNAPSHOT
            </h3>
            <div className="flex items-center gap-4 text-xs font-mono pt-1">
              {run.feeling && (
                <span>
                  Feeling:{" "}
                  <strong className="text-foreground">
                    {run.feeling === "STRONG"
                      ? "🔥 Strong"
                      : run.feeling === "UNSTOPPABLE"
                      ? "🏆 Great"
                      : run.feeling === "GOOD"
                      ? "🙂 Good"
                      : run.feeling === "TIRED"
                      ? "😐 Heavy"
                      : "😫 Tough"}
                  </strong>
                </span>
              )}
              {run.energy && (
                <span>
                  Energy: <strong className="text-foreground">{run.energy}/5</strong>
                </span>
              )}
              {run.legCondition && (
                <span>
                  Leg Condition: <strong className="text-foreground">{run.legCondition}/5</strong>
                </span>
              )}
            </div>
            {run.notes && (
              <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">
                &ldquo;{run.notes}&rdquo;
              </p>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
