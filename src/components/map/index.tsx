"use client";

import dynamic from "next/dynamic";
import React from "react";

const RunMapComponent = dynamic(() => import("./RunMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[280px] rounded-xl bg-card/60 flex flex-col items-center justify-center text-muted-foreground border border-border animate-pulse">
      <div className="w-8 h-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin mb-2" />
      <span className="text-xs font-mono uppercase tracking-wider">Loading GPS Map...</span>
    </div>
  ),
});

export default RunMapComponent;
