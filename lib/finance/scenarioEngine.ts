// ─────────────────────────────────────────────────────────────
// Scenario / tariff-shock engine. Applies a Scenario to products and
// returns deterministic before/after results + portfolio rollups.
// ─────────────────────────────────────────────────────────────

import type { Product, Scenario, ScenarioResult, Supplier, RiskLevel } from "@/lib/types";
import { calculateLandedCost, calculateGrossMargin, calculatePriceIncreaseNeeded, marginRiskLevel } from "./calculations";
import { clamp01 } from "@/lib/utils/validators";
import type { LandedCostInput } from "@/lib/types";

function baseInput(p: Product): LandedCostInput {
  return {
    incoterm: "FOB",
    supplierUnitCost: p.supplierUnitCost,
    quantity: Math.max(1, p.monthlyDemand),
    freightTotal: p.freightPerUnit * Math.max(1, p.monthlyDemand),
    insuranceTotal: 0,
    brokerFees: 0,
    portFees: 0,
    handlingFees: 0,
    warehouseFees: 0,
    domesticDeliveryFees: 0,
    inspectionFees: 0,
    otherFees: p.otherFeesPerUnit * Math.max(1, p.monthlyDemand),
    tariffRate: p.currentTariffRate,
    additionalTariffRate: p.additionalTariffRate,
    sellingPrice: p.sellingPrice,
    targetMargin: p.targetMargin,
    currency: "USD",
  };
}

function applyScenario(input: LandedCostInput, s: Scenario): LandedCostInput {
  return {
    ...input,
    supplierUnitCost: input.supplierUnitCost * (1 + s.supplierCostIncreasePercent) * (1 + s.currencyImpactPercent),
    freightTotal: input.freightTotal * (1 + s.freightIncreasePercent),
    insuranceTotal: input.insuranceTotal * (1 + s.insuranceCostIncreasePercent),
    warehouseFees: input.warehouseFees * (1 + s.warehouseCostIncreasePercent),
    tariffRate: clamp01(input.tariffRate + s.tariffIncreasePercent),
    additionalTariffRate: clamp01(input.additionalTariffRate + s.additionalDutyPercent),
    targetMargin: s.targetMargin || input.targetMargin,
  };
}

export function calculateScenarioLandedCost(p: Product, s: Scenario): number {
  return calculateLandedCost(applyScenario(baseInput(p), s)).landedCostPerUnit;
}

export function calculateScenarioMargin(p: Product, s: Scenario): number {
  const landed = calculateScenarioLandedCost(p, s);
  return calculateGrossMargin(p.sellingPrice, landed).grossMargin;
}

export interface ScenarioRollup {
  results: ScenarioResult[];
  portfolio: {
    productsAffected: number;
    productsBelowTarget: number;
    totalRevenueAtRisk: number;
    totalGrossProfitAtRisk: number;
    avgCurrentMargin: number;
    avgScenarioMargin: number;
    worstProduct?: ScenarioResult;
  };
}

function recommend(current: number, scenario: number, target: number, priceIncrease: number, allowedIncrease: number): string {
  if (scenario < 0) return "Pause or repriced immediately — SKU is unprofitable under this scenario.";
  if (priceIncrease > allowedIncrease && allowedIncrease > 0) return "Switch supplier or add surcharge — needed price increase exceeds allowed limit.";
  if (scenario < target && priceIncrease > 0.05) return "Raise price or add tariff surcharge to restore target margin.";
  if (scenario < target) return "Renegotiate supplier/freight or apply a modest surcharge.";
  return "No action required — margin remains at or above target.";
}

export function runScenario(products: Product[], scenario: Scenario): ScenarioRollup {
  const results: ScenarioResult[] = products.map((p) => {
    const currentLanded = calculateLandedCost(baseInput(p)).landedCostPerUnit;
    const scenarioLanded = calculateScenarioLandedCost(p, scenario);
    const currentMargin = calculateGrossMargin(p.sellingPrice, currentLanded).grossMargin;
    const scenarioMargin = calculateGrossMargin(p.sellingPrice, scenarioLanded).grossMargin;
    const currentProfitPerUnit = p.sellingPrice - currentLanded;
    const scenarioProfitPerUnit = p.sellingPrice - scenarioLanded;
    const profitLossPerUnit = currentProfitPerUnit - scenarioProfitPerUnit;
    const monthly = Math.max(1, p.monthlyDemand) * (1 - clamp01(scenario.demandDropPercent));
    const requiredPriceIncrease = calculatePriceIncreaseNeeded(p.sellingPrice, scenarioLanded, scenario.targetMargin || p.targetMargin);
    const riskLevel: RiskLevel = marginRiskLevel(scenarioMargin, scenario.targetMargin || p.targetMargin);
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      currentLandedCost: round2(currentLanded),
      scenarioLandedCost: round2(scenarioLanded),
      currentMargin: round4(currentMargin),
      scenarioMargin: round4(scenarioMargin),
      marginLoss: round4(currentMargin - scenarioMargin),
      profitLossPerUnit: round2(profitLossPerUnit),
      requiredPriceIncrease: round4(requiredPriceIncrease),
      revenueAtRisk: round2(p.sellingPrice * monthly),
      grossProfitAtRisk: round2(Math.max(0, profitLossPerUnit) * monthly),
      riskLevel,
      recommendedAction: recommend(currentMargin, scenarioMargin, scenario.targetMargin || p.targetMargin, requiredPriceIncrease, scenario.priceIncreaseAllowedPercent),
    };
  });

  const target = scenario.targetMargin;
  const belowTarget = results.filter((r) => r.scenarioMargin < target);
  const portfolio = {
    productsAffected: results.length,
    productsBelowTarget: belowTarget.length,
    totalRevenueAtRisk: round2(results.reduce((s, r) => s + (r.scenarioMargin < target ? r.revenueAtRisk : 0), 0)),
    totalGrossProfitAtRisk: round2(results.reduce((s, r) => s + r.grossProfitAtRisk, 0)),
    avgCurrentMargin: round4(avg(results.map((r) => r.currentMargin))),
    avgScenarioMargin: round4(avg(results.map((r) => r.scenarioMargin))),
    worstProduct: [...results].sort((a, b) => a.scenarioMargin - b.scenarioMargin)[0],
  };
  return { results, portfolio };
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
