"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, History, Dumbbell, User, Play } from "lucide-react";

export default function BottomNav() {
  const pathname = usePathname();

  // Hide bottom nav when actively recording a run to give 100% screen focus to running metrics
  if (pathname === "/run/active") {
    return null;
  }

  const navItems = [
    {
      label: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
      active: pathname === "/",
    },
    {
      label: "Activities",
      href: "/runs",
      icon: History,
      active: pathname.startsWith("/runs"),
    },
    {
      label: "Workouts",
      href: "/workouts",
      icon: Dumbbell,
      active: pathname.startsWith("/workouts"),
    },
    {
      label: "Profile",
      href: "/profile",
      icon: User,
      active: pathname === "/profile",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-3 py-2 sm:hidden">
      <div className="flex items-center justify-around relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
                item.active
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[11px] tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* Center Floating Start Run Button for Quick Launch */}
        <Link
          href="/run/start"
          className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 border-2 border-background active:scale-95 transition-transform"
          aria-label="Start Run"
        >
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </Link>
      </div>
    </nav>
  );
}
