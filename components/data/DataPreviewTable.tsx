"use client";

import * as React from "react";

// Scrollable preview of the first `max` (default 5) parsed rows. Empty-safe.
export function DataPreviewTable({
  rows,
  max = 5,
}: {
  rows: Record<string, string>[];
  max?: number;
}) {
  const preview = rows.slice(0, max);
  const cols = preview.length > 0 ? Object.keys(preview[0]) : [];

  if (cols.length === 0) {
    return <p className="text-sm text-ink-faint">No rows parsed.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="border-b border-white/[0.08]">
            {cols.map((c) => (
              <th key={c} className="stat-label px-2.5 py-2 text-left">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {preview.map((r, i) => (
            <tr key={i} className="border-b border-white/[0.04]">
              {cols.map((c) => (
                <td key={c} className="px-2.5 py-1.5 text-ink-muted">
                  {r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
