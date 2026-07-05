"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  LayoutDashboard, Calculator, Zap, GitCompareArrows, ScanLine, FileWarning,
  Boxes, Waves, HeartPulse, Users, Map, FileText, Workflow, Database, Settings,
  TrendingUp,
} from "lucide-react";

export const NAV = [
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

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
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
              onClick={onClose}
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
  );
}
