"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { RiskBadge, DisclaimerBox, LoadingState, Button } from "@/components/ui/primitives";
import { titleCase } from "@/lib/utils/formatters";
import type { RiskRecommendation } from "@/lib/types";
import { Sparkles, Copy, Check, Cpu, ListChecks, AlertOctagon } from "lucide-react";

const OWNER_TONE: Record<string, string> = {
  finance: "text-emerald", supply_chain: "text-cyan", sales: "text-amber",
  executive: "text-slateaccent", broker: "text-amber", legal: "text-danger", operations: "text-ink-muted",
};
const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-danger/15 text-danger", high: "bg-amber/15 text-amber",
  medium: "bg-cyan/15 text-cyan", low: "bg-base-700 text-ink-muted",
};

export function AIConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const tone = pct >= 70 ? "text-emerald" : pct >= 50 ? "text-amber" : "text-danger";
  return <span className={cn("font-mono text-xs", tone)}>{pct}% confidence</span>;
}

export function AssumptionsList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <h5 className="stat-label mb-1.5">Assumptions</h5>
      <ul className="space-y-1 text-xs text-ink-muted">
        {items.map((a, i) => <li key={i} className="flex gap-2"><span className="text-ink-faint">·</span>{a}</li>)}
      </ul>
    </div>
  );
}

export function ActionPlanList({ actions }: { actions: RiskRecommendation["recommendedActions"] }) {
  if (!actions?.length) return null;
  return (
    <div className="space-y-2">
      {actions.map((a, i) => (
        <div key={i} className="rounded-lg border border-white/[0.06] bg-base-900/60 p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-ink">{a.action}</p>
            <span className={cn("pill shrink-0 text-[10px]", PRIORITY_TONE[a.priority])}>{a.priority}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
            <span className="text-emerald">↑ {a.expectedImpact}</span>
            <span>·</span>
            <span>Effort: {a.effort}</span>
            <span>·</span>
            <span className={OWNER_TONE[a.owner]}>Owner: {titleCase(a.owner)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Full recommendation panel for the RiskRecommendation schema shape. */
export function AIRecommendationPanel({
  title = "AI Analyst Recommendation",
  data,
  source,
  warning,
  loading,
}: {
  title?: string;
  data?: RiskRecommendation;
  source?: string;
  warning?: string;
  loading?: boolean;
}) {
  if (loading) return <div className="card"><LoadingState /></div>;
  if (!data) return null;

  return (
    <div className="card border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.04] to-transparent p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-slateaccent/15 p-2 text-slateaccent ring-1 ring-slateaccent/25"><Sparkles className="h-4 w-4" /></div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={data.riskLevel} />
          <AIConfidenceBadge confidence={data.confidence} />
        </div>
      </div>

      {warning && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/5 px-3 py-2 text-xs text-amber">
          <Cpu className="h-3.5 w-3.5" /> {warning}
        </div>
      )}
      {source && source !== "mock" && (
        <div className="mb-3 text-[11px] text-emerald">Live AI · {source.replace("live-", "")}</div>
      )}

      <p className="text-sm leading-relaxed text-ink-muted">{data.executiveSummary}</p>

      {data.keyFindings?.length > 0 && (
        <div className="mt-4">
          <h5 className="stat-label mb-1.5 flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Key Findings</h5>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            {data.keyFindings.map((f, i) => <li key={i} className="flex gap-2"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-slateaccent" />{f}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <h5 className="stat-label mb-2">Recommended Actions</h5>
        <ActionPlanList actions={data.recommendedActions} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <AssumptionsList items={data.assumptions} />
        {data.risksIfIgnored?.length > 0 && (
          <div>
            <h5 className="stat-label mb-1.5 flex items-center gap-1.5"><AlertOctagon className="h-3.5 w-3.5" /> Risks If Ignored</h5>
            <ul className="space-y-1 text-xs text-ink-muted">
              {data.risksIfIgnored.map((r, i) => <li key={i} className="flex gap-2"><span className="text-danger">!</span>{r}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4">
        <DisclaimerBox>{data.disclaimer}</DisclaimerBox>
      </div>
    </div>
  );
}

/** Editable draft box with copy — used by margin rescue & customer pricing. */
export function EditableDraftBox({ label, value }: { label: string; value: string }) {
  const [text, setText] = React.useState(value);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => setText(value), [value]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="rounded-lg border border-white/[0.08] bg-base-900">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <button onClick={copy} className="flex items-center gap-1 text-[11px] text-ink-faint hover:text-ink">
          {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        className="w-full resize-y bg-transparent p-3 text-xs leading-relaxed text-ink focus:outline-none"
      />
    </div>
  );
}
