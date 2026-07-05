"use client";

import * as React from "react";
import { StatusBadge } from "@/components/ui/primitives";

export function ReportHeader({
  title,
  companyName,
  generatedAt,
  demo,
  confidence,
}: {
  title: string;
  companyName: string;
  generatedAt: string;
  demo?: boolean;
  confidence?: number;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
      <div>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-muted">{companyName} · Prepared by TradeShock AI</p>
        <p className="mt-0.5 text-xs text-ink-faint">Generated {generatedAt || "…"}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        {demo && <StatusBadge tone="amber">DEMO DATA</StatusBadge>}
        {confidence !== undefined && (
          <span className="pill bg-base-700 font-mono tabular-nums text-ink-muted ring-1 ring-white/10">
            {Math.round(confidence * 100)}% confidence
          </span>
        )}
      </div>
    </div>
  );
}
