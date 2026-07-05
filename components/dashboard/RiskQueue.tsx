"use client";

import * as React from "react";
import Link from "next/link";
import type { RiskQueueItem } from "@/lib/types";
import { fmtCurrency } from "@/lib/utils/formatters";
import {
  PackageOpen, TrendingDown, ShieldAlert, Users2, Tag, ArrowRight, type LucideIcon,
} from "lucide-react";

const TYPE_META: Record<RiskQueueItem["type"], { icon: LucideIcon; tone: string }> = {
  critical_po: { icon: PackageOpen, tone: "bg-danger/10 text-danger" },
  unprofitable_sku: { icon: TrendingDown, tone: "bg-amber/10 text-amber" },
  hts_uncertainty: { icon: ShieldAlert, tone: "bg-amber/10 text-amber" },
  supplier_concentration: { icon: Users2, tone: "bg-cyan/10 text-cyan" },
  price_action: { icon: Tag, tone: "bg-amber/10 text-amber" },
};

/** Prioritized risk queue — items ordered by the caller, linked to their route. */
export function RiskQueue({ items }: { items: RiskQueueItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-emerald">No urgent items — portfolio is stable under current assumptions.</p>;
  }
  return (
    <div className="space-y-2">
      {items.map((item) => {
        const { icon: Icon, tone } = TYPE_META[item.type];
        return (
          <Link
            key={item.id}
            href={item.route}
            className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-base-900/50 p-3 transition-colors hover:border-slateaccent/30"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className={`rounded-lg p-2 ${tone}`}><Icon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{item.title}</p>
                <p className="truncate text-xs text-ink-muted">{item.recommendedAction}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-danger">{fmtCurrency(item.financialImpact, "USD", { compact: true })}</div>
                <div className="text-[10px] uppercase tracking-wide text-ink-faint">{item.priority}</div>
              </div>
              <ArrowRight className="h-4 w-4 text-ink-faint" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
