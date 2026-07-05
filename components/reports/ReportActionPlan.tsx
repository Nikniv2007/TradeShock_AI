"use client";

import * as React from "react";

export function ReportActionPlan({ actions }: { actions: string[] }) {
  return (
    <div>
      <h3 className="stat-label mb-2">Recommended Actions</h3>
      <ol className="space-y-1.5 text-sm text-ink-muted">
        {actions.map((a, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-mono text-emerald">✓</span>
            <span>
              <span className="mr-1 font-mono text-slateaccent">{i + 1}.</span>
              {a}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
