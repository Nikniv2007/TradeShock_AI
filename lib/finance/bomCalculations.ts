// ─────────────────────────────────────────────────────────────
// Bill-of-Materials tariff exposure. Rolls components up to a finished
// good and highlights where tariff exposure concentrates (which is
// often NOT where cost concentrates).
// ─────────────────────────────────────────────────────────────

import type { BOM, BOMComponent } from "@/lib/types";
import { calculateGrossMargin, calculateDefectAdjustedCost } from "./calculations";
import { safeDiv, clamp01 } from "@/lib/utils/validators";

export interface ComponentAnalysis {
  component: BOMComponent;
  landedCostPerFinishedGood: number;
  tariffCostPerFinishedGood: number;
  costSharePercent: number; // 0..1 of BOM cost
  tariffSharePercent: number; // 0..1 of BOM tariff cost
  substituteSavingsEstimate: number;
}

export interface BOMAnalysis {
  totalBOMCost: number;
  totalTariffExposure: number;
  finishedGrossMargin: number;
  finishedGrossProfit: number;
  components: ComponentAnalysis[];
  mostExposedComponents: ComponentAnalysis[];
  criticalComponents: ComponentAnalysis[];
  shockedBOMCost: number; // under +10pt tariff shock
  shockedMargin: number;
}

const TARIFF_SHOCK = 0.1;

export function analyzeBOM(bom: BOM): BOMAnalysis {
  const perComp = bom.components.map((c) => {
    const base = c.unitCost * Math.max(0, c.quantityPerFinishedGood);
    const defectAdjusted = calculateDefectAdjustedCost(base, c.defectRate);
    const landed = defectAdjusted + c.freightAllocation;
    const tariffCost = base * clamp01(c.tariffRate);
    const landedWithTariff = landed + tariffCost;
    // Substitute savings: assume a substitute could shave the tariff + 15% of cost.
    const substituteSavings = c.substituteAvailable ? tariffCost + base * 0.15 : 0;
    return { component: c, landed: landedWithTariff, tariffCost, base, substituteSavings };
  });

  const totalBOMCost = round2(perComp.reduce((s, c) => s + c.landed, 0));
  const totalTariffExposure = round2(perComp.reduce((s, c) => s + c.tariffCost, 0));

  const components: ComponentAnalysis[] = perComp.map((c) => ({
    component: c.component,
    landedCostPerFinishedGood: round2(c.landed),
    tariffCostPerFinishedGood: round2(c.tariffCost),
    costSharePercent: round4(safeDiv(c.landed, totalBOMCost, 0)),
    tariffSharePercent: round4(safeDiv(c.tariffCost, totalTariffExposure, 0)),
    substituteSavingsEstimate: round2(c.substituteSavings),
  }));

  const finished = calculateGrossMargin(bom.sellingPrice, totalBOMCost);
  const shockedBOMCost = round2(perComp.reduce((s, c) => s + c.landed + c.base * TARIFF_SHOCK, 0));
  const shockedMargin = calculateGrossMargin(bom.sellingPrice, shockedBOMCost).grossMargin;

  return {
    totalBOMCost,
    totalTariffExposure,
    finishedGrossMargin: round4(finished.grossMargin),
    finishedGrossProfit: round2(finished.grossProfitPerUnit),
    components,
    mostExposedComponents: [...components].sort((a, b) => b.tariffSharePercent - a.tariffSharePercent).slice(0, 3),
    criticalComponents: components.filter((c) => c.component.criticalComponent),
    shockedBOMCost,
    shockedMargin: round4(shockedMargin),
  };
}

export function calculateBOMCost(bom: BOM): number {
  return analyzeBOM(bom).totalBOMCost;
}
export function calculateBOMTariffExposure(bom: BOM): number {
  return analyzeBOM(bom).totalTariffExposure;
}

function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
