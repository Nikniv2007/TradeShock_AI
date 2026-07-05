// ─────────────────────────────────────────────────────────────
// FX & freight shock modeling. NOT hedging/investment advice — see
// the disclaimer surfaced on the page.
// ─────────────────────────────────────────────────────────────

import { calculateGrossMargin, calculatePriceIncreaseNeeded } from "./calculations";
import { safeDiv, clamp01 } from "@/lib/utils/validators";

export interface FXFreightInput {
  supplierUnitCostLocal: number; // in supplier currency
  baseExchangeRate: number; // local per 1 USD (or units->USD factor)
  currentExchangeRate: number;
  currencyShockPercent: number; // additional shock 0..1
  freightBaseCost: number; // total or per-unit; treated per-unit here
  freightShockPercent: number; // 0..1
  otherLandedPerUnit: number; // duties, fees excluding supplier+freight
  sellingPrice: number;
  targetMargin: number;
  quantity: number;
  inventoryFinancingCostPercent: number; // annual 0..1
  leadTimeDays: number;
}

export interface FXFreightResult {
  currencyAdjustedSupplierCost: number;
  freightAdjustedPerUnit: number;
  baseLandedCost: number;
  shockedLandedCost: number;
  combinedImpactPerUnit: number;
  baseMargin: number;
  shockedMargin: number;
  marginImpact: number;
  requiredPriceIncrease: number;
  cashImpact: number;
  breakEvenFXRate: number;
  breakEvenFreightPerUnit: number;
  financingCostImpact: number;
}

/** Convert a local-currency cost to USD using an exchange factor. */
export function calculateFXImpact(localCost: number, baseRate: number, currentRate: number, shockPercent: number): number {
  // Model rate as "USD per local unit". Weakening dollar => cost rises.
  const effectiveRate = currentRate * (1 + clamp01(shockPercent));
  const base = localCost * baseRate;
  const shocked = localCost * effectiveRate;
  return round4(shocked - base);
}

export function calculateFreightShockImpact(freightPerUnit: number, shockPercent: number): number {
  return round4(freightPerUnit * clamp01(shockPercent));
}

export function modelFXFreight(input: FXFreightInput): FXFreightResult {
  const baseRate = input.baseExchangeRate || 1;
  const currentRate = input.currentExchangeRate || baseRate;

  const baseSupplierUSD = input.supplierUnitCostLocal * baseRate;
  const currencyAdjustedSupplierCost = round4(
    input.supplierUnitCostLocal * currentRate * (1 + clamp01(input.currencyShockPercent))
  );

  const freightAdjustedPerUnit = round4(input.freightBaseCost * (1 + clamp01(input.freightShockPercent)));

  const baseLandedCost = round4(baseSupplierUSD + input.freightBaseCost + input.otherLandedPerUnit);
  const shockedLandedCost = round4(currencyAdjustedSupplierCost + freightAdjustedPerUnit + input.otherLandedPerUnit);
  const combinedImpactPerUnit = round4(shockedLandedCost - baseLandedCost);

  const baseMargin = calculateGrossMargin(input.sellingPrice, baseLandedCost).grossMargin;
  const shockedMargin = calculateGrossMargin(input.sellingPrice, shockedLandedCost).grossMargin;
  const requiredPriceIncrease = calculatePriceIncreaseNeeded(input.sellingPrice, shockedLandedCost, input.targetMargin);

  const cashImpact = round2(combinedImpactPerUnit * Math.max(1, input.quantity));
  const financingYears = safeDiv(Math.max(input.leadTimeDays, 30), 365, 0);
  const financingCostImpact = round2(cashImpact * clamp01(input.inventoryFinancingCostPercent) * financingYears);

  // Break-even FX rate: rate at which shocked margin equals target margin.
  const allowedLanded = input.sellingPrice * (1 - clamp01(input.targetMargin));
  const nonSupplier = freightAdjustedPerUnit + input.otherLandedPerUnit;
  const breakEvenFXRate = round4(safeDiv(allowedLanded - nonSupplier, Math.max(0.0001, input.supplierUnitCostLocal), currentRate));
  const breakEvenFreightPerUnit = round4(Math.max(0, allowedLanded - currencyAdjustedSupplierCost - input.otherLandedPerUnit));

  return {
    currencyAdjustedSupplierCost,
    freightAdjustedPerUnit,
    baseLandedCost,
    shockedLandedCost,
    combinedImpactPerUnit,
    baseMargin: round4(baseMargin),
    shockedMargin: round4(shockedMargin),
    marginImpact: round4(baseMargin - shockedMargin),
    requiredPriceIncrease: round4(requiredPriceIncrease),
    cashImpact,
    breakEvenFXRate,
    breakEvenFreightPerUnit,
    financingCostImpact,
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
