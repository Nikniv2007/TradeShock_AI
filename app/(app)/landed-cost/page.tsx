"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, SectionTitle, Field, Input, NumberInput, Select, Button, MetricCard, RiskMeter, RiskBadge, DisclaimerBox, ErrorState } from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { LandedCostWaterfall, CostBreakdownDonut } from "@/components/charts";
import { calculateLandedCost, INCOTERM_PROFILES } from "@/lib/finance/calculations";
import { validateLandedCostInputs } from "@/lib/utils/validators";
import { fmtCurrency, fmtPercent, titleCase } from "@/lib/utils/formatters";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import type { Incoterm, LandedCostInput, RiskRecommendation } from "@/lib/types";
import { Calculator, Save, Zap, GitCompareArrows, Sparkles, History } from "lucide-react";

const DEFAULTS: LandedCostInput = {
  productName: "Steel Storage Shelf", sku: "TS-1002", category: "Storage", supplierName: "Guadalajara Metalworks",
  supplierCountry: "Mexico", destinationCountry: "United States", incoterm: "FOB",
  supplierUnitCost: 22, quantity: 500, freightTotal: 2100, insuranceTotal: 180, brokerFees: 250, portFees: 140,
  handlingFees: 90, warehouseFees: 120, domesticDeliveryFees: 160, inspectionFees: 70, otherFees: 60,
  tariffRate: 0.12, additionalTariffRate: 0.075, sellingPrice: 49, targetMargin: 0.35, currency: "USD", notes: "",
};

interface SavedCalc { id: string; name: string; landed: number; margin: number; }

export default function LandedCostPage() {
  const { dataset } = useStore();
  const [input, setInput] = React.useState<LandedCostInput>(DEFAULTS);
  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);
  const [history, setHistory] = React.useState<SavedCalc[]>([]);

  const set = <K extends keyof LandedCostInput>(k: K, v: LandedCostInput[K]) => setInput((s) => ({ ...s, [k]: v }));
  const issues = validateLandedCostInputs(input);
  const valid = issues.filter((i) => i.severity === "error").length === 0;
  const result = React.useMemo(() => (valid ? calculateLandedCost(input) : null), [input, valid]);

  const profile = INCOTERM_PROFILES[input.incoterm];

  function loadProduct(id: string) {
    const p = dataset.products.find((x) => x.id === id);
    if (!p) return;
    const qty = Math.max(1, p.monthlyDemand);
    setInput((s) => ({
      ...s, productName: p.name, sku: p.sku, category: p.category, supplierUnitCost: p.supplierUnitCost,
      quantity: qty, freightTotal: p.freightPerUnit * qty, otherFees: p.otherFeesPerUnit * qty,
      tariffRate: p.currentTariffRate, additionalTariffRate: p.additionalTariffRate,
      sellingPrice: p.sellingPrice, targetMargin: p.targetMargin,
      supplierName: dataset.suppliers.find((sp) => sp.id === p.supplierId)?.name ?? s.supplierName,
      supplierCountry: p.countryOfOrigin,
    }));
  }

  function save() {
    if (!result) return;
    setHistory((h) => [{ id: `${Date.now()}`, name: input.productName || input.sku || "Calc", landed: result.landedCostPerUnit, margin: result.grossMargin }, ...h].slice(0, 6));
  }

  async function explain() {
    if (!result) return;
    setLoadingAi(true);
    const res = await requestAI("landed_cost_explain", {
      productName: input.productName, landedCostPerUnit: result.landedCostPerUnit, grossMargin: result.grossMargin,
      targetMargin: input.targetMargin, marginGap: result.marginGap, riskLevel: result.riskLevel,
      recommendedAction: result.marginGap > 0 ? "Raise price or reduce landed cost to close the margin gap." : "Margin is healthy — monitor tariff exposure.",
      topDrivers: result.costShare.map((c) => ({ label: c.label, detail: `${fmtPercent(c.percent)} of landed cost (${fmtCurrency(c.value)}/unit)` })),
    });
    setAi(res as never);
    setLoadingAi(false);
  }

  return (
    <>
      <PageHeader
        title="Landed Cost Calculator"
        description="Compute true per-unit landed cost across freight, duties, fees, and Incoterms — the deterministic foundation for every other module."
        icon={Calculator}
        actions={
          <Select className="max-w-[200px]" defaultValue="" onChange={(e) => e.target.value && loadProduct(e.target.value)}>
            <option value="">Load a demo SKU…</option>
            {dataset.products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        {/* Inputs */}
        <div className="space-y-6">
          <Card>
            <SectionTitle title="Shipment Inputs" subtitle="Enter or load a SKU, then tune the cost drivers." />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Product name"><Input value={input.productName} onChange={(e) => set("productName", e.target.value)} /></Field>
              <Field label="SKU"><Input value={input.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
              <Field label="Category"><Input value={input.category} onChange={(e) => set("category", e.target.value)} /></Field>
              <Field label="Supplier"><Input value={input.supplierName} onChange={(e) => set("supplierName", e.target.value)} /></Field>
              <Field label="Supplier country"><Input value={input.supplierCountry} onChange={(e) => set("supplierCountry", e.target.value)} /></Field>
              <Field label="Destination"><Input value={input.destinationCountry} onChange={(e) => set("destinationCountry", e.target.value)} /></Field>
              <Field label="Incoterm" hint={profile.note}>
                <Select value={input.incoterm} onChange={(e) => set("incoterm", e.target.value as Incoterm)}>
                  {(["EXW", "FOB", "CIF", "DDP"] as Incoterm[]).map((i) => <option key={i} value={i}>{i}</option>)}
                </Select>
              </Field>
              <Field label="Currency"><Input value={input.currency} disabled /></Field>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Supplier unit cost"><NumberInput value={input.supplierUnitCost} onChange={(v) => set("supplierUnitCost", v)} /></Field>
              <Field label="Quantity"><NumberInput value={input.quantity} onChange={(v) => set("quantity", v)} /></Field>
              <Field label="Selling price"><NumberInput value={input.sellingPrice} onChange={(v) => set("sellingPrice", v)} /></Field>
              <Field label="Freight total"><NumberInput value={input.freightTotal} onChange={(v) => set("freightTotal", v)} /></Field>
              <Field label="Insurance total"><NumberInput value={input.insuranceTotal} onChange={(v) => set("insuranceTotal", v)} /></Field>
              <Field label="Broker fees"><NumberInput value={input.brokerFees} onChange={(v) => set("brokerFees", v)} /></Field>
              <Field label="Port fees"><NumberInput value={input.portFees} onChange={(v) => set("portFees", v)} /></Field>
              <Field label="Handling fees"><NumberInput value={input.handlingFees} onChange={(v) => set("handlingFees", v)} /></Field>
              <Field label="Warehouse fees"><NumberInput value={input.warehouseFees} onChange={(v) => set("warehouseFees", v)} /></Field>
              <Field label="Domestic delivery"><NumberInput value={input.domesticDeliveryFees} onChange={(v) => set("domesticDeliveryFees", v)} /></Field>
              <Field label="Inspection fees"><NumberInput value={input.inspectionFees} onChange={(v) => set("inspectionFees", v)} /></Field>
              <Field label="Other fees"><NumberInput value={input.otherFees} onChange={(v) => set("otherFees", v)} /></Field>
              <Field label="Tariff / duty rate" hint="e.g. 0.12 = 12%"><NumberInput value={input.tariffRate} onChange={(v) => set("tariffRate", v)} step="0.01" /></Field>
              <Field label="Additional tariff" hint="surcharge rate"><NumberInput value={input.additionalTariffRate} onChange={(v) => set("additionalTariffRate", v)} step="0.01" /></Field>
              <Field label="Target margin" hint="e.g. 0.35 = 35%"><NumberInput value={input.targetMargin} onChange={(v) => set("targetMargin", v)} step="0.01" /></Field>
            </div>

            {!valid && <div className="mt-4"><ErrorState message={issues.find((i) => i.severity === "error")?.message ?? "Fix input errors to calculate."} /></div>}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="primary" onClick={save} disabled={!result}><Save className="h-3.5 w-3.5" /> Save SKU</Button>
              <Link href="/tariff-simulator"><Button variant="amber"><Zap className="h-3.5 w-3.5" /> Run Tariff Shock</Button></Link>
              <Link href="/supplier-roi"><Button><GitCompareArrows className="h-3.5 w-3.5" /> Compare Supplier</Button></Link>
              <Button onClick={explain} disabled={!result || loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Explaining…" : "AI Explanation"}</Button>
            </div>
          </Card>

          <Card>
            <SectionTitle icon={History} title="Saved Calculation History" subtitle="Session-local snapshots." />
            {history.length === 0 ? (
              <p className="text-sm text-ink-faint">No saved calculations yet. Click “Save SKU”.</p>
            ) : (
              <div className="space-y-1.5">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2 text-sm">
                    <span className="text-ink">{h.name}</span>
                    <span className="flex items-center gap-3 text-xs"><span className="text-ink-muted">{fmtCurrency(h.landed)}/u</span><RiskBadge level={h.margin < 0.2 ? "critical" : h.margin < 0.3 ? "warning" : "safe"} /></span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {result && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Landed Cost / Unit" value={fmtCurrency(result.landedCostPerUnit)} tone="cyan" />
                <MetricCard label="Gross Margin" value={fmtPercent(result.grossMargin)} tone={result.grossMargin >= input.targetMargin ? "emerald" : "amber"} />
                <MetricCard label="Gross Profit / Unit" value={fmtCurrency(result.grossProfitPerUnit)} tone={result.grossProfitPerUnit > 0 ? "emerald" : "danger"} />
                <MetricCard label="Total Cash Needed" value={fmtCurrency(result.totalCashNeeded, "USD", { compact: true })} />
                <MetricCard label="Required Price" value={fmtCurrency(result.requiredPrice)} sub={`for ${fmtPercent(input.targetMargin)} margin`} />
                <MetricCard label="Break-even Price" value={fmtCurrency(result.breakEvenPrice)} />
                <MetricCard label="Max Supplier Cost" value={fmtCurrency(result.maxSupplierCost)} sub="to hold target" />
                <MetricCard label="Max Freight Total" value={fmtCurrency(result.maxFreightTotal, "USD", { compact: true })} sub="to hold target" />
              </div>

              <Card>
                <SectionTitle title="Margin vs Target" right={<RiskBadge level={result.riskLevel} />} />
                <RiskMeter value={result.grossMargin} target={input.targetMargin} label="Gross margin" />
                <p className="mt-2 text-xs text-ink-muted">
                  {result.marginGap > 0
                    ? `Margin trails target by ${fmtPercent(result.marginGap)}. Raise price to ${fmtCurrency(result.requiredPrice)} or cut landed cost.`
                    : `Margin meets target with ${fmtPercent(-result.marginGap)} of headroom.`}
                </p>
              </Card>

              <div className="grid gap-6 sm:grid-cols-2">
                <Card>
                  <SectionTitle title="Cost Build-up" subtitle="Waterfall to landed cost." />
                  <LandedCostWaterfall data={[
                    { label: "Supplier", value: input.supplierUnitCost },
                    { label: "Freight", value: result.freightPerUnit },
                    { label: "Insurance", value: result.insurancePerUnit },
                    { label: "Duty", value: result.dutyPerUnit + result.additionalTariffPerUnit },
                    { label: "Fees", value: result.fixedFeesPerUnit },
                    { label: "Landed", value: 0 },
                  ]} />
                </Card>
                <Card>
                  <SectionTitle title="Cost Share" subtitle="Where each dollar goes." />
                  <CostBreakdownDonut data={result.costShare.map((c) => ({ label: c.label, value: c.value }))} />
                </Card>
              </div>

              <DisclaimerBox>{profile.note} Incoterm logic is simplified for analysis and is not legal or customs advice.</DisclaimerBox>
            </>
          )}

          {ai && <AIRecommendationPanel title="AI Landed Cost Explanation" data={ai.data} source={ai.source} warning={ai.warning} loading={loadingAi} />}
        </div>
      </div>
    </>
  );
}
