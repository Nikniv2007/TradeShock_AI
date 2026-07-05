"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useStore, computePortfolioStatus } from "@/lib/store/useStore";
import { fmtCurrency } from "@/lib/utils/formatters";
import { RISK_META } from "@/lib/utils/formatters";
import { requestAI } from "@/lib/ai/actions";
import {
  LayoutDashboard, Calculator, Zap, GitCompareArrows, ScanLine, FileWarning,
  Boxes, Waves, HeartPulse, Users, Map, FileText, Workflow, Database, Settings,
  Search, Sparkles, DownloadCloud, ShieldCheck, Menu, X, TrendingUp,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/landed-cost", label: "Landed Cost", icon: Calculator },
  { href: "/tariff-simulator", label: "Tariff Simulator", icon: Zap },
  { href: "/supplier-roi", label: "Supplier ROI", icon: GitCompareArrows },
  { href: "/po-scanner", label: "PO Scanner", icon: ScanLine },
  { href: "/hts-risk", label: "HTS Risk", icon: FileWarning },
  { href: "/bom-analyzer", label: "BOM Analyzer", icon: Boxes },
  { href: "/fx-freight", label: "FX & Freight Shock", icon: Waves },
  { href: "/margin-rescue", label: "Margin Rescue", icon: HeartPulse },
  { href: "/customer-pricing", label: "Customer Pricing", icon: Users },
  { href: "/supplier-map", label: "Supplier Map", icon: Map },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/automation", label: "Automation Center", icon: Workflow },
  { href: "/data-room", label: "Data Room", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-base-950">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-white/[0.06] bg-base-900/95 backdrop-blur transition-transform lg:static lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.06] px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slateaccent to-cyan text-white shadow-glow">
            <TrendingUp className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold leading-none text-ink">TradeShock<span className="text-slateaccent"> AI</span></div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-faint">Margin War Room</div>
          </div>
        </div>
        <nav className="flex flex-col gap-0.5 overflow-y-auto p-3" style={{ maxHeight: "calc(100vh - 4rem)" }}>
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-slateaccent/15 text-ink ring-1 ring-slateaccent/25" : "text-ink-muted hover:bg-base-800 hover:text-ink"
                )}
              >
                <Icon className={cn("h-4 w-4", active ? "text-slateaccent" : "text-ink-faint")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
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
