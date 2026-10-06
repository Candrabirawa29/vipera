"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/navigation/Header";
import BottomNav from "@/components/navigation/BottomNav";
import { formatDuration } from "@/lib/running/pace";
import { formatDistance } from "@/lib/running/distance";
import {
  User,
  Settings,
  Award,
  Zap,
  MapPin,
  Volume2,
  Vibrate,
  Shield,
  Smartphone,
  CheckCircle,
} from "lucide-react";

export default function ProfilePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Settings State
  const [voiceCues, setVoiceCues] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [screenWake, setScreenWake] = useState(true);
  const [unitSystem, setUnitSystem] = useState("METRIC");
  const [savedMessage, setSavedMessage] = useState(false);

  useEffect(() => {
    fetch("/api/athlete")
      .then((res) => res.json())
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSaveSettings = () => {
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2500);
  };

  const records = data?.personalRecords || [];
  const fingerprint = data?.fingerprint;
  const routes = data?.routes || [];

  return (
    <div className="min-h-screen bg-background text-foreground pb-24 sm:pb-12">
      <Header />

      <main className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        {/* User Badge */}
        <div className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-extrabold text-lg">
              AR
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-foreground">
                {data?.user?.name || "Alex Rivers"}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {data?.user?.email || "runner@vipera.local"} &bull; Dedicated Runner
              </p>
            </div>
          </div>

          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/30">
            {fingerprint?.archetype || "Athlete"}
          </span>
        </div>

        {/* Personal Records Hall of Fame */}
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-warning" />
            PERSONAL BESTS
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Fastest 1K", val: "4:09", pace: "4:09 /km" },
              { label: "Fastest 3K", val: "15:15", pace: "5:05 /km" },
              { label: "Fastest 5K", val: "26:15", pace: "5:15 /km" },
              { label: "Fastest 10K", val: "59:00", pace: "5:54 /km" },
              { label: "Longest Run", val: "10.25 km", pace: "5:45 /km" },
              { label: "Fastest Avg Pace", val: "5:15 /km", pace: "3K+ threshold" },
            ].map((pr) => (
              <div key={pr.label} className="p-4 rounded-xl bg-card border border-border">
                <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                  {pr.label}
                </span>
                <div className="text-xl font-black font-mono text-foreground mt-0.5 tabular-nums">
                  {pr.val}
                </div>
                <span className="text-[11px] font-mono text-primary mt-1 block">
                  {pr.pace}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Recognized Routes Library */}
        <section className="space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-primary" />
            ROUTE MEMORY CATALOG
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                name: "City Sports Loop",
                runs: 4,
                bestTime: "26:30",
                avgTime: "27:10",
                distance: "5.04 km",
              },
              {
                name: "River Trail Path",
                runs: 3,
                bestTime: "25:40",
                avgTime: "26:05",
                distance: "4.12 km",
              },
            ].map((route) => (
              <div key={route.name} className="p-4 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-start justify-between">
                  <h4 className="text-sm font-bold text-foreground">{route.name}</h4>
                  <span className="text-xs font-mono text-muted-foreground">{route.distance}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1 text-muted-foreground">
                  <div>
                    <span className="text-[10px] block">RUNS</span>
                    <strong className="text-foreground">{route.runs}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] block">BEST</span>
                    <strong className="text-primary">{route.bestTime}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] block">AVG</span>
                    <strong className="text-foreground">{route.avgTime}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Application Preferences & Device Controls */}
        <section className="p-5 rounded-2xl bg-card border border-border space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Settings className="w-4 h-4 text-primary" />
              Tracker Preferences
            </h2>
            {savedMessage && (
              <span className="text-xs font-mono text-primary flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Preferences saved
              </span>
            )}
          </div>

          <div className="space-y-4 divide-y divide-border/50 text-xs">
            {/* Unit System */}
            <div className="pt-2 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Measurement Units</span>
                <span className="text-muted-foreground">Kilometers or Miles</span>
              </div>
              <div className="flex rounded-lg bg-muted p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setUnitSystem("METRIC")}
                  className={`px-3 py-1 rounded-md text-xs font-mono cursor-pointer ${
                    unitSystem === "METRIC" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  Metric (km)
                </button>
                <button
                  type="button"
                  onClick={() => setUnitSystem("IMPERIAL")}
                  className={`px-3 py-1 rounded-md text-xs font-mono cursor-pointer ${
                    unitSystem === "IMPERIAL" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"
                  }`}
                >
                  Miles (mi)
                </button>
              </div>
            </div>

            {/* Voice Cues */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Spoken Voice Cues</span>
                <span className="text-muted-foreground">Audio cues for intervals, countdowns, and splits</span>
              </div>
              <input
                type="checkbox"
                checked={voiceCues}
                onChange={(e) => setVoiceCues(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Sound Synthesizer */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Audio Beeps & Chimes</span>
                <span className="text-muted-foreground">Synthesizer beeps for transition & completion</span>
              </div>
              <input
                type="checkbox"
                checked={soundEffects}
                onChange={(e) => setSoundEffects(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Vibration */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Vibration Haptics</span>
                <span className="text-muted-foreground">Vibrate phone on interval transitions</span>
              </div>
              <input
                type="checkbox"
                checked={vibration}
                onChange={(e) => setVibration(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>

            {/* Screen Wake Lock */}
            <div className="pt-3 flex items-center justify-between">
              <div>
                <span className="font-semibold text-foreground block">Keep Screen Awake</span>
                <span className="text-muted-foreground">Screen Wake Lock API while running</span>
              </div>
              <input
                type="checkbox"
                checked={screenWake}
                onChange={(e) => setScreenWake(e.target.checked)}
                className="w-5 h-5 accent-primary cursor-pointer"
              />
            </div>
          </div>

          <button
            onClick={handleSaveSettings}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold tracking-wider uppercase shadow-md cursor-pointer hover:bg-primary/90 transition-all"
          >
            Update Preferences
          </button>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}
