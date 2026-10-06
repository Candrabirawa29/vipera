"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getActiveRunDraft, clearActiveRunDraft, ActiveRunState } from "@/lib/storage/indexed-db";
import { formatDistance } from "@/lib/running/distance";
import { formatDuration } from "@/lib/running/pace";
import { AlertCircle, Play, Trash2 } from "lucide-react";

export default function UnfinishedRunAlert() {
  const router = useRouter();
  const [unfinishedRun, setUnfinishedRun] = useState<ActiveRunState | null>(null);

  useEffect(() => {
    getActiveRunDraft().then((draft) => {
      if (draft && draft.startedAt) {
        setUnfinishedRun(draft);
      }
    });
  }, []);

  if (!unfinishedRun) return null;

  const handleResume = () => {
    router.push("/run/active");
  };

  const handleDiscard = async () => {
    if (confirm("Discard this unfinished run? Unsaved active points will be removed.")) {
      await clearActiveRunDraft(unfinishedRun.id);
      setUnfinishedRun(null);
    }
  };

  return (
    <div className="mx-4 mt-3 p-3.5 rounded-xl bg-card border border-primary/40 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/20 text-primary">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">
            Unfinished Run Recovered
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            {formatDistance(unfinishedRun.distance)} &bull; {formatDuration(unfinishedRun.duration)} active
            {unfinishedRun.workout ? ` &bull; ${unfinishedRun.workout.title}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          onClick={handleDiscard}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Discard
        </button>
        <button
          onClick={handleResume}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          Resume Run
        </button>
      </div>
    </div>
  );
}
