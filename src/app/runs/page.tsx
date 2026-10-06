"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/navigation/Header";
import BottomNav from "@/components/navigation/BottomNav";
import { formatDistance } from "@/lib/running/distance";
import { formatDuration, formatPace } from "@/lib/running/pace";
import { getCachedCompletedRuns } from "@/lib/storage/indexed-db";
import {
  Search,
  Filter,
  History,
  ArrowRight,
  TrendingUp,
  Clock,
  Compass,
  ChevronRight,
  Flame,
} from "lucide-react";

export default function RunsHistoryPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState("ALL");

  useEffect(() => {
    // Fetch from API first, with fallback to IndexedDB cache
    fetch("/api/runs")
      .then((res) => res.json())
      .then((data) => {
        if (data.runs && data.runs.length > 0) {
          setRuns(data.runs);
        } else {
          loadOfflineCache();
        }
        setLoading(false);
      })
      .catch(() => {
        loadOfflineCache();
        setLoading(false);
      });
  }, []);

  const loadOfflineCache = async () => {
    const cached = await getCachedCompletedRuns();
    if (cached.length > 0) {
      setRuns(cached);
    }
  };

  const filteredRuns = runs.filter((run) => {
    const matchesSearch =
      !search ||
      run.title.toLowerCase().includes(search.toLowerCase()) ||
      (run.route?.name && run.route.name.toLowerCase().includes(search.toLowerCase()));

    const matchesType =
      activityFilter === "ALL" || run.activityType === activityFilter;

    return matchesSearch && matchesType;
  });

  const totalDistance = runs.reduce((acc, r) => acc + (r.distance || 0), 0);
  const totalDuration = runs.reduce((acc, r) => acc + (r.duration || 0), 0);

  const categories = [
    { id: "ALL", label: "All" },
    { id: "RUN", label: "Standard" },
    { id: "INTERVAL", label: "Intervals" },
    { id: "TEMPO", label: "Tempo" },
    { id: "LONG_RUN", label: "Long Run" },
    { id: "EASY_RUN", label: "Easy" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-12">
      <Header />

      <main className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        {/* Title & All-Time Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Activity Log
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              {runs.length} recorded activities &bull; Fully synced & locally cached
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 rounded-xl bg-card border border-border text-center">
              <span className="text-[10px] font-mono text-muted-foreground block">
                TOTAL DISTANCE
              </span>
              <span className="text-sm font-bold font-mono text-primary tabular-nums">
                {formatDistance(totalDistance)}
              </span>
            </div>
            <div className="px-3.5 py-1.5 rounded-xl bg-card border border-border text-center">
              <span className="text-[10px] font-mono text-muted-foreground block">
                TOTAL TIME
              </span>
              <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                {formatDuration(totalDuration)}
              </span>
            </div>
          </div>
        </div>

        {/* Filter Bar & Search */}
        <div className="space-y-2">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by title, location, or route..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary font-mono"
            />
          </div>

          {/* Activity Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActivityFilter(c.id)}
                className={`px-3 py-1 rounded-full text-xs font-mono whitespace-nowrap transition-colors cursor-pointer ${
                  activityFilter === c.id
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/70 text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Runs List */}
        <div className="space-y-3">
          {filteredRuns.length === 0 ? (
            <div className="p-8 text-center rounded-2xl bg-card border border-border space-y-3">
              <Compass className="w-8 h-8 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-semibold text-foreground">
                No matching runs found
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                {runs.length === 0
                  ? "Your first run starts here. Head out and record your inaugural session!"
                  : "Try clearing your search filter to see more activities."}
              </p>
              {runs.length === 0 && (
                <Link
                  href="/run/start"
                  className="inline-block mt-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
                >
                  Start First Run
                </Link>
              )}
            </div>
          ) : (
            filteredRuns.map((run) => (
              <Link
                key={run.id}
                href={`/runs/${run.id}`}
                className="block p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                        {run.title}
                      </h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-muted border border-border/80 text-muted-foreground">
                        {run.activityType}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                      <span>
                        {new Date(run.startedAt).toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      {run.route?.name && (
                        <>
                          <span>&bull;</span>
                          <span className="text-foreground/80">{run.route.name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-extrabold font-mono text-foreground tabular-nums">
                      {formatDistance(run.distance)}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {formatDuration(run.duration)} &bull; {formatPace(run.averagePace)}
                    </div>
                  </div>
                </div>

                {/* Sub-bar metrics */}
                <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <div className="flex items-center gap-3">
                    {run.elevationGain > 0 && (
                      <span>+{Math.round(run.elevationGain)}m elev</span>
                    )}
                    {run.calories > 0 && <span>{run.calories} kcal</span>}
                    {run.feeling && (
                      <span className="text-foreground">
                        Feeling:{" "}
                        {run.feeling === "STRONG"
                          ? "🔥 Strong"
                          : run.feeling === "UNSTOPPABLE"
                          ? "🏆 Great"
                          : run.feeling === "GOOD"
                          ? "🙂 Good"
                          : run.feeling === "TIRED"
                          ? "😐 Heavy"
                          : "😫 Tough"}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
