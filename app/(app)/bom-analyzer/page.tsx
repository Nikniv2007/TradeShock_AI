"use client";

import * as React from "react";
import Link from "next/link";
import { useStore } from "@/lib/store/useStore";
import { NoDataGate } from "@/components/layout/NoDataGate";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Card, SectionTitle, MetricCard, Button, Select, NumberInput, Toggle,
  StatusBadge, DisclaimerBox, EmptyState,
} from "@/components/ui/primitives";
import { AIRecommendationPanel } from "@/components/ai/AIPanel";
import { CostBreakdownDonut, HBarChart, CHART_COLORS } from "@/components/charts";
import { analyzeBOM } from "@/lib/finance/bomCalculations";
import { requestAI } from "@/lib/ai/actions";
import { fmtCurrency, fmtPercent } from "@/lib/utils/formatters";
import { num } from "@/lib/utils/validators";
import type { BOM, BOMComponent, RiskRecommendation } from "@/lib/types";
import {
  Boxes, Sparkles, RotateCcw, Percent, Coins, TrendingUp, Zap, AlertTriangle,
  Wrench, ShieldAlert, ArrowRight,
} from "lucide-react";

export default function BomAnalyzerPage() {
  return (
    <>
      <PageHeader
        title="BOM Tariff Exposure Analyzer"
        description="Roll a bill of materials up to the finished good and expose where duty risk concentrates — often not where cost concentrates."
        icon={Boxes}
      />
      <NoDataGate>
        <BomBody />
      </NoDataGate>
    </>
  );
}

function cloneBom(b: BOM): BOM {
  return { ...b, components: b.components.map((c) => ({ ...c })) };
}

type CompKey = "unitCost" | "quantityPerFinishedGood" | "tariffRate" | "freightAllocation" | "defectRate";

function BomBody() {
  const { dataset } = useStore();
  const boms = dataset.boms;
  if (boms.length === 0) {
    return <EmptyState title="No BOMs available" message="This dataset has no bills of materials to analyze." icon={Boxes} />;
  }
  return <BomEditor boms={boms} />;
}

function BomEditor({ boms }: { boms: BOM[] }) {
  const [bomId, setBomId] = React.useState(boms[0].id);
  const [bom, setBom] = React.useState<BOM>(() => cloneBom(boms[0]));
  const [ai, setAi] = React.useState<{ data: RiskRecommendation; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);

  const analysis = React.useMemo(() => analyzeBOM(bom), [bom]);

  function loadBom(id: string) {
    const b = boms.find((x) => x.id === id);
    if (!b) return;
    setBomId(id);
    setBom(cloneBom(b));
    setAi(null);
  }
  function reset() {
    const b = boms.find((x) => x.id === bomId);
    if (b) setBom(cloneBom(b));
  }

  const setBomField = <K extends "sellingPrice" | "targetMargin">(k: K, v: number) =>
    setBom((s) => ({ ...s, [k]: num(v, 0) }));
  const setComp = (id: string, k: CompKey, v: number) =>
    setBom((s) => ({ ...s, components: s.components.map((c) => (c.id === id ? { ...c, [k]: num(v, 0) } : c)) }));
  const toggleComp = (id: string, k: "criticalComponent" | "substituteAvailable", v: boolean) =>
    setBom((s) => ({ ...s, components: s.components.map((c) => (c.id === id ? { ...c, [k]: v } : c)) }));

  // Analysis lookup by component id for the read-only table.
  const byId = React.useMemo(() => {
    const m = new Map<string, (typeof analysis.components)[number]>();
    for (const c of analysis.components) m.set(c.component.id, c);
    return m;
  }, [analysis]);

  // The key insight: the component whose tariff share most exceeds its cost share.
  const insight = React.useMemo(
    () => [...analysis.components].sort(
      (a, b) => (b.tariffSharePercent - b.costSharePercent) - (a.tariffSharePercent - a.costSharePercent)
    )[0],
    [analysis]
  );

  const marginBelowTarget = analysis.finishedGrossMargin < bom.targetMargin;
  const shockDrop = analysis.finishedGrossMargin - analysis.shockedMargin;

  async function explain() {
    setLoadingAi(true);
    const top = analysis.mostExposedComponents;
    const res = await requestAI("bom_exposure", {
      productName: bom.name,
      riskLevel: marginBelowTarget ? "warning" : "watch",
      totalBOMCost: analysis.totalBOMCost,
      totalTariffExposure: analysis.totalTariffExposure,
      finishedGrossMargin: analysis.finishedGrossMargin,
      shockedMargin: analysis.shockedMargin,
      summary: `${bom.name} carries ${fmtCurrency(analysis.totalTariffExposure)}/unit of tariff exposure on a ${fmtCurrency(analysis.totalBOMCost)} BOM. ${insight ? `${insight.component.componentName} is ${fmtPercent(insight.costSharePercent)} of cost but ${fmtPercent(insight.tariffSharePercent)} of tariff exposure.` : ""}`,
      keyFindings: top.map(
        (c) => `${c.component.componentName}: ${fmtPercent(c.tariffSharePercent)} of tariff exposure vs ${fmtPercent(c.costSharePercent)} of BOM cost (${c.component.countryOfOrigin}).`
      ),
      topDrivers: top.map((c) => ({
        label: c.component.componentName,
        detail: `${(c.tariffSharePercent * 100).toFixed(0)}% of tariff exposure, ${(c.costSharePercent * 100).toFixed(0)}% of cost`,
      })),
      recommendedAction: insight
        ? `Prioritize sourcing alternatives, reclassification, or redesign for ${insight.component.componentName} — it drives a disproportionate share of duty relative to its cost.`
        : "Diversify sourcing on the most tariff-exposed components.",
    });
    setAi({ data: res.data as RiskRecommendation, source: res.source, warning: res.warning });
    setLoadingAi(false);
  }

  const donutData = analysis.components.map((c) => ({ label: c.component.componentName, value: c.landedCostPerFinishedGood }));
  const tariffData = [...analysis.components]
    .sort((a, b) => b.tariffCostPerFinishedGood - a.tariffCostPerFinishedGood)
    .map((c) => ({ label: c.component.componentName, value: c.tariffCostPerFinishedGood }));

  return (
    <div className="space-y-6">
      {/* Selector + finished-good inputs */}
      <Card>
        <SectionTitle
          icon={Boxes}
          title="Finished Good"
          subtitle="Pick a demo BOM, then tune the finished-good economics and each component below."
          right={
            <div className="flex items-center gap-2">
              <Select className="max-w-[220px]" value={bomId} onChange={(e) => loadBom(e.target.value)}>
                {boms.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
              <Button onClick={reset}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
            </div>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="label">Selling price / finished good</span>
            <NumberInput value={bom.sellingPrice} onChange={(v) => setBomField("sellingPrice", v)} />
          </label>
          <label className="block">
            <span className="label">Target margin</span>
            <NumberInput value={bom.targetMargin} onChange={(v) => setBomField("targetMargin", v)} step="0.01" />
            <span className="mt-1 block text-[11px] text-ink-faint">e.g. 0.34 = 34%</span>
          </label>
          <div className="flex items-end">
            <div className="w-full rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2 text-xs text-ink-muted">
              {bom.finishedSku} · {bom.components.length} components
            </div>
          </div>
        </div>
      </Card>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Total BOM Cost" value={fmtCurrency(analysis.totalBOMCost)} tone="cyan" icon={Coins} sub="landed / finished good" />
        <MetricCard label="Tariff Exposure" value={fmtCurrency(analysis.totalTariffExposure)} tone="amber" icon={ShieldAlert} sub="duty / finished good" />
        <MetricCard label="Finished Gross Margin" value={fmtPercent(analysis.finishedGrossMargin)} tone={marginBelowTarget ? "amber" : "emerald"} icon={Percent} sub={`target ${fmtPercent(bom.targetMargin)}`} />
        <MetricCard label="Gross Profit / Unit" value={fmtCurrency(analysis.finishedGrossProfit)} tone={analysis.finishedGrossProfit > 0 ? "emerald" : "danger"} icon={TrendingUp} />
        <MetricCard label="Shocked BOM Cost" value={fmtCurrency(analysis.shockedBOMCost)} tone="danger" icon={Zap} sub="+10pt tariff shock" />
        <MetricCard label="Shocked Margin" value={fmtPercent(analysis.shockedMargin)} tone={analysis.shockedMargin < bom.targetMargin ? "danger" : "amber"} icon={Zap} sub={`−${fmtPercent(shockDrop)} vs base`} />
      </div>

      {/* Key insight callout */}
      {insight && insight.tariffSharePercent > insight.costSharePercent + 0.001 && (
        <Card className="border-amber/25 bg-gradient-to-b from-amber/[0.06] to-transparent">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber/10 p-2 text-amber ring-1 ring-amber/25"><AlertTriangle className="h-4 w-4" /></div>
            <div>
              <h3 className="text-sm font-semibold text-ink">The exposure is concentrated, not proportional</h3>
              <p className="mt-1 text-sm text-ink-muted">
                <span className="font-medium text-ink">{insight.component.componentName}</span> ({insight.component.countryOfOrigin}) is only{" "}
                <span className="font-semibold text-cyan">{fmtPercent(insight.costSharePercent)}</span> of BOM cost, but{" "}
                <span className="font-semibold text-amber">{fmtPercent(insight.tariffSharePercent)}</span> of your tariff exposure.
                A trade action against that component or origin hits margin far harder than its cost share suggests — so target it first.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Component editor */}
      <Card>
        <SectionTitle icon={Wrench} title="Component Editor" subtitle="Adjust cost, quantity, duty rate, freight, defect, and sourcing flags. Everything recomputes live." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-medium">Component</th>
                <th className="px-2 py-2 font-medium">Unit cost</th>
                <th className="px-2 py-2 font-medium">Qty / FG</th>
                <th className="px-2 py-2 font-medium">Tariff</th>
                <th className="px-2 py-2 font-medium">Freight</th>
                <th className="px-2 py-2 font-medium">Defect</th>
                <th className="px-2 py-2 text-center font-medium">Critical</th>
                <th className="px-2 py-2 text-center font-medium">Substitute</th>
              </tr>
            </thead>
            <tbody>
              {bom.components.map((c) => (
                <tr key={c.id} className="border-b border-white/[0.04]">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-ink">{c.componentName}</div>
                    <div className="text-[11px] text-ink-faint">{c.supplierName ?? "—"} · {c.countryOfOrigin}</div>
                  </td>
                  <td className="px-2 py-2"><NumberInput className="w-20 py-1" value={c.unitCost} onChange={(v) => setComp(c.id, "unitCost", v)} step="0.1" /></td>
                  <td className="px-2 py-2"><NumberInput className="w-16 py-1" value={c.quantityPerFinishedGood} onChange={(v) => setComp(c.id, "quantityPerFinishedGood", v)} step="1" /></td>
                  <td className="px-2 py-2"><NumberInput className="w-20 py-1" value={c.tariffRate} onChange={(v) => setComp(c.id, "tariffRate", v)} step="0.01" /></td>
                  <td className="px-2 py-2"><NumberInput className="w-20 py-1" value={c.freightAllocation} onChange={(v) => setComp(c.id, "freightAllocation", v)} step="0.01" /></td>
                  <td className="px-2 py-2"><NumberInput className="w-20 py-1" value={c.defectRate} onChange={(v) => setComp(c.id, "defectRate", v)} step="0.01" /></td>
                  <td className="px-2 py-2"><div className="flex justify-center"><Toggle checked={c.criticalComponent} onChange={(v) => toggleComp(c.id, "criticalComponent", v)} /></div></td>
                  <td className="px-2 py-2"><div className="flex justify-center"><Toggle checked={c.substituteAvailable} onChange={(v) => toggleComp(c.id, "substituteAvailable", v)} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Analysis table */}
      <Card>
        <SectionTitle icon={Percent} title="Exposure Breakdown" subtitle="Rows shaded amber carry more tariff share than cost share — the components to watch." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <th className="py-2 pr-3 font-medium">Component</th>
                <th className="px-2 py-2 font-medium">Supplier</th>
                <th className="px-2 py-2 font-medium">Country</th>
                <th className="px-2 py-2 text-right font-medium">Unit cost</th>
                <th className="px-2 py-2 text-right font-medium">Qty</th>
                <th className="px-2 py-2 text-right font-medium">Landed / FG</th>
                <th className="px-2 py-2 text-right font-medium">Tariff / FG</th>
                <th className="px-2 py-2 text-right font-medium">Cost share</th>
                <th className="px-2 py-2 text-right font-medium">Tariff share</th>
                <th className="px-2 py-2 text-center font-medium">Critical</th>
                <th className="px-2 py-2 text-center font-medium">Sub.</th>
              </tr>
            </thead>
            <tbody>
              {bom.components.map((cmp) => {
                const a = byId.get(cmp.id);
                if (!a) return null;
                const skewed = a.tariffSharePercent > a.costSharePercent + 0.05;
                return (
                  <tr key={cmp.id} className={`border-b border-white/[0.04] ${skewed ? "bg-amber/[0.06]" : ""}`}>
                    <td className="py-2 pr-3 font-medium text-ink">
                      {skewed && <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber align-middle" />}
                      {cmp.componentName}
                    </td>
                    <td className="px-2 py-2 text-ink-muted">{cmp.supplierName ?? "—"}</td>
                    <td className="px-2 py-2 text-ink-muted">{cmp.countryOfOrigin}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink">{fmtCurrency(cmp.unitCost)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{cmp.quantityPerFinishedGood}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-cyan">{fmtCurrency(a.landedCostPerFinishedGood)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-amber">{fmtCurrency(a.tariffCostPerFinishedGood)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-ink-muted">{fmtPercent(a.costSharePercent)}</td>
                    <td className={`px-2 py-2 text-right tabular-nums font-medium ${skewed ? "text-amber" : "text-ink"}`}>{fmtPercent(a.tariffSharePercent)}</td>
                    <td className="px-2 py-2 text-center">{cmp.criticalComponent ? <StatusBadge tone="danger">Critical</StatusBadge> : <span className="text-ink-faint">—</span>}</td>
                    <td className="px-2 py-2 text-center text-xs">{cmp.substituteAvailable ? <span className="text-emerald">Yes</span> : <span className="text-ink-faint">No</span>}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-left text-xs text-ink-muted">
                <td className="py-2 pr-3 font-semibold text-ink" colSpan={5}>Finished good</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-cyan">{fmtCurrency(analysis.totalBOMCost)}</td>
                <td className="px-2 py-2 text-right tabular-nums font-semibold text-amber">{fmtCurrency(analysis.totalTariffExposure)}</td>
                <td className="px-2 py-2 text-right tabular-nums">100%</td>
                <td className="px-2 py-2 text-right tabular-nums">100%</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={Coins} title="Component Cost Breakdown" subtitle="Landed cost per finished good, by component." />
          <CostBreakdownDonut data={donutData} />
        </Card>
        <Card>
          <SectionTitle icon={ShieldAlert} title="Tariff Exposure by Component" subtitle="Duty cost per finished good — where the shock lands." />
          <HBarChart data={tariffData} color={CHART_COLORS.danger} format={(v) => fmtCurrency(v)} />
        </Card>
      </div>

      {/* Risk lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle icon={ShieldAlert} title="Most Tariff-Exposed" subtitle="Top duty-share components — first targets for resourcing or reclassification." />
          <div className="space-y-2">
            {analysis.mostExposedComponents.map((c, i) => (
              <div key={c.component.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber/10 text-xs font-semibold text-amber">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.component.componentName}</p>
                    <p className="truncate text-[11px] text-ink-faint">{c.component.countryOfOrigin} · {fmtPercent(c.tariffSharePercent)} of tariff vs {fmtPercent(c.costSharePercent)} of cost</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold tabular-nums text-amber">{fmtCurrency(c.tariffCostPerFinishedGood)}</div>
                  {c.substituteSavingsEstimate > 0 && <div className="text-[10px] text-emerald">save ~{fmtCurrency(c.substituteSavingsEstimate)}/u</div>}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <SectionTitle icon={Wrench} title="Critical Components" subtitle="Flagged critical — no easy substitution or single points of failure." />
          {analysis.criticalComponents.length === 0 ? (
            <p className="text-sm text-ink-faint">No components flagged critical on this BOM.</p>
          ) : (
            <div className="space-y-2">
              {analysis.criticalComponents.map((c) => (
                <div key={c.component.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-base-900/50 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{c.component.componentName}</p>
                    <p className="truncate text-[11px] text-ink-faint">
                      {c.component.supplierName ?? "—"} · {c.component.countryOfOrigin} · {c.component.substituteAvailable ? "substitute available" : "no substitute"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge tone={c.component.substituteAvailable ? "amber" : "danger"}>{c.component.substituteAvailable ? "Sub avail." : "Single source"}</StatusBadge>
                    <span className="text-sm font-semibold tabular-nums text-cyan">{fmtCurrency(c.landedCostPerFinishedGood)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AI */}
      <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
        <SectionTitle
          icon={Sparkles}
          title="AI Exposure Analyst"
          subtitle="Deterministic BOM math, narrated into a sourcing action plan."
          right={<Button variant="primary" onClick={explain} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Analyzing…" : ai ? "Regenerate" : "Analyze Exposure"}</Button>}
        />
        {!ai && !loadingAi && (
          <p className="text-sm text-ink-muted">
            The tables above already tell you where duty concentrates. Click <span className="text-ink">Analyze Exposure</span> to turn the top drivers into prioritized sourcing, reclassification, and redesign moves.
            <Link href="/tariff-simulator" className="ml-1 inline-flex items-center gap-1 text-slateaccent hover:underline">Run a full tariff shock <ArrowRight className="h-3 w-3" /></Link>
          </p>
        )}
      </Card>

      {(ai || loadingAi) && (
        <AIRecommendationPanel title="AI BOM Exposure Recommendation" data={ai?.data} source={ai?.source} warning={ai?.warning} loading={loadingAi} />
      )}

      <DisclaimerBox variant="financial">
        BOM roll-ups, tariff exposure, and substitute savings are estimates from demo assumptions and simplified duty logic.
        They are not customs, legal, or tax advice, and are not guarantees of future costs or margins. Confirm classifications and
        duty rates with a licensed customs broker. All demo data is fictional.
      </DisclaimerBox>
    </div>
  );
}
