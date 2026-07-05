// ─────────────────────────────────────────────────────────────
// Display formatters — pure, safe, and consistent across the app.
// ─────────────────────────────────────────────────────────────

import type { Currency, RiskLevel } from "@/lib/types";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: "$",
  CNY: "¥",
  VND: "₫",
  MXN: "MX$",
  INR: "₹",
  TRY: "₺",
  EUR: "€",
};

export function currencySymbol(c: Currency = "USD"): string {
  return CURRENCY_SYMBOL[c] ?? "$";
}

/** Format a number as currency. Guards against NaN/Infinity. */
export function fmtCurrency(
  value: number,
  currency: Currency = "USD",
  opts: { decimals?: number; compact?: boolean } = {}
): string {
  if (!Number.isFinite(value)) return "—";
  const { decimals = 2, compact = false } = opts;
  const sym = currencySymbol(currency);
  if (compact && Math.abs(value) >= 1000) {
    const formatted = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
    return `${sym}${formatted}`;
  }
  return `${sym}${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)}`;
}

/** Format a 0..1 ratio as a percentage. */
export function fmtPercent(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

/** Format an already-in-points percentage (e.g. 11.8 -> "11.8%"). */
export function fmtPoints(value: number, decimals = 1): string {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function fmtNumber(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function fmtDays(days: number): string {
  if (!Number.isFinite(days)) return "—";
  return `${Math.round(days)} ${Math.round(days) === 1 ? "day" : "days"}`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const RISK_META: Record<
  RiskLevel,
  { label: string; text: string; bg: string; ring: string; dot: string }
> = {
  safe: {
    label: "Safe",
    text: "text-emerald",
    bg: "bg-emerald/10",
    ring: "ring-emerald/30",
    dot: "bg-emerald",
  },
  watch: {
    label: "Watch",
    text: "text-cyan",
    bg: "bg-cyan/10",
    ring: "ring-cyan/30",
    dot: "bg-cyan",
  },
  warning: {
    label: "Warning",
    text: "text-amber",
    bg: "bg-amber/10",
    ring: "ring-amber/30",
    dot: "bg-amber",
  },
  critical: {
    label: "Critical",
    text: "text-danger",
    bg: "bg-danger/10",
    ring: "ring-danger/30",
    dot: "bg-danger",
  },
};

/** Map a numeric 0..100 risk score to a level. Shared threshold source. */
export function riskLevelFromScore(score: number): RiskLevel {
  const s = clamp(score, 0, 100);
  if (s <= 30) return "safe";
  if (s <= 55) return "watch";
  if (s <= 75) return "warning";
  return "critical";
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function titleCase(s: string): string {
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
