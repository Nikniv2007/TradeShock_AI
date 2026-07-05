"use client";

import * as React from "react";
import { MetricCard } from "@/components/ui/primitives";

type Tone = "neutral" | "amber" | "emerald" | "danger" | "cyan";

export function ReportMetricGrid({
  metrics,
}: {
  metrics: { label: string; value: string; tone?: Tone }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard key={m.label} label={m.label} value={m.value} tone={m.tone ?? "neutral"} />
      ))}
    </div>
  );
}
