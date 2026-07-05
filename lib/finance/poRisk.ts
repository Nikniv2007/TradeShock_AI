// ─────────────────────────────────────────────────────────────
// Purchase Order risk scanner. Decides Approve / Revise / Hold from
// deterministic cash, inventory, margin, and supplier signals.
// ─────────────────────────────────────────────────────────────

import type { PurchaseOrder, Product, Supplier, RiskLevel } from "@/lib/types";
import { calculateInventoryDays } from "./calculations";
import { riskLevelFromScore, clamp } from "@/lib/utils/formatters";
import { safeDiv, clamp01 } from "@/lib/utils/validators";

export interface POCheck {
  label: string;
  triggered: boolean;
  severity: "info" | "warning" | "critical";
  contribution: number;
  detail: string;
}

export interface POScanResult {
  poId: string;
  poNumber: string;
  totalSupplierCost: number;
  estimatedLandedCost: number;
  totalCashNeeded: number;
  grossProfitExpected: number;
  riskAdjustedGrossProfit: number;
  inventoryDaysCreated: number;
  cashConversionStrain: number; // cash needed / cash available
  scenarioMargin: number;
  riskScore: number;
  riskLevel: RiskLevel;
  recommendation: "approve" | "revise" | "hold";
  recommendedQuantityFactor: number; // e.g. 0.65 = cut 35%
  suggestedHoldAmount: number;
  minPriceIncreaseNeeded: number;
  checks: POCheck[];
}

const SHOCK_TARIFF = 0.1; // stress: +10 tariff points

export function scanPurchaseOrder(
  po: PurchaseOrder,
  products: Product[],
  suppliers: Supplier[],
  opts: { targetInventoryDays?: number; supplierCountryShare?: number } = {}
): POScanResult {
  const supplier = suppliers.find((s) => s.id === po.supplierId);
  const targetInvDays = opts.targetInventoryDays ?? 90;

  let totalSupplierCost = 0;
  let totalLanded = 0;
  let expectedProfit = 0;
  let stressedProfit = 0;
  let unitsBelowTargetUnderShock = 0;
  let totalUnits = 0;
  let monthlyDemandUnits = po.monthlyDemandUnits || 0;

  for (const line of po.lines) {
    const product = products.find((p) => p.id === line.productId);
    const target = product?.targetMargin ?? line.targetMargin ?? 0.3;
    const landed = line.estimatedLandedCost || line.unitCost * 1.25;
    const price = product?.sellingPrice ?? landed / (1 - target);
    totalSupplierCost += line.unitCost * line.quantity;
    totalLanded += landed * line.quantity;
    expectedProfit += (price - landed) * line.quantity;
    // stress: add tariff shock to supplier portion
    const stressedLanded = landed + line.unitCost * SHOCK_TARIFF;
    stressedProfit += (price - stressedLanded) * line.quantity;
    const stressedMargin = safeDiv(price - stressedLanded, price, 0);
    if (stressedMargin < target) unitsBelowTargetUnderShock += line.quantity;
    totalUnits += line.quantity;
    if (!monthlyDemandUnits && product) monthlyDemandUnits += product.monthlyDemand;
  }

  const totalCashNeeded = totalLanded;
  const depositCash = totalSupplierCost * clamp01(po.depositRequiredPercent);
  const inventoryDaysCreated = calculateInventoryDays(totalUnits, Math.max(1, monthlyDemandUnits));
  const cashConversionStrain = round2(safeDiv(totalCashNeeded, Math.max(1, po.currentCashAvailable), 0));
  const shockShareBelowTarget = safeDiv(unitsBelowTargetUnderShock, Math.max(1, totalUnits), 0);
  const scenarioMargin = round4(safeDiv(stressedProfit, Math.max(1, totalLanded + stressedProfit), 0));
  const leadTimeDays = supplier?.averageLeadTimeDays ?? daysBetween(po.expectedShipDate, po.expectedArrivalDate) + 30;

  const checks: POCheck[] = [
    check("Cash tied up too high", cashConversionStrain > 0.6, cashConversionStrain > 0.9 ? "critical" : "warning", cashConversionStrain > 0.9 ? 22 : 12, `PO consumes ${(cashConversionStrain * 100).toFixed(0)}% of available cash.`),
    check("Deposit too large", clamp01(po.depositRequiredPercent) > 0.4, "warning", clamp01(po.depositRequiredPercent) > 0.5 ? 12 : 7, `Deposit of ${(po.depositRequiredPercent * 100).toFixed(0)}% ($${Math.round(depositCash).toLocaleString()}) due upfront.`),
    check("Inventory days too high", inventoryDaysCreated > targetInvDays, inventoryDaysCreated > targetInvDays * 1.5 ? "critical" : "warning", inventoryDaysCreated > targetInvDays * 1.5 ? 18 : 10, `Creates ${Math.round(inventoryDaysCreated)} days of inventory vs ${targetInvDays}-day target.`),
    check("Margin collapse under tariff shock", shockShareBelowTarget > 0.25, shockShareBelowTarget > 0.4 ? "critical" : "warning", shockShareBelowTarget > 0.4 ? 20 : 10, `${(shockShareBelowTarget * 100).toFixed(0)}% of units fall below target margin under a +10pt tariff shock.`),
    check("Long lead time", leadTimeDays > 45, "warning", leadTimeDays > 60 ? 10 : 6, `Lead time ~${Math.round(leadTimeDays)} days extends cash-conversion cycle.`),
    check("Supplier concentration", (opts.supplierCountryShare ?? 0) > 0.5, "warning", 8, `${(((opts.supplierCountryShare ?? 0)) * 100).toFixed(0)}% of exposure is in ${supplier?.country ?? "one country"}.`),
    check("Weak payment terms", po.paymentTerms === "prepaid" || po.paymentTerms === "deposit_50_50", "warning", 6, "Front-loaded payment terms increase cash risk."),
    check("Poor supplier reliability", (supplier?.reliabilityScore ?? 100) < 70, "warning", 8, `Supplier reliability ${supplier?.reliabilityScore ?? "n/a"}/100.`),
    check("Low forecast confidence", po.forecastConfidence === "low", "warning", 8, "Demand forecast confidence is low."),
    check("Warehouse capacity issue", totalUnits > (po.warehouseCapacityUnits || Infinity), "warning", 6, "Order may exceed available warehouse capacity."),
  ];

  const riskScore = clamp(Math.round(checks.reduce((s, c) => s + (c.triggered ? c.contribution : 0), 0)), 0, 100);
  const riskLevel = riskLevelFromScore(riskScore);
  const recommendation: POScanResult["recommendation"] = riskScore > 75 ? "hold" : riskScore > 55 ? "revise" : "approve";

  // If inventory days blow past target, recommend cutting quantity to the target.
  const recommendedQuantityFactor = inventoryDaysCreated > targetInvDays
    ? clamp(safeDiv(targetInvDays, inventoryDaysCreated, 1), 0.3, 1)
    : 1;
  const suggestedHoldAmount = round2(totalCashNeeded * (1 - recommendedQuantityFactor));
  const riskAdjustedGrossProfit = round2(expectedProfit * (1 - riskScore / 200));
  const minPriceIncreaseNeeded = shockShareBelowTarget > 0 ? round4(SHOCK_TARIFF * 0.6) : 0;

  return {
    poId: po.id,
    poNumber: po.poNumber,
    totalSupplierCost: round2(totalSupplierCost),
    estimatedLandedCost: round2(totalLanded),
    totalCashNeeded: round2(totalCashNeeded),
    grossProfitExpected: round2(expectedProfit),
    riskAdjustedGrossProfit,
    inventoryDaysCreated: Math.round(inventoryDaysCreated),
    cashConversionStrain,
    scenarioMargin,
    riskScore,
    riskLevel,
    recommendation,
    recommendedQuantityFactor: round2(recommendedQuantityFactor),
    suggestedHoldAmount,
    minPriceIncreaseNeeded,
    checks,
  };
}

function check(label: string, triggered: boolean, severity: POCheck["severity"], contribution: number, detail: string): POCheck {
  return { label, triggered, severity, contribution, detail };
}
function daysBetween(a: string, b: string): number {
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}
function round2(n: number) { return Math.round(n * 100) / 100; }
function round4(n: number) { return Math.round(n * 10000) / 10000; }
