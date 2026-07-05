"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStore } from "@/lib/store/useStore";
import {
  Card, SectionTitle, Field, Input, NumberInput, Select, Button, Toggle, StatusBadge, DisclaimerBox,
} from "@/components/ui/primitives";
import { fmtPercent } from "@/lib/utils/formatters";
import type { Company, Currency, RiskLevel } from "@/lib/types";
import { RISK_META } from "@/lib/utils/formatters";
import { DISCLAIMERS } from "@/lib/ai/prompts";
import { getSession } from "@/lib/auth/mockAuth";
import { Settings as SettingsIcon, Save, RotateCcw, Cpu, Database, ShieldCheck, Check, UserCircle, Lock } from "lucide-react";

const CURRENCIES: Currency[] = ["USD", "EUR", "CNY", "VND", "MXN", "INR", "TRY"];
const RISK_TOLERANCE: Company["riskTolerance"][] = ["conservative", "balanced", "aggressive"];

const RISK_BANDS: { level: RiskLevel; range: string; label: string }[] = [
  { level: "safe", range: "0 – 30", label: "Safe" },
  { level: "watch", range: "31 – 55", label: "Watch" },
  { level: "warning", range: "56 – 75", label: "Warning" },
  { level: "critical", range: "76 – 100", label: "Critical" },
];

const ACK_ITEMS = [
  "I understand TradeShock AI provides informational analysis only, not legal, customs, tax, accounting, or financial advice.",
  "I will confirm HTS classifications, tariffs, and duties with a licensed customs broker or official source before filing.",
  "I understand all demo figures are estimates based on fictional data and stated assumptions.",
];

interface AIStatus {
  providers: { anthropic: boolean; openai: boolean };
  demoMode: boolean;
}

export default function SettingsPage() {
  const store = useStore();
  const [mounted, setMounted] = React.useState(false);
  const [form, setForm] = React.useState<Company>(store.dataset.company);
  const [saved, setSaved] = React.useState(false);
  const [aiStatus, setAiStatus] = React.useState<AIStatus | null>(null);
  const [aiError, setAiError] = React.useState(false);
  const [acks, setAcks] = React.useState<boolean[]>(ACK_ITEMS.map(() => false));
  const session = getSession();

  React.useEffect(() => {
    setMounted(true);
    setForm(store.dataset.company);
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d: AIStatus) => setAiStatus(d))
      .catch(() => setAiError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof Company>(k: K, v: Company[K]) => { setForm((s) => ({ ...s, [k]: v })); setSaved(false); };

  function save() {
    store.updateCompany({
      name: form.name,
      defaultCurrency: form.defaultCurrency,
      destinationCountry: form.destinationCountry,
      defaultTargetMargin: form.defaultTargetMargin,
      riskTolerance: form.riskTolerance,
      inventoryCarryingCostPercent: form.inventoryCarryingCostPercent,
      financingCostPercent: form.financingCostPercent,
      updatedAt: new Date().toISOString(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  return (
    <>
      <PageHeader
        title="Settings"
        description="Company defaults, risk thresholds, AI provider status, and workspace controls. Company edits persist to your local workspace."
        icon={SettingsIcon}
        actions={<Button variant="primary" onClick={save}><Save className="h-3.5 w-3.5" /> {saved ? "Saved" : "Save changes"}</Button>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company defaults */}
        <Card>
          <SectionTitle title="Company & Defaults" subtitle="Used across the app as fallback assumptions." />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Company name" className="sm:col-span-2"><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
            <Field label="Default currency">
              <Select value={form.defaultCurrency} onChange={(e) => set("defaultCurrency", e.target.value as Currency)}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Destination country"><Input value={form.destinationCountry} onChange={(e) => set("destinationCountry", e.target.value)} /></Field>
            <Field label="Default target margin" hint="0.35 = 35%"><NumberInput value={form.defaultTargetMargin} onChange={(v) => set("defaultTargetMargin", v)} step="0.01" /></Field>
            <Field label="Risk tolerance">
              <Select value={form.riskTolerance} onChange={(e) => set("riskTolerance", e.target.value as Company["riskTolerance"])}>
                {RISK_TOLERANCE.map((r) => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
              </Select>
            </Field>
            <Field label="Inventory carrying cost %" hint="annual, 0.22 = 22%"><NumberInput value={form.inventoryCarryingCostPercent} onChange={(v) => set("inventoryCarryingCostPercent", v)} step="0.01" /></Field>
            <Field label="Financing cost %" hint="annual, 0.11 = 11%"><NumberInput value={form.financingCostPercent} onChange={(v) => set("financingCostPercent", v)} step="0.01" /></Field>
          </div>
          <p className="mt-3 text-xs text-ink-faint">Target margin currently <span className="text-ink-muted">{fmtPercent(form.defaultTargetMargin)}</span> · carrying cost <span className="text-ink-muted">{fmtPercent(form.inventoryCarryingCostPercent)}</span> · financing <span className="text-ink-muted">{fmtPercent(form.financingCostPercent)}</span>.</p>
        </Card>

        {/* Risk thresholds */}
        <Card>
          <SectionTitle icon={ShieldCheck} title="Risk Score Thresholds" subtitle="Shared 0–100 bands used by every risk score in the app." />
          <div className="space-y-2">
            {RISK_BANDS.map((b) => {
              const m = RISK_META[b.level];
              return (
                <div key={b.level} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className={`h-2.5 w-2.5 rounded-full ${m.dot}`} />
                    <span className={`text-sm font-medium ${m.text}`}>{b.label}</span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-ink-muted">{b.range}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-faint">Thresholds are fixed system-wide so scores stay comparable across modules.</p>
        </Card>

        {/* AI & integrations */}
        <Card>
          <SectionTitle icon={Cpu} title="AI Provider Status" subtitle="Live status from the /api/ai route." />
          {!mounted || (!aiStatus && !aiError) ? (
            <div className="h-24 animate-pulse rounded-lg bg-base-800" />
          ) : aiError ? (
            <p className="text-sm text-danger">Could not reach the AI status endpoint.</p>
          ) : aiStatus ? (
            <div className="space-y-2">
              <StatusRow label="Anthropic" ok={aiStatus.providers.anthropic} okText="Connected" offText="No API key" />
              <StatusRow label="OpenAI" ok={aiStatus.providers.openai} okText="Connected" offText="No API key" />
              <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2.5">
                <span className="text-sm text-ink">Demo mode</span>
                <StatusBadge tone={aiStatus.demoMode ? "amber" : "emerald"}>{aiStatus.demoMode ? "On (deterministic mock)" : "Off (live)"}</StatusBadge>
              </div>
              {!aiStatus.providers.anthropic && !aiStatus.providers.openai && (
                <p className="text-xs text-ink-faint">No live provider keys configured — AI actions return deterministic mock recommendations. The app remains fully functional.</p>
              )}
            </div>
          ) : null}

          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2.5">
              <div className="flex items-center gap-2.5"><Database className="h-4 w-4 text-ink-faint" /><span className="text-sm text-ink">Supabase</span></div>
              <StatusBadge tone={supabaseUrl ? "emerald" : "neutral"}>{supabaseUrl ? "Configured" : "Not connected — using local store"}</StatusBadge>
            </div>
          </div>
        </Card>

        {/* Account & Privacy */}
        <Card>
          <SectionTitle icon={UserCircle} title="Account & Privacy" subtitle="Placeholder session — auth-ready for Supabase." />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-slateaccent to-cyan text-[11px] font-bold text-white">{session.user.avatarInitials}</div>
                <div>
                  <p className="text-sm text-ink">{session.user.name}</p>
                  <p className="text-[11px] text-ink-faint">{session.user.email} · role: {session.user.role}</p>
                </div>
              </div>
              <StatusBadge tone="cyan"><Lock className="h-3 w-3" /> {session.provider === "demo" ? "Demo session" : "Authenticated"}</StatusBadge>
            </div>
            <p className="text-xs text-ink-faint">Authentication is a placeholder. Wire Supabase Auth to gate real workspaces; role-based checks (approve PO, edit) are already stubbed in <span className="font-mono text-ink-muted">lib/auth/mockAuth.ts</span>.</p>
            <DisclaimerBox variant="privacy">{DISCLAIMERS.privacy}</DisclaimerBox>
          </div>
        </Card>

        {/* Workspace controls */}
        <Card>
          <SectionTitle title="Workspace" subtitle="Demo mode and data controls for this browser." />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-ink">Demo mode</p>
                <p className="text-xs text-ink-muted">Route AI actions through the deterministic mock provider.</p>
              </div>
              {mounted && <Toggle checked={store.demoMode} onChange={(v) => store.setDemoMode(v)} />}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="amber" onClick={() => store.loadDemoData()}>Load demo data</Button>
              <Button variant="danger" onClick={() => store.resetData()}><RotateCcw className="h-3.5 w-3.5" /> Reset all data</Button>
            </div>
            <p className="text-xs text-ink-faint">Reset clears the local workspace. You can reload the demo portfolio at any time.</p>
          </div>
        </Card>

        {/* Acknowledgements */}
        <Card className="lg:col-span-2">
          <SectionTitle title="Disclaimer Acknowledgements" subtitle="Confirm you understand the scope and limitations of this tool." />
          <div className="space-y-2">
            {ACK_ITEMS.map((item, i) => (
              <button
                key={i}
                onClick={() => setAcks((a) => a.map((v, idx) => (idx === i ? !v : v)))}
                className="flex w-full items-start gap-3 rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2.5 text-left transition-colors hover:border-white/[0.12]"
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${acks[i] ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20"}`}>
                  {acks[i] && <Check className="h-3 w-3" />}
                </span>
                <span className="text-xs text-ink-muted">{item}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-faint">{acks.filter(Boolean).length} of {ACK_ITEMS.length} acknowledged.</p>
          <div className="mt-4"><DisclaimerBox variant="general">TradeShock AI provides informational business analysis only. It does not provide legal, customs, tax, accounting, investment, or financial advice. Confirm all decisions with qualified professionals.</DisclaimerBox></div>
        </Card>
      </div>
    </>
  );
}

function StatusRow({ label, ok, okText, offText }: { label: string; ok: boolean; okText: string; offText: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2.5">
      <span className="text-sm text-ink">{label}</span>
      <StatusBadge tone={ok ? "emerald" : "neutral"}>{ok ? okText : offText}</StatusBadge>
    </div>
  );
}
