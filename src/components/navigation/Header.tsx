"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { syncEngine, GlobalSyncStatus } from "@/lib/storage/sync-engine";
import { Activity, CloudCheck, CloudOff, RefreshCw, AlertCircle, Play } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const [syncStatus, setSyncStatus] = useState<GlobalSyncStatus>("IDLE");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((status, count) => {
      setSyncStatus(status);
      setPendingCount(count);
    });
    return unsubscribe;
  }, []);

  if (pathname === "/run/active") {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full bg-card/90 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all">
            <Activity className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wider text-base text-foreground leading-none">
              VIPERA<span className="text-primary font-normal ml-1">RUN</span>
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-widest leading-none mt-1">
              Personal Tracker
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link
            href="/"
            className={`transition-colors hover:text-foreground ${
              pathname === "/" ? "text-primary font-semibold" : ""
            }`}
          >
            Dashboard
          </Link>
          <Link
            href="/runs"
            className={`transition-colors hover:text-foreground ${
              pathname.startsWith("/runs") ? "text-primary font-semibold" : ""
            }`}
          >
            Activities
          </Link>
          <Link
            href="/workouts"
            className={`transition-colors hover:text-foreground ${
              pathname.startsWith("/workouts") ? "text-primary font-semibold" : ""
            }`}
          >
            Intervals
          </Link>
          <Link
            href="/profile"
            className={`transition-colors hover:text-foreground ${
              pathname === "/profile" ? "text-primary font-semibold" : ""
            }`}
          >
            Profile
          </Link>
        </nav>

        {/* Right Action: Sync Status & Quick Start */}
        <div className="flex items-center gap-3">
          {/* Sync Pill */}
          <button
            onClick={() => syncEngine.processQueue()}
            title="Click to trigger manual sync"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono bg-muted border border-border/80 transition-colors hover:bg-muted/80 cursor-pointer"
          >
            {syncStatus === "SYNCING" && (
              <>
                <RefreshCw className="w-3 h-3 text-warning animate-spin" />
                <span className="text-warning text-[11px]">Syncing {pendingCount > 0 ? `(${pendingCount})` : ""}</span>
              </>
            )}
            {syncStatus === "OFFLINE" && (
              <>
                <CloudOff className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground text-[11px]">Offline</span>
              </>
            )}
            {syncStatus === "FAILED" && (
              <>
                <AlertCircle className="w-3 h-3 text-destructive" />
                <span className="text-destructive text-[11px]">Retry ({pendingCount})</span>
              </>
            )}
            {(syncStatus === "SYNCED" || syncStatus === "IDLE") && (
              <>
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-muted-foreground text-[11px]">Ready</span>
              </>
            )}
          </button>

          {/* Start Run Button */}
          <Link
            href="/run/start"
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs tracking-wide shadow-md shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            START RUN
          </Link>
        </div>
      </div>
    </header>
  );
}
