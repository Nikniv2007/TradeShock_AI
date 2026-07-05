"use client";

import * as React from "react";
import { useStore } from "@/lib/store/useStore";
import { ShieldCheck } from "lucide-react";

/** Slim banner shown while the app runs on fictional demo data. */
export function DemoModeBanner() {
  const demoMode = useStore((s) => s.demoMode);
  if (!demoMode) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-cyan/20 bg-cyan/10 px-4 py-1.5 text-xs font-medium text-cyan">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
      Demo Mode — fictional data, no API key required
    </div>
  );
}
