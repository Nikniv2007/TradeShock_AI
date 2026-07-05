"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { RISK_META, riskLevelFromScore } from "@/lib/utils/formatters";
import type { RiskLevel } from "@/lib/types";
import { AlertTriangle, Inbox, Loader2, ShieldAlert, type LucideIcon } from "lucide-react";

// ─── Card ───
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("card card-hover p-5", className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon: Icon,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-lg bg-slateaccent/10 p-2 text-slateaccent ring-1 ring-slateaccent/20">
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

// ─── Badges ───
export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  const m = RISK_META[level];
  return (
    <span className={cn("pill ring-1", m.bg, m.text, m.ring, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {m.label}
    </span>
  );
}

export function ScoreBadge({ score, className }: { score: number; className?: string }) {
  const level = riskLevelFromScore(score);
  const m = RISK_META[level];
  return (
    <span className={cn("pill ring-1 font-mono tabular-nums", m.bg, m.text, m.ring, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      {Math.round(score)}
    </span>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "amber" | "emerald" | "danger" | "cyan";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-base-700 text-ink-muted ring-white/10",
    amber: "bg-amber/10 text-amber ring-amber/30",
    emerald: "bg-emerald/10 text-emerald ring-emerald/30",
    danger: "bg-danger/10 text-danger ring-danger/30",
    cyan: "bg-cyan/10 text-cyan ring-cyan/30",
  };
  return <span className={cn("pill ring-1", tones[tone], className)}>{children}</span>;
}

// ─── Buttons ───
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "amber" | "danger";
};
export function Button({ variant = "ghost", className, children, ...rest }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: "btn-primary",
    ghost: "btn-ghost",
    amber: "btn-amber",
    danger: "btn bg-danger text-white hover:bg-danger/85",
  };
  return (
    <button className={cn(variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

// ─── Metric card ───
export function MetricCard({
  label,
  value,
  sub,
  tone = "neutral",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "neutral" | "amber" | "emerald" | "danger" | "cyan";
  icon?: LucideIcon;
}) {
  const toneText: Record<string, string> = {
    neutral: "text-ink",
    amber: "text-amber",
    emerald: "text-emerald",
    danger: "text-danger",
    cyan: "text-cyan",
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-ink-faint" />}
      </div>
      <div className={cn("mt-2 text-2xl font-semibold tabular-nums", toneText[tone])}>{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

// ─── Risk meter ───
export function RiskMeter({ value, target, label }: { value: number; target?: number; label?: string }) {
  const pctValue = Math.max(0, Math.min(100, value * 100));
  const level: RiskLevel = target !== undefined ? (value >= target ? "safe" : value >= target - 0.05 ? "watch" : value >= target - 0.12 ? "warning" : "critical") : riskLevelFromScore(100 - pctValue);
  const m = RISK_META[level];
  return (
    <div>
      {label && <div className="mb-1.5 flex justify-between text-xs text-ink-muted"><span>{label}</span><span className={m.text}>{pctValue.toFixed(1)}%</span></div>}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-base-700">
        <div className={cn("h-full rounded-full transition-all", m.dot)} style={{ width: `${pctValue}%` }} />
        {target !== undefined && (
          <div className="absolute top-0 h-full w-0.5 bg-ink/60" style={{ left: `${Math.min(100, target * 100)}%` }} title={`Target ${(target * 100).toFixed(0)}%`} />
        )}
      </div>
    </div>
  );
}

// ─── Form fields ───
export function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn("input", className)} {...rest} />;
  }
);

export function NumberInput({ value, onChange, step = "any", className, ...rest }: { value: number; onChange: (v: number) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <input
      type="number"
      step={step}
      value={Number.isFinite(value) ? value : ""}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={cn("input tabular-nums", className)}
      {...rest}
    />
  );
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("input cursor-pointer", className)} {...rest}>
      {children}
    </select>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className="font-mono text-xs text-slateaccent tabular-nums">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-base-700 accent-slateaccent"
      />
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5"
    >
      <span className={cn("relative h-5 w-9 rounded-full transition-colors", checked ? "bg-emerald" : "bg-base-600")}>
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", checked ? "left-[18px]" : "left-0.5")} />
      </span>
      {label && <span className="text-sm text-ink">{label}</span>}
    </button>
  );
}

// ─── States ───
export function EmptyState({ title, message, icon: Icon = Inbox, action }: { title: string; message: string; icon?: LucideIcon; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="rounded-full bg-base-700 p-3 text-ink-faint"><Icon className="h-6 w-6" /></div>
      <h3 className="mt-4 text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{message}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Analyzing…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="card flex items-center gap-3 border-danger/30 bg-danger/5 p-4 text-sm text-danger">
      <ShieldAlert className="h-4 w-4 shrink-0" /> {message}
    </div>
  );
}

// ─── Disclaimer ───
export function DisclaimerBox({ children, variant = "general" }: { children?: React.ReactNode; variant?: "general" | "hts" | "financial" | "contract" | "fx" | "privacy" | "demo" }) {
  const tone = variant === "hts" ? "border-amber/30 bg-amber/5 text-amber" : variant === "privacy" ? "border-cyan/25 bg-cyan/5 text-ink-muted" : "border-white/10 bg-base-800/60 text-ink-faint";
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border p-3 text-[11px] leading-relaxed", tone)}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

// ─── Simple tabs ───
export function Tabs<T extends string>({ tabs, active, onChange }: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.08] bg-base-900 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === t.id ? "bg-slateaccent text-white" : "text-ink-muted hover:text-ink"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
