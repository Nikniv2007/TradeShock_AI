"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { NoDataGate } from "@/components/layout/NoDataGate";
import {
  Card, SectionTitle, Field, Input, NumberInput, Select, Button, RiskMeter,
  RiskBadge, StatusBadge, DisclaimerBox,
} from "@/components/ui/primitives";
import { AIConfidenceBadge } from "@/components/ai/AIPanel";
import { scoreHtsRisk } from "@/lib/finance/riskScoring";
import { requestAI } from "@/lib/ai/actions";
import { useStore } from "@/lib/store/useStore";
import { fmtPercent } from "@/lib/utils/formatters";
import type { HTSRiskLevel, HTSRiskOutput } from "@/lib/types";
import {
  FileWarning, Sparkles, ScrollText, HelpCircle, ClipboardCheck, ArrowRight,
  AlertTriangle, Info, Loader2,
} from "lucide-react";

const HTS_DISCLAIMER =
  "TradeShock AI does not provide customs, legal, tax, or compliance advice. HTS classification and duty determination can be legally complex. Use this tool only to prepare questions and documents. Confirm classifications, tariffs, duties, and filing decisions with a licensed customs broker, trade attorney, or official government source.";

interface Review {
  productName: string;
  productDescription: string;
  materials: string;
  primaryUse: string;
  secondaryUse: string;
  components: string;
  countryOfOrigin: string;
  currentHTSCode: string;
  currentTariffRate: number;
  supplierInvoiceDescription: string;
  packagingDescription: string;
  endCustomerType: string;
  similarProductReferences: string;
  notes: string;
}

const EXAMPLE: Review = {
  productName: "Decorative Storage Box",
  productDescription: "decorative storage box",
  materials: "",
  primaryUse: "",
  secondaryUse: "",
  components: "",
  countryOfOrigin: "China",
  currentHTSCode: "",
  currentTariffRate: 0,
  supplierInvoiceDescription: "assorted household goods",
  packagingDescription: "",
  endCustomerType: "",
  similarProductReferences: "",
  notes: "",
};

const HTS_TONE: Record<HTSRiskLevel, "emerald" | "amber" | "danger"> = { low: "emerald", medium: "amber", high: "danger" };

function guessMaterials(name: string): string {
  const n = name.toLowerCase();
  const hits: string[] = [];
  const map: [string, string][] = [
    ["steel", "Steel"], ["stainless", "Stainless steel"], ["aluminum", "Aluminum"], ["bamboo", "Bamboo"],
    ["wood", "Wood"], ["ceramic", "Ceramic"], ["glass", "Glass"], ["cotton", "Cotton / textile"],
    ["silicone", "Silicone"], ["fabric", "Textile fabric"], ["plastic", "Plastic"], ["metal", "Metal"],
  ];
  for (const [k, v] of map) if (n.includes(k)) hits.push(v);
  return hits.join(", ");
}

export default function HTSRiskPage() {
  return (
    <>
      <PageHeader
        title="HTS Code Risk Assistant"
        description="A pre-screen to prepare questions and documents for a licensed customs broker. It never assigns or confirms a classification."
        icon={FileWarning}
      />
      {/* Permanent disclaimer — TOP */}
      <div className="mb-6">
        <DisclaimerBox variant="hts">{HTS_DISCLAIMER}</DisclaimerBox>
      </div>
      <NoDataGate>
        <HTSBody />
      </NoDataGate>
    </>
  );
}

function HTSBody() {
  const { dataset } = useStore();
  const { products } = dataset;

  const [review, setReview] = React.useState<Review>(EXAMPLE);
  const [ai, setAi] = React.useState<{ data: HTSRiskOutput; source: string; warning?: string } | null>(null);
  const [loadingAi, setLoadingAi] = React.useState(false);
  const [checked, setChecked] = React.useState<Record<number, boolean>>({});

  function set<K extends keyof Review>(k: K, v: Review[K]) {
    setReview((s) => ({ ...s, [k]: v }));
    setAi(null);
  }

  function prefill(id: string) {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    setAi(null);
    setReview((s) => ({
      ...s,
      productName: p.name,
      productDescription: `${p.name} (${p.category})`,
      materials: guessMaterials(p.name),
      primaryUse: `${p.category} — household / commercial use`,
      countryOfOrigin: p.countryOfOrigin,
      currentHTSCode: p.currentHTSCode ?? "",
      currentTariffRate: p.currentTariffRate,
      supplierInvoiceDescription: p.name,
    }));
  }

  const score = React.useMemo(
    () => scoreHtsRisk({
      productDescription: review.productDescription,
      materials: review.materials,
      primaryUse: review.primaryUse,
      components: review.components,
      currentHTSCode: review.currentHTSCode,
      supplierInvoiceDescription: review.supplierInvoiceDescription,
    }),
    [review]
  );

  const missingDrivers = score.topDrivers.filter((d) => /^(Missing|No )/.test(d.label));
  const htsAiLevel: HTSRiskLevel = score.riskLevel === "safe" || score.riskLevel === "watch" ? "low" : score.riskLevel === "warning" ? "medium" : "high";

  async function generate() {
    setLoadingAi(true);
    setChecked({});
    const res = await requestAI("hts_risk", {
      descriptionQualityScore: score.descriptionQualityScore,
      missingInformation: missingDrivers.map((d) => d.label.replace(/^Missing /, "").replace(/^No /, "")),
      classificationConcern: score.explanation,
      riskLevel: htsAiLevel,
    });
    setAi(res as never);
    setLoadingAi(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        {/* Inputs */}
        <Card>
          <SectionTitle
            icon={ScrollText}
            title="Product Details for Pre-Screen"
            subtitle="The more precise the description, materials, and use, the fewer gaps a broker has to chase."
            right={
              <Select className="max-w-[190px]" defaultValue="" onChange={(e) => e.target.value && prefill(e.target.value)}>
                <option value="">Prefill from SKU…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            }
          />

          <div className="mb-3 flex items-start gap-2.5 rounded-lg border border-amber/20 bg-amber/[0.05] p-3 text-[11px] leading-relaxed text-amber">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Example of a flag: a broad description like <span className="font-mono">“decorative storage box”</span> with no materials or use can span
              wood (4420), plastic (3924), steel (7326), or textile (6307) headings — each with a different duty rate. Vague wording is a classification risk, not an answer.
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Product name"><Input value={review.productName} onChange={(e) => set("productName", e.target.value)} /></Field>
            <Field label="Country of origin"><Input value={review.countryOfOrigin} onChange={(e) => set("countryOfOrigin", e.target.value)} /></Field>
          </div>

          <Field label="Product description" hint="Be specific: construction, form, finish, function." className="mt-3">
            <textarea
              value={review.productDescription}
              onChange={(e) => set("productDescription", e.target.value)}
              rows={3}
              className="input resize-y"
              placeholder="e.g. Wall-mounted storage box with a hinged lid, powder-coated cold-rolled steel body…"
            />
          </Field>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Materials" hint="Composition by weight/percentage where possible."><Input value={review.materials} onChange={(e) => set("materials", e.target.value)} /></Field>
            <Field label="Components" hint="Multi-material parts / assemblies."><Input value={review.components} onChange={(e) => set("components", e.target.value)} /></Field>
            <Field label="Primary use"><Input value={review.primaryUse} onChange={(e) => set("primaryUse", e.target.value)} /></Field>
            <Field label="Secondary use"><Input value={review.secondaryUse} onChange={(e) => set("secondaryUse", e.target.value)} /></Field>
            <Field label="Current HTS code" hint="Baseline to review — not a confirmation."><Input value={review.currentHTSCode} onChange={(e) => set("currentHTSCode", e.target.value)} placeholder="e.g. 7326.90.86" /></Field>
            <Field label="Current tariff rate" hint="0.12 = 12%."><NumberInput value={review.currentTariffRate} onChange={(v) => set("currentTariffRate", v)} step="0.01" /></Field>
            <Field label="Supplier invoice description"><Input value={review.supplierInvoiceDescription} onChange={(e) => set("supplierInvoiceDescription", e.target.value)} /></Field>
            <Field label="Packaging description"><Input value={review.packagingDescription} onChange={(e) => set("packagingDescription", e.target.value)} /></Field>
            <Field label="End customer type"><Input value={review.endCustomerType} onChange={(e) => set("endCustomerType", e.target.value)} placeholder="e.g. retail consumer" /></Field>
            <Field label="Similar product references"><Input value={review.similarProductReferences} onChange={(e) => set("similarProductReferences", e.target.value)} placeholder="rulings / comparable SKUs" /></Field>
          </div>

          <Field label="Optional notes" className="mt-3">
            <textarea value={review.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="input resize-y" placeholder="Anything unusual about the good, its use, or its origin." />
          </Field>
        </Card>

        {/* Deterministic pre-screen */}
        <div className="space-y-6">
          <Card>
            <SectionTitle icon={FileWarning} title="Description Quality Pre-Screen" subtitle="Deterministic — flags gaps that commonly cause misclassification." right={<RiskBadge level={score.riskLevel} />} />
            <div className="flex items-end gap-4">
              <div>
                <span className="stat-label">Description Quality</span>
                <div className="text-5xl font-bold tabular-nums text-ink">{score.descriptionQualityScore}<span className="text-xl text-ink-faint">/100</span></div>
              </div>
              <div className="flex-1 pb-2">
                <RiskMeter value={score.descriptionQualityScore / 100} target={0.75} label="Completeness vs. broker-ready target" />
              </div>
            </div>

            <div className="mt-4">
              <h5 className="stat-label mb-1.5">Top Gaps to Close</h5>
              {score.topDrivers.length === 0 ? (
                <p className="text-sm text-emerald">No major description gaps detected. A broker can still confirm the final classification.</p>
              ) : (
                <ul className="space-y-1.5 text-sm text-ink-muted">
                  {score.topDrivers.map((d, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-base-900/50 p-2.5">
                      <span className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" /><span><span className="text-ink">{d.label}</span> — {d.detail}</span></span>
                      <span className="shrink-0 font-mono text-xs text-amber tabular-nums">+{Math.round(d.contribution)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 rounded-lg border border-slateaccent/20 bg-slateaccent/[0.05] p-3">
              <p className="stat-label mb-1">Recommended Action</p>
              <p className="text-sm text-ink">{score.recommendedAction}</p>
            </div>
            <p className="mt-3 text-xs text-ink-faint">{score.explanation}</p>
          </Card>

          <Card className="border-slateaccent/20 bg-gradient-to-b from-slateaccent/[0.05] to-transparent">
            <SectionTitle
              icon={Sparkles}
              title="AI Broker-Prep Assistant"
              subtitle="Generates questions and a document checklist — never a classification."
              right={<Button variant="primary" onClick={generate} disabled={loadingAi}><Sparkles className="h-3.5 w-3.5" /> {loadingAi ? "Preparing…" : ai ? "Regenerate" : "Prepare Questions"}</Button>}
            />
            {loadingAi && <div className="flex items-center justify-center gap-2 py-6 text-sm text-ink-muted"><Loader2 className="h-4 w-4 animate-spin" /> Preparing broker questions…</div>}
            {!ai && !loadingAi && <p className="text-sm text-ink-muted">Click “Prepare Questions” to turn the pre-screen into a broker-ready question list and document checklist.</p>}
            {ai && !loadingAi && <HTSResult data={ai.data} source={ai.source} warning={ai.warning} checked={checked} setChecked={setChecked} />}
          </Card>
        </div>
      </div>

      {/* Permanent disclaimer — BOTTOM */}
      <DisclaimerBox variant="hts">{HTS_DISCLAIMER}</DisclaimerBox>
    </div>
  );
}

function HTSResult({
  data, source, warning, checked, setChecked,
}: {
  data: HTSRiskOutput;
  source?: string;
  warning?: string;
  checked: Record<number, boolean>;
  setChecked: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  return (
    <div className="space-y-4">
      {warning && <div className="flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/5 px-3 py-2 text-xs text-amber"><Info className="h-3.5 w-3.5" /> {warning}</div>}
      {source && source !== "mock" && <div className="text-[11px] text-emerald">Live AI · {source.replace("live-", "")}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge tone={HTS_TONE[data.riskLevel]}>{data.riskLevel.toUpperCase()} classification risk</StatusBadge>
        <AIConfidenceBadge confidence={data.confidence} />
        <span className="font-mono text-xs text-ink-muted">quality {data.descriptionQualityScore}/100</span>
      </div>

      <div>
        <h5 className="stat-label mb-1">Classification Concern</h5>
        <p className="text-sm leading-relaxed text-ink-muted">{data.classificationConcern}</p>
      </div>

      {data.missingInformation?.length > 0 && (
        <div>
          <h5 className="stat-label mb-1.5 flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Missing Information</h5>
          <ul className="space-y-1 text-sm text-ink-muted">
            {data.missingInformation.map((m, i) => <li key={i} className="flex gap-2"><span className="text-amber">·</span>{m}</li>)}
          </ul>
        </div>
      )}

      {data.brokerQuestions?.length > 0 && (
        <div>
          <h5 className="stat-label mb-1.5 flex items-center gap-1.5"><HelpCircle className="h-3.5 w-3.5" /> Questions to Prepare for Your Broker</h5>
          <ul className="space-y-1.5 text-sm text-ink-muted">
            {data.brokerQuestions.map((q, i) => <li key={i} className="flex gap-2"><span className="text-cyan">?</span>{q}</li>)}
          </ul>
        </div>
      )}

      {data.documentationChecklist?.length > 0 && (
        <div>
          <h5 className="stat-label mb-1.5 flex items-center gap-1.5"><ClipboardCheck className="h-3.5 w-3.5" /> Documentation Checklist</h5>
          <div className="space-y-1">
            {data.documentationChecklist.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setChecked((s) => ({ ...s, [i]: !s[i] }))}
                className="flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-sm text-ink-muted hover:bg-white/[0.03]"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked[i] ? "border-emerald bg-emerald/20 text-emerald" : "border-white/20"}`}>
                  {checked[i] ? "✓" : ""}
                </span>
                <span className={checked[i] ? "line-through decoration-white/25" : ""}>{d}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-lg border border-emerald/25 bg-emerald/[0.06] p-3">
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald" />
        <div>
          <p className="stat-label mb-0.5 text-emerald">Next Best Action</p>
          <p className="text-sm text-ink">{data.nextBestAction}</p>
        </div>
      </div>

      <DisclaimerBox variant="hts">{data.disclaimer}</DisclaimerBox>
    </div>
  );
}
