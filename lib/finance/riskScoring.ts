// ─────────────────────────────────────────────────────────────
// Transparent, explainable risk scoring. Every score returns its
// top drivers and a recommended action so nothing is a black box.
// Thresholds:  0–30 Safe · 31–55 Watch · 56–75 Warning · 76–100 Critical
// ─────────────────────────────────────────────────────────────

import type { Product, Supplier, RiskLevel, HTSRiskReview } from "@/lib/types";
import { riskLevelFromScore, clamp } from "@/lib/utils/formatters";
import { clamp01, safeDiv } from "@/lib/utils/validators";

export interface ScoreDriver {
  label: string;
  contribution: number; // points added to the score
  detail: string;
}

export interface RiskScore {
  score: number; // 0..100
  riskLevel: RiskLevel;
  topDrivers: ScoreDriver[];
  recommendedAction: string;
  explanation: string;
}

function assemble(drivers: ScoreDriver[], recommendedAction: string, explanation: string): RiskScore {
  const raw = drivers.reduce((sum, d) => sum + d.contribution, 0);
  const score = clamp(Math.round(raw), 0, 100);
  const topDrivers = [...drivers]
    .filter((d) => d.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);
  return {
    score,
    riskLevel: riskLevelFromScore(score),
    topDrivers,
    recommendedAction,
    explanation,
  };
}

// ─── 11.2 SKU margin risk ───
export function scoreSkuMarginRisk(params: {
  grossMargin: number;
  targetMargin: number;
  scenarioMargin: number; // margin under stress
  tariffRate: number;
  freightSharePercent: number; // 0..1 of landed cost
  supplierConcentration: number; // 0..1
  leadTimeDays: number;
  priceFlexibility: "low" | "medium" | "high";
  demandSensitivity: "low" | "medium" | "high";
}): RiskScore {
  const gap = params.targetMargin - params.grossMargin;
  const drivers: ScoreDriver[] = [
    {
      label: "Margin below target",
      contribution: gap > 0 ? Math.min(30, gap * 200) : 0,
      detail: `Gross margin trails target by ${(Math.max(0, gap) * 100).toFixed(1)} pts.`,
    },
    {
      label: "Margin collapse under shock",
      contribution: params.scenarioMargin < 0 ? 25 : params.scenarioMargin < params.targetMargin ? 15 : 0,
      detail: `Stress-scenario margin is ${(params.scenarioMargin * 100).toFixed(1)}%.`,
    },
    {
      label: "High tariff exposure",
      contribution: clamp01(params.tariffRate) * 20,
      detail: `Effective tariff rate ${(params.tariffRate * 100).toFixed(1)}%.`,
    },
    {
      label: "High freight share of cost",
      contribution: params.freightSharePercent > 0.25 ? 8 : 0,
      detail: `Freight is ${(params.freightSharePercent * 100).toFixed(0)}% of landed cost.`,
    },
    {
      label: "Supplier concentration",
      contribution: params.supplierConcentration > 0.5 ? 8 : 0,
      detail: `${(params.supplierConcentration * 100).toFixed(0)}% exposure to one source.`,
    },
    {
      label: "Long lead time",
      contribution: params.leadTimeDays > 45 ? 6 : 0,
      detail: `Lead time ${params.leadTimeDays} days ties up cash.`,
    },
    {
      label: "Low price flexibility",
      contribution: params.priceFlexibility === "low" ? 6 : params.priceFlexibility === "medium" ? 3 : 0,
      detail: `Price flexibility is ${params.priceFlexibility}.`,
    },
    {
      label: "High demand sensitivity",
      contribution: params.demandSensitivity === "high" ? 5 : 0,
      detail: "Demand may fall if price rises.",
    },
  ];
  const action =
    gap > 0.12
      ? "Raise price or switch supplier — margin is materially below target."
      : gap > 0
        ? "Add a tariff surcharge or renegotiate freight to close the gap."
        : "Monitor; margin is healthy under current assumptions.";
  return assemble(drivers, action, "SKU margin risk blends structural margin, tariff exposure, and stress resilience.");
}

// ─── 11.3 Supplier risk ───
export function scoreSupplierRisk(supplier: Supplier, countryExposure = 0): RiskScore {
  const drivers: ScoreDriver[] = [
    { label: "Reliability", contribution: (100 - supplier.reliabilityScore) * 0.18, detail: `Reliability ${supplier.reliabilityScore}/100.` },
    { label: "Quality", contribution: (100 - supplier.qualityScore) * 0.12, detail: `Quality ${supplier.qualityScore}/100.` },
    { label: "Defect rate", contribution: clamp01(supplier.defectRate) * 60, detail: `Defect rate ${(supplier.defectRate * 100).toFixed(1)}%.` },
    { label: "Lead time", contribution: supplier.averageLeadTimeDays > 45 ? 10 : supplier.averageLeadTimeDays > 30 ? 5 : 0, detail: `Lead time ${supplier.averageLeadTimeDays} days.` },
    { label: "Deposit burden", contribution: clamp01(supplier.depositRequiredPercent) * 12, detail: `Requires ${(supplier.depositRequiredPercent * 100).toFixed(0)}% deposit.` },
    { label: "Compliance", contribution: (100 - supplier.complianceScore) * 0.1, detail: `Compliance/docs ${supplier.complianceScore}/100.` },
    { label: "Communication", contribution: (100 - supplier.communicationScore) * 0.05, detail: `Communication ${supplier.communicationScore}/100.` },
    { label: "Capacity", contribution: (100 - supplier.capacityScore) * 0.05, detail: `Capacity ${supplier.capacityScore}/100.` },
    { label: "Country exposure", contribution: clamp01(countryExposure) * 12, detail: `Concentration in ${supplier.country}.` },
  ];
  const action =
    supplier.defectRate > 0.05
      ? "Qualify an alternate supplier; defect rate is elevated."
      : supplier.reliabilityScore < 70
        ? "Tighten SLAs and monitor on-time performance."
        : "Maintain; supplier profile is acceptable.";
  return assemble(drivers, action, "Supplier risk weights reliability and defects most heavily, then cash and compliance factors.");
}

// ─── 11.5 HTS classification risk (deterministic pre-screen) ───
export function scoreHtsRisk(review: Pick<HTSRiskReview,
  "productDescription" | "materials" | "primaryUse" | "components" | "currentHTSCode" | "supplierInvoiceDescription">
): RiskScore & { descriptionQualityScore: number } {
  const vague = /^(assorted|misc|decorative|general|various|storage|box|item|goods)/i;
  const drivers: ScoreDriver[] = [
    { label: "Vague product description", contribution: !review.productDescription || review.productDescription.length < 25 || vague.test(review.productDescription.trim()) ? 22 : 0, detail: "Description is short or generic." },
    { label: "Missing materials", contribution: !review.materials?.trim() ? 20 : 0, detail: "Material composition drives many classifications." },
    { label: "Missing primary use", contribution: !review.primaryUse?.trim() ? 16 : 0, detail: "Function/use can determine the heading." },
    { label: "Missing components", contribution: !review.components?.trim() ? 8 : 0, detail: "Multi-material goods may be classified by essential character." },
    { label: "No current HTS code", contribution: !review.currentHTSCode?.trim() ? 12 : 0, detail: "No baseline classification to review against." },
    { label: "Broad invoice text", contribution: review.supplierInvoiceDescription && vague.test(review.supplierInvoiceDescription.trim()) ? 10 : 0, detail: "Supplier invoice wording is broad." },
  ];
  const filled = [review.productDescription, review.materials, review.primaryUse, review.components].filter((f) => f && f.trim().length > 3).length;
  const descriptionQualityScore = Math.round(safeDiv(filled, 4, 0) * 100);
  const action =
    drivers.reduce((s, d) => s + d.contribution, 0) > 40
      ? "Do not self-classify. Prepare materials/use details and consult a licensed customs broker."
      : "Confirm the tentative classification with a licensed customs broker before filing.";
  const base = assemble(drivers, action, "HTS pre-screen flags description gaps that commonly cause misclassification. It is not a classification.");
  return { ...base, descriptionQualityScore };
}

/** Portfolio-level supplier concentration by landed-cost exposure (0..1). */
export function supplierConcentration(products: Product[], suppliers: Supplier[]): {
  topCountry: string;
  topCountryShare: number;
  topSupplier: string;
  topSupplierShare: number;
} {
  const byCountry = new Map<string, number>();
  const bySupplier = new Map<string, number>();
  let total = 0;
  for (const p of products) {
    const landed = (p.supplierUnitCost * (1 + p.currentTariffRate) + p.freightPerUnit + p.otherFeesPerUnit) * Math.max(1, p.monthlyDemand);
    total += landed;
    const supplier = suppliers.find((s) => s.id === p.supplierId);
    const country = supplier?.country ?? p.countryOfOrigin;
    byCountry.set(country, (byCountry.get(country) ?? 0) + landed);
    if (supplier) bySupplier.set(supplier.name, (bySupplier.get(supplier.name) ?? 0) + landed);
  }
  const topC = [...byCountry.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const topS = [...bySupplier.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  return {
    topCountry: topC[0],
    topCountryShare: round01(safeDiv(topC[1], total, 0)),
    topSupplier: topS[0],
    topSupplierShare: round01(safeDiv(topS[1], total, 0)),
  };
}

function round01(n: number): number {
  return Math.round(clamp01(n) * 1000) / 1000;
}
