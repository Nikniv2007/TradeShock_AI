// ─────────────────────────────────────────────────────────────
// Supplier switching ROI engine. Compares 2–5 suppliers for the same
// product across landed margin AND cash-flow/operational risk — never
// picking the cheapest unit cost blindly.
// ─────────────────────────────────────────────────────────────

import type { Currency, PaymentTerms } from "@/lib/types";
import {
  calculateLandedCost,
  calculateGrossMargin,
  calculateDefectAdjustedCost,
  calculateWorkingCapitalImpact,
} from "./calculations";
import { clamp, riskLevelFromScore } from "@/lib/utils/formatters";
import { safeDiv, clamp01 } from "@/lib/utils/validators";
import type { RiskLevel } from "@/lib/types";

export interface SupplierOption {
  id: string;
  name: string;
  country: string;
  currency: Currency;
  unitCost: number;
  moq: number;
  freightPerUnit: number;
  tariffRate: number;
  additionalTariffRate: number;
  leadTimeDays: number;
  paymentTerms: PaymentTerms;
  depositPercent: number;
  defectRate: number;
  reliabilityScore: number;
  qualityScore: number;
  communicationScore: number;
  capacityScore: number;
  complianceScore: number;
  currencyRisk: "low" | "medium" | "high";
  isCurrent: boolean;
  switchingCost: number;
  toolingCost: number;
  sampleCost: number;
  onboardingDays: number;
  notes?: string;
}

export interface SupplierEvaluation {
  option: SupplierOption;
  landedCostPerUnit: number;
  defectAdjustedCost: number;
  grossMargin: number;
  cashTiedInMOQ: number;
  workingCapital: number;
  leadTimeInventoryValue: number;
  paymentTermCashBurden: number; // higher = worse (prepaid/deposit heavy)
  supplierScore: number; // 0..100 higher better
  riskScore: number; // 0..100 higher worse
  riskLevel: RiskLevel;
  cashFlowScore: number; // 0..100 higher better
  switchingPaybackMonths: number;
  marginImprovementVsCurrent: number;
  bestCaseMargin: number;
  worstCaseMargin: number;
}

const PAYMENT_BURDEN: Record<PaymentTerms, number> = {
  prepaid: 100,
  deposit_50_50: 70,
  deposit_30_70: 55,
  net_15: 35,
  net_30: 20,
  net_60: 5,
};

export function evaluateSupplier(
  opt: SupplierOption,
  ctx: { sellingPrice: number; targetMargin: number; monthlyDemand: number; financingCostPercent: number }
): SupplierEvaluation {
  const qty = Math.max(1, ctx.monthlyDemand);
  const landed = calculateLandedCost({
    incoterm: "FOB",
    supplierUnitCost: opt.unitCost,
    quantity: qty,
    freightTotal: opt.freightPerUnit * qty,
    insuranceTotal: 0,
    brokerFees: 0,
    portFees: 0,
    handlingFees: 0,
    warehouseFees: 0,
    domesticDeliveryFees: 0,
    inspectionFees: 0,
    otherFees: 0,
    tariffRate: opt.tariffRate,
    additionalTariffRate: opt.additionalTariffRate,
    sellingPrice: ctx.sellingPrice,
    targetMargin: ctx.targetMargin,
    currency: opt.currency,
  });

  const defectAdjustedCost = calculateDefectAdjustedCost(landed.landedCostPerUnit, opt.defectRate);
  const grossMargin = calculateGrossMargin(ctx.sellingPrice, defectAdjustedCost).grossMargin;

  const wc = calculateWorkingCapitalImpact({
    landedCostPerUnit: landed.landedCostPerUnit,
    moq: opt.moq,
    monthlyDemand: ctx.monthlyDemand,
    leadTimeDays: opt.leadTimeDays,
    depositPercent: opt.depositPercent,
    financingCostPercent: ctx.financingCostPercent,
  });

  const paymentTermCashBurden = PAYMENT_BURDEN[opt.paymentTerms];

  // Supplier quality score (higher better): weighted operational scores.
  const supplierScore = clamp(
    Math.round(
      opt.reliabilityScore * 0.3 +
        opt.qualityScore * 0.25 +
        opt.complianceScore * 0.15 +
        opt.communicationScore * 0.1 +
        opt.capacityScore * 0.1 +
        (100 - opt.defectRate * 100 * 10) * 0.1
    ),
    0,
    100
  );

  // Risk score (higher worse).
  const riskScore = clamp(
    Math.round(
      (100 - opt.reliabilityScore) * 0.25 +
        opt.defectRate * 100 * 5 +
        (opt.leadTimeDays > 45 ? 15 : opt.leadTimeDays > 30 ? 8 : 0) +
        (opt.currencyRisk === "high" ? 15 : opt.currencyRisk === "medium" ? 7 : 0) +
        (100 - opt.complianceScore) * 0.15 +
        paymentTermCashBurden * 0.1
    ),
    0,
    100
  );

  // Cash-flow score (higher better): favor short lead time + soft terms + low deposit.
  const cashFlowScore = clamp(
    Math.round(
      (100 - paymentTermCashBurden) * 0.5 +
        (opt.leadTimeDays <= 25 ? 30 : opt.leadTimeDays <= 40 ? 18 : 6) +
        (1 - clamp01(opt.depositPercent)) * 20
    ),
    0,
    100
  );

  const oneTimeSwitchCost = opt.switchingCost + opt.toolingCost + opt.sampleCost;
  const monthlyMarginDollars = grossMargin * ctx.sellingPrice * qty;
  const switchingPaybackMonths = round1(safeDiv(oneTimeSwitchCost, Math.max(1, monthlyMarginDollars), 0));

  return {
    option: opt,
    landedCostPerUnit: round2(landed.landedCostPerUnit),
    defectAdjustedCost: round2(defectAdjustedCost),
    grossMargin: round4(grossMargin),
    cashTiedInMOQ: wc.cashTiedInMOQ,
    workingCapital: wc.totalWorkingCapital,
    leadTimeInventoryValue: wc.leadTimeInventoryValue,
    paymentTermCashBurden,
    supplierScore,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    cashFlowScore,
    switchingPaybackMonths,
    marginImprovementVsCurrent: 0, // filled by compareSuppliers
    bestCaseMargin: round4(grossMargin + 0.03),
    worstCaseMargin: round4(grossMargin - clamp01(opt.defectRate) - 0.04),
  };
}

export interface SupplierComparison {
  evaluations: SupplierEvaluation[];
  bestByMargin?: SupplierEvaluation;
  bestByCashFlow?: SupplierEvaluation;
  bestByOperationalRisk?: SupplierEvaluation;
  bestByLeadTime?: SupplierEvaluation;
  bestOverall?: SupplierEvaluation;
  current?: SupplierEvaluation;
  recommendation: string;
}

export function compareSuppliers(
  options: SupplierOption[],
  ctx: { sellingPrice: number; targetMargin: number; monthlyDemand: number; financingCostPercent: number }
): SupplierComparison {
  const evaluations = options.map((o) => evaluateSupplier(o, ctx));
  const current = evaluations.find((e) => e.option.isCurrent);
  if (current) {
    for (const e of evaluations) e.marginImprovementVsCurrent = round4(e.grossMargin - current.grossMargin);
  }

  const best = (fn: (e: SupplierEvaluation) => number) =>
    [...evaluations].sort((a, b) => fn(b) - fn(a))[0];

  const bestByMargin = best((e) => e.grossMargin);
  const bestByCashFlow = best((e) => e.cashFlowScore);
  const bestByOperationalRisk = best((e) => -e.riskScore);
  const bestByLeadTime = best((e) => -e.option.leadTimeDays);

  // Overall blends margin, cash flow, and (inverse) risk.
  const bestOverall = best(
    (e) => e.grossMargin * 100 * 0.5 + e.cashFlowScore * 0.25 + (100 - e.riskScore) * 0.25
  );

  let recommendation = "Add at least two suppliers to compare.";
  if (bestByMargin && bestByCashFlow) {
    if (bestByMargin.option.id === bestByCashFlow.option.id) {
      recommendation = `${bestByMargin.option.name} leads on both landed margin and cash flow — the clearest choice. Still validate quality with a sample order before switching.`;
    } else {
      recommendation = `${bestByMargin.option.name} has the strongest landed margin (${(bestByMargin.grossMargin * 100).toFixed(1)}%), but ${bestByCashFlow.option.name} has the better cash-flow profile thanks to shorter lead time and softer payment terms. If cash is tight, ${bestByCashFlow.option.name} is safer; if margin is the only priority, ${bestByMargin.option.name} wins.`;
    }
  }

  return { evaluations, bestByMargin, bestByCashFlow, bestByOperationalRisk, bestByLeadTime, bestOverall, current, recommendation };
}

function round1(n: number) { return Math.round(n * 10) / 10; }
function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
