"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { useStore, computePortfolioStatus } from "@/lib/store/useStore";
import { fmtCurrency, RISK_META } from "@/lib/utils/formatters";
import { requestAI } from "@/lib/ai/actions";
import { Search, Sparkles, DownloadCloud, ShieldCheck, Menu, X } from "lucide-react";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { dataset, demoMode, hasData, loadDemoData } = useStore();
  const [briefing, setBriefing] = React.useState<string | null>(null);
  const [loadingBrief, setLoadingBrief] = React.useState(false);
  const status = React.useMemo(() => computePortfolioStatus(dataset), [dataset]);
  const m = RISK_META[status.status];

  async function generateBrief() {
    setLoadingBrief(true);
    const res = await requestAI("cfo_brief", {
      portfolioStatus: status.status,
      skusBelowTarget: status.skusBelowTarget,
      marginAtRisk: status.marginAtRisk,
      tariffExposure: status.tariffExposure,
      topCountry: status.topCountry,
      topCountryShare: status.topCountryShare,
      criticalPOs: status.criticalPOs,
      worstSku: dataset.products[0]?.name ?? "a key SKU",
      worstPriceIncrease: 0.118,
    });
    const data = res.data as { summary?: string };
    setBriefing(data.summary ?? "Brief generated.");
    setLoadingBrief(false);
  }

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-base-950/80 px-4 backdrop-blur sm:px-6">
      <button onClick={onMenu} className="rounded-lg p-2 text-ink-muted hover:bg-base-800 lg:hidden"><Menu className="h-5 w-5" /></button>

      {/* Company selector */}
      <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-base-900 px-3 py-1.5 sm:flex">
        <div className="h-2 w-2 rounded-full bg-emerald" />
        <span className="text-sm font-medium text-ink">{dataset.company.name}</span>
      </div>

      {/* Search */}
      <div className="relative hidden max-w-xs flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input placeholder="Search SKUs, suppliers, POs…" className="input pl-9" />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Portfolio status */}
        <div className={cn("hidden items-center gap-2 rounded-lg px-3 py-1.5 text-xs ring-1 xl:flex", m.bg, m.ring)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
          <span className={m.text}>Portfolio: {m.label}</span>
          {status.marginAtRisk > 0 && (
            <span className="text-ink-muted">— {fmtCurrency(status.marginAtRisk, "USD", { compact: true })} at risk / {status.skusBelowTarget} SKUs</span>
          )}
        </div>

        {demoMode && (
          <span className="hidden items-center gap-1.5 rounded-lg bg-cyan/10 px-2.5 py-1.5 text-xs font-medium text-cyan ring-1 ring-cyan/30 sm:flex">
            <ShieldCheck className="h-3.5 w-3.5" /> Demo Mode
          </span>
        )}

        {!hasData ? (
          <button onClick={loadDemoData} className="btn-amber text-xs">
            <DownloadCloud className="h-3.5 w-3.5" /> Load Demo Data
          </button>
        ) : (
          <button onClick={generateBrief} disabled={loadingBrief} className="btn-primary text-xs">
            <Sparkles className="h-3.5 w-3.5" /> {loadingBrief ? "Generating…" : "Generate CFO Brief"}
          </button>
        )}

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-slateaccent to-cyan text-xs font-bold text-white">HP</div>
      </div>

      {briefing && (
        <div className="absolute right-6 top-16 z-30 w-96 rounded-xl border border-white/10 bg-base-850 p-4 shadow-glow">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slateaccent">CFO Brief</span>
            <button onClick={() => setBriefing(null)}><X className="h-4 w-4 text-ink-faint" /></button>
          </div>
          <p className="text-xs leading-relaxed text-ink-muted">{briefing}</p>
        </div>
      )}
    </header>
  );
}
