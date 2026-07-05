// ─────────────────────────────────────────────────────────────
// TradeShock AI — Deterministic financial calculation library.
//
// GROUND RULE: All financial math lives here and is deterministic.
// AI never computes these numbers; it only explains/recommends over
// the outputs. Every function guards against divide-by-zero and NaN.
// ─────────────────────────────────────────────────────────────

import type {
  Incoterm,
  LandedCostInput,
  LandedCostResult,
  CostShareItem,
  RiskLevel,
} from "@/lib/types";
import { safeDiv, round, clamp01 } from "@/lib/utils/validators";

// ─── Incoterm handling (simplified for analysis, NOT legal advice) ───
// Each Incoterm implies which cost buckets the buyer typically bears.
// We surface an advisory note and an "origin handling" uplift factor for
// EXW where extra origin trucking/export handling is commonly required.
export interface IncotermProfile {
  code: Incoterm;
  note: string;
  // Fraction of freight+fees to add as an estimate for buyer-borne origin costs.
  originHandlingUplift: number;
  freightTypicallyIncluded: boolean;
  insuranceTypicallyIncluded: boolean;
  dutiesTypicallyIncluded: boolean;
}

export const INCOTERM_PROFILES: Record<Incoterm, IncotermProfile> = {
  EXW: {
    code: "EXW",
    note: "EXW: buyer bears origin trucking and export handling. We add an estimated origin-handling uplift.",
    originHandlingUplift: 0.05,
    freightTypicallyIncluded: false,
    insuranceTypicallyIncluded: false,
    dutiesTypicallyIncluded: false,
  },
  FOB: {
    code: "FOB",
    note: "FOB: costs begin once goods are loaded at the origin port. Main freight and insurance are buyer-borne.",
    originHandlingUplift: 0,
    freightTypicallyIncluded: false,
    insuranceTypicallyIncluded: false,
    dutiesTypicallyIncluded: false,
  },
  CIF: {
    code: "CIF",
    note: "CIF: seller commonly covers freight and insurance to destination port. Duties remain buyer-borne. Verify the actual quote.",
    originHandlingUplift: 0,
    freightTypicallyIncluded: true,
    insuranceTypicallyIncluded: true,
    dutiesTypicallyIncluded: false,
  },
  DDP: {
    code: "DDP",
    note: "DDP: duties may be included in the supplier price, but should still be reviewed and verified with your broker.",
    originHandlingUplift: 0,
    freightTypicallyIncluded: true,
    insuranceTypicallyIncluded: true,
    dutiesTypicallyIncluded: true,
  },
};

export function calculateFreightPerUnit(freightTotal: number, quantity: number): number {
  return round(safeDiv(freightTotal, quantity, 0), 4);
}

export function calculateDutyPerUnit(supplierUnitCost: number, tariffRate: number): number {
  return round(Math.max(0, supplierUnitCost) * clamp01(tariffRate), 4);
}

export interface GrossMarginResult {
  grossProfitPerUnit: number;
  grossMargin: number; // 0..1
}

export function calculateGrossMargin(sellingPrice: number, landedCostPerUnit: number): GrossMarginResult {
  const grossProfitPerUnit = round(sellingPrice - landedCostPerUnit, 4);
  const grossMargin = round(clamp01Signed(safeDiv(grossProfitPerUnit, sellingPrice, 0)), 4);
  return { grossProfitPerUnit, grossMargin };
}

// Margin can be negative (unprofitable) but never > 1 in a sane sale.
function clamp01Signed(n: number): number {
  return Math.min(1, n);
}

/** Price needed to hit a target margin: cost / (1 - targetMargin). */
export function calculateRequiredPrice(landedCostPerUnit: number, targetMargin: number): number {
  const m = clamp01(targetMargin);
  if (m >= 1) return Infinity;
  return round(safeDiv(landedCostPerUnit, 1 - m, landedCostPerUnit), 4);
}

/** Break-even = landed cost (0% margin). */
export function calculateBreakEvenPrice(landedCostPerUnit: number): number {
  return round(Math.max(0, landedCostPerUnit), 4);
}

export function calculateMarginGap(currentMargin: number, targetMargin: number): number {
  return round(targetMargin - currentMargin, 4);
}

/**
 * Max supplier unit cost that still preserves target margin, holding all
 * other landed-cost adders and duty rate constant.
 * sellingPrice*(1-target) = supplierCost*(1+tariff) + otherAdders
 */
export function calculateMaxSupplierCost(
  sellingPrice: number,
  targetMargin: number,
  nonSupplierLandedAdders: number,
  tariffRate: number
): number {
  const allowedLanded = sellingPrice * (1 - clamp01(targetMargin));
  const dutyMultiplier = 1 + clamp01(tariffRate);
  const max = safeDiv(allowedLanded - nonSupplierLandedAdders, dutyMultiplier, 0);
  return round(Math.max(0, max), 4);
}

/** Max total freight that still preserves target margin for the shipment. */
export function calculateMaxFreightTotal(
  sellingPrice: number,
  targetMargin: number,
  landedExcludingFreightPerUnit: number,
  quantity: number
): number {
  const allowedLandedPerUnit = sellingPrice * (1 - clamp01(targetMargin));
  const maxFreightPerUnit = allowedLandedPerUnit - landedExcludingFreightPerUnit;
  return round(Math.max(0, maxFreightPerUnit) * Math.max(0, quantity), 2);
}

/**
 * Full landed-cost model. This is the single source of truth used across
 * the calculator, tariff simulator, PO scanner, and dashboard.
 */
export function calculateLandedCost(input: LandedCostInput): LandedCostResult {
  const quantity = Math.max(1, input.quantity || 1);
  const profile = INCOTERM_PROFILES[input.incoterm] ?? INCOTERM_PROFILES.FOB;

  const fixedFeesTotal =
    input.brokerFees +
    input.portFees +
    input.handlingFees +
    input.warehouseFees +
    input.domesticDeliveryFees +
    input.inspectionFees +
    input.otherFees;

  const freightPerUnit = calculateFreightPerUnit(input.freightTotal, quantity);
  const insurancePerUnit = round(safeDiv(input.insuranceTotal, quantity, 0), 4);
  const fixedFeesPerUnit = round(safeDiv(fixedFeesTotal, quantity, 0), 4);
  const dutyPerUnit = calculateDutyPerUnit(input.supplierUnitCost, input.tariffRate);
  const additionalTariffPerUnit = calculateDutyPerUnit(
    input.supplierUnitCost,
    input.additionalTariffRate
  );

  // EXW origin-handling uplift (simplified estimate of buyer-borne origin cost)
  const originUplift = round(
    (freightPerUnit + fixedFeesPerUnit) * profile.originHandlingUplift,
    4
  );

  const landedCostPerUnit = round(
    input.supplierUnitCost +
      freightPerUnit +
      insurancePerUnit +
      fixedFeesPerUnit +
      dutyPerUnit +
      additionalTariffPerUnit +
      originUplift,
    4
  );

  const totalLandedCost = round(landedCostPerUnit * quantity, 2);
  const { grossProfitPerUnit, grossMargin } = calculateGrossMargin(
    input.sellingPrice,
    landedCostPerUnit
  );
  const marginGap = calculateMarginGap(grossMargin, input.targetMargin);
  const requiredPrice = calculateRequiredPrice(landedCostPerUnit, input.targetMargin);
  const breakEvenPrice = calculateBreakEvenPrice(landedCostPerUnit);

  const nonSupplierAdders =
    freightPerUnit + insurancePerUnit + fixedFeesPerUnit + originUplift;
  const combinedTariff = clamp01(input.tariffRate) + clamp01(input.additionalTariffRate);
  const maxSupplierCost = calculateMaxSupplierCost(
    input.sellingPrice,
    input.targetMargin,
    nonSupplierAdders,
    combinedTariff
  );
  const landedExFreight = landedCostPerUnit - freightPerUnit;
  const maxFreightTotal = calculateMaxFreightTotal(
    input.sellingPrice,
    input.targetMargin,
    landedExFreight,
    quantity
  );

  // Cash needed for the shipment (goods + freight + insurance + fees + duties).
  const totalCashNeeded = totalLandedCost;

  const costShare = buildCostShare(landedCostPerUnit, {
    supplier: input.supplierUnitCost,
    freight: freightPerUnit + originUplift,
    insurance: insurancePerUnit,
    duty: dutyPerUnit,
    additional_tariff: additionalTariffPerUnit,
    fees: fixedFeesPerUnit,
  });

  const riskLevel = marginRiskLevel(grossMargin, input.targetMargin);

  return {
    freightPerUnit,
    insurancePerUnit,
    fixedFeesPerUnit,
    dutyPerUnit,
    additionalTariffPerUnit,
    landedCostPerUnit,
    totalLandedCost,
    grossProfitPerUnit,
    grossMargin,
    marginGap,
    requiredPrice,
    breakEvenPrice,
    maxSupplierCost,
    maxFreightTotal,
    totalCashNeeded,
    costShare,
    riskLevel,
  };
}

function buildCostShare(
  landedCostPerUnit: number,
  parts: Record<CostShareItem["kind"], number>
): CostShareItem[] {
  const labels: Record<CostShareItem["kind"], string> = {
    supplier: "Supplier Unit Cost",
    freight: "Freight & Handling",
    insurance: "Insurance",
    duty: "Duties / Tariff",
    additional_tariff: "Additional Tariff",
    fees: "Broker & Port Fees",
  };
  return (Object.keys(parts) as CostShareItem["kind"][])
    .map((kind) => ({
      kind,
      label: labels[kind],
      value: round(parts[kind], 4),
      percent: round(safeDiv(parts[kind], landedCostPerUnit, 0), 4),
    }))
    .filter((c) => c.value > 0);
}

/** Simple, transparent margin-based risk mapping used for badges. */
export function marginRiskLevel(grossMargin: number, targetMargin: number): RiskLevel {
  if (grossMargin < 0) return "critical";
  const gap = targetMargin - grossMargin;
  if (gap <= 0) return "safe";
  if (gap <= 0.05) return "watch";
  if (gap <= 0.12) return "warning";
  return "critical";
}

// ─── Working-capital & inventory ───

export function calculateInventoryDays(currentInventory: number, monthlyDemand: number): number {
  const dailyDemand = safeDiv(monthlyDemand, 30, 0);
  if (dailyDemand === 0) return currentInventory > 0 ? Infinity : 0;
  return round(safeDiv(currentInventory, dailyDemand, 0), 1);
}

export function calculateCashTiedInInventory(
  landedCostPerUnit: number,
  inventoryQuantity: number
): number {
  return round(Math.max(0, landedCostPerUnit) * Math.max(0, inventoryQuantity), 2);
}

export interface WorkingCapitalResult {
  cashTiedInMOQ: number;
  leadTimeInventoryUnits: number;
  leadTimeInventoryValue: number;
  depositCash: number;
  financingCost: number; // annualized carrying cost on tied cash
  totalWorkingCapital: number;
}

/**
 * Working-capital impact of sourcing decisions: cash tied in MOQ + lead-time
 * pipeline inventory + deposit, plus an annualized financing/carrying cost.
 */
export function calculateWorkingCapitalImpact(params: {
  landedCostPerUnit: number;
  moq: number;
  monthlyDemand: number;
  leadTimeDays: number;
  depositPercent: number;
  financingCostPercent: number; // annual 0..1
}): WorkingCapitalResult {
  const moqUnits = Math.max(0, params.moq);
  const cashTiedInMOQ = round(params.landedCostPerUnit * moqUnits, 2);
  const dailyDemand = safeDiv(params.monthlyDemand, 30, 0);
  const leadTimeInventoryUnits = round(dailyDemand * Math.max(0, params.leadTimeDays), 1);
  const leadTimeInventoryValue = round(
    leadTimeInventoryUnits * params.landedCostPerUnit,
    2
  );
  const depositCash = round(cashTiedInMOQ * clamp01(params.depositPercent), 2);
  const tiedCash = Math.max(cashTiedInMOQ, leadTimeInventoryValue);
  const holdingYears = safeDiv(Math.max(params.leadTimeDays, 30), 365, 0);
  const financingCost = round(
    tiedCash * clamp01(params.financingCostPercent) * holdingYears,
    2
  );
  return {
    cashTiedInMOQ,
    leadTimeInventoryUnits,
    leadTimeInventoryValue,
    depositCash,
    financingCost,
    totalWorkingCapital: round(cashTiedInMOQ + financingCost, 2),
  };
}

/** Defect-adjusted effective unit cost: good units cost more to net of scrap. */
export function calculateDefectAdjustedCost(unitCost: number, defectRate: number): number {
  const good = 1 - clamp01(defectRate);
  if (good <= 0) return Infinity;
  return round(safeDiv(unitCost, good, unitCost), 4);
}

/** Price increase (0..1) needed to restore target margin at a new landed cost. */
export function calculatePriceIncreaseNeeded(
  currentPrice: number,
  newLandedCost: number,
  targetMargin: number
): number {
  const requiredPrice = calculateRequiredPrice(newLandedCost, targetMargin);
  if (!Number.isFinite(requiredPrice) || currentPrice <= 0) return 0;
  return round(Math.max(0, safeDiv(requiredPrice - currentPrice, currentPrice, 0)), 4);
}

/** Gross-profit-at-risk between two states (per period). */
export function calculateMarginAtRisk(
  currentGrossProfit: number,
  scenarioGrossProfit: number
): number {
  return round(Math.max(0, currentGrossProfit - scenarioGrossProfit), 2);
}
