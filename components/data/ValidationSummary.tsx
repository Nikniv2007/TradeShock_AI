"use client";

import * as React from "react";
import { MetricCard, StatusBadge } from "@/components/ui/primitives";
import type { ParseResult } from "@/lib/data/csvParser";
import { TEMPLATE_LABELS } from "@/lib/data/templates";
import { fmtNumber, titleCase } from "@/lib/utils/formatters";
import { AlertTriangle } from "lucide-react";

// Full validation report for a parsed CSV: totals, missing columns, data-quality
// issues, and the list of rows that will not be imported. Empty-safe.
export function ValidationSummary({ result }: { result: ParseResult }) {
  return (
    <div className="space-y-4">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Total Rows" value={fmtNumber(result.summary.total)} />
        <MetricCard label="Valid" value={fmtNumber(result.summary.valid)} tone="emerald" />
        <MetricCard
          label="Failed"
          value={fmtNumber(result.summary.failed)}
          tone={result.summary.failed > 0 ? "danger" : "emerald"}
        />
        <MetricCard
          label="Warnings"
          value={fmtNumber(result.summary.warnings)}
          tone={result.summary.warnings > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* Missing required columns */}
      {result.missingColumns.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Missing required columns for {TEMPLATE_LABELS[result.kind]}:{" "}
            <span className="font-mono">{result.missingColumns.join(", ")}</span>. Add them and re-upload.
          </span>
        </div>
      )}

      {/* Data quality issues */}
      <div>
        <div className="mb-2 text-xs font-medium text-ink-muted">
          Data quality issues{" "}
          <span className="text-ink-faint">({result.issues.length} detected)</span>
        </div>
        {result.issues.length === 0 ? (
          <p className="text-sm text-emerald">No data-quality issues found.</p>
        ) : (
          <div className="max-h-72 overflow-auto rounded-lg border border-white/[0.06]">
            <table className="w-full min-w-[520px] text-xs">
              <thead className="sticky top-0 bg-base-850">
                <tr>
                  <th className="stat-label px-2.5 py-2 text-left">Row</th>
                  <th className="stat-label px-2.5 py-2 text-left">Field</th>
                  <th className="stat-label px-2.5 py-2 text-left">Message</th>
                  <th className="stat-label px-2.5 py-2 text-left">Severity</th>
                </tr>
              </thead>
              <tbody>
                {result.issues.map((iss, i) => (
                  <tr key={i} className="border-t border-white/[0.04]">
                    <td className="px-2.5 py-1.5 tabular-nums text-ink-muted">{iss.row}</td>
                    <td className="px-2.5 py-1.5 font-mono text-ink-muted">{iss.field}</td>
                    <td className="px-2.5 py-1.5 text-ink-muted">{iss.message}</td>
                    <td className="px-2.5 py-1.5">
                      <StatusBadge tone={iss.severity === "error" ? "danger" : "amber"}>
                        {titleCase(iss.severity)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Failed rows */}
      {result.failedRows.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-ink-muted">
            Failed rows{" "}
            <span className="text-ink-faint">
              ({result.failedRows.length} will not be imported)
            </span>
          </div>
          <ul className="space-y-1 text-xs text-ink-muted">
            {result.failedRows.map((f) => (
              <li key={f.row} className="flex gap-2">
                <span className="font-mono text-danger">Row {f.row}</span>
                {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
