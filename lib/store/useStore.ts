// ─────────────────────────────────────────────────────────────
// Global client store (Zustand). Holds the active dataset, demo mode,
// and derived portfolio status. Persists to localStorage so uploads and
// settings survive reloads. Starts EMPTY — the user loads demo data or
// uploads their own (matching the "Load Demo Data" flow).
// ─────────────────────────────────────────────────────────────

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Dataset,
  Company,
  Product,
  Supplier,
  Customer,
  PurchaseOrder,
  BOM,
  RiskLevel,
} from "@/lib/types";
import { buildDemoDataset, emptyDataset } from "@/lib/data/demoData";
import { runScenario } from "@/lib/finance/scenarioEngine";
import { supplierConcentration } from "@/lib/finance/riskScoring";
import { scanPurchaseOrder } from "@/lib/finance/poRisk";
import { calculateCashTiedInInventory, calculateLandedCost } from "@/lib/finance/calculations";

export interface PortfolioStatus {
  status: RiskLevel;
  marginAtRisk: number;
  skusBelowTarget: number;
  totalSkus: number;
  tariffExposure: number;
  openPOValue: number;
  cashTiedInInventory: number;
  criticalPOs: number;
  avgMargin: number;
  avgLeadTime: number;
  topCountry: string;
  topCountryShare: number;
  highRiskSuppliers: number;
  productsNeedingPriceAction: number;
}

interface StoreState {
  dataset: Dataset;
  demoMode: boolean;
  loaded: boolean;
  hasData: boolean;
  loadDemoData: () => void;
  resetData: () => void;
  setDemoMode: (v: boolean) => void;
  updateCompany: (patch: Partial<Company>) => void;
  setProducts: (products: Product[]) => void;
  addProducts: (products: Product[]) => void;
  setSuppliers: (suppliers: Supplier[]) => void;
  setCustomers: (customers: Customer[]) => void;
  setPurchaseOrders: (pos: PurchaseOrder[]) => void;
  setBOMs: (boms: BOM[]) => void;
  importDataset: (data: Partial<Dataset>) => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      dataset: emptyDataset(),
      demoMode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
      loaded: false,
      hasData: false,
      loadDemoData: () => set({ dataset: buildDemoDataset(), hasData: true, loaded: true }),
      resetData: () => set({ dataset: emptyDataset(), hasData: false }),
      setDemoMode: (v) => set({ demoMode: v }),
      updateCompany: (patch) =>
        set((s) => ({ dataset: { ...s.dataset, company: { ...s.dataset.company, ...patch } } })),
      setProducts: (products) => set((s) => ({ dataset: { ...s.dataset, products }, hasData: true })),
      addProducts: (products) =>
        set((s) => ({ dataset: { ...s.dataset, products: [...s.dataset.products, ...products] }, hasData: true })),
      setSuppliers: (suppliers) => set((s) => ({ dataset: { ...s.dataset, suppliers }, hasData: true })),
      setCustomers: (customers) => set((s) => ({ dataset: { ...s.dataset, customers }, hasData: true })),
      setPurchaseOrders: (purchaseOrders) => set((s) => ({ dataset: { ...s.dataset, purchaseOrders }, hasData: true })),
      setBOMs: (boms) => set((s) => ({ dataset: { ...s.dataset, boms }, hasData: true })),
      importDataset: (data) => set((s) => ({ dataset: { ...s.dataset, ...data }, hasData: true })),
    }),
    {
      name: "tradeshock-store",
      partialize: (s) => ({ dataset: s.dataset, demoMode: s.demoMode, hasData: s.hasData }),
      onRehydrateStorage: () => (state) => {
        if (state) state.loaded = true;
      },
    }
  )
);

/** Derived, deterministic portfolio status used by the topbar + dashboard. */
export function computePortfolioStatus(dataset: Dataset): PortfolioStatus {
  const { products, suppliers, purchaseOrders } = dataset;
  const totalSkus = products.length;

  if (totalSkus === 0) {
    return {
      status: "safe", marginAtRisk: 0, skusBelowTarget: 0, totalSkus: 0, tariffExposure: 0,
      openPOValue: 0, cashTiedInInventory: 0, criticalPOs: 0, avgMargin: 0, avgLeadTime: 0,
      topCountry: "—", topCountryShare: 0, highRiskSuppliers: 0, productsNeedingPriceAction: 0,
    };
  }

  // Severe tariff scenario drives "at risk" figures.
  const severe = dataset.scenarios.find((s) => s.name === "Severe Tariff Shock") ?? dataset.scenarios[1];
  const rollup = severe
    ? runScenario(products, severe)
    : { results: [], portfolio: { productsBelowTarget: 0, totalGrossProfitAtRisk: 0, avgCurrentMargin: 0 } as never };

  const conc = supplierConcentration(products, suppliers);

  let tariffExposure = 0;
  let cashTied = 0;
  let marginSum = 0;
  let priceActionCount = 0;
  for (const p of products) {
    const landed = calculateLandedCost({
      incoterm: "FOB", supplierUnitCost: p.supplierUnitCost, quantity: Math.max(1, p.monthlyDemand),
      freightTotal: p.freightPerUnit * Math.max(1, p.monthlyDemand), insuranceTotal: 0, brokerFees: 0, portFees: 0,
      handlingFees: 0, warehouseFees: 0, domesticDeliveryFees: 0, inspectionFees: 0,
      otherFees: p.otherFeesPerUnit * Math.max(1, p.monthlyDemand), tariffRate: p.currentTariffRate,
      additionalTariffRate: p.additionalTariffRate, sellingPrice: p.sellingPrice, targetMargin: p.targetMargin, currency: "USD",
    });
    tariffExposure += (landed.dutyPerUnit + landed.additionalTariffPerUnit) * p.monthlyDemand;
    cashTied += calculateCashTiedInInventory(landed.landedCostPerUnit, p.currentInventory);
    marginSum += landed.grossMargin;
    if (landed.grossMargin < p.targetMargin) priceActionCount++;
  }

  const openPOValue = purchaseOrders.reduce((s, po) => s + po.estimatedLandedCost, 0);
  const criticalPOs = purchaseOrders.filter((po) => {
    const scan = scanPurchaseOrder(po, products, suppliers, { supplierCountryShare: conc.topCountryShare });
    return scan.riskLevel === "critical";
  }).length;

  const highRiskSuppliers = suppliers.filter((s) => s.reliabilityScore < 75 || s.defectRate > 0.04).length;
  const avgMargin = marginSum / totalSkus;
  const avgLeadTime = products.reduce((s, p) => s + p.leadTimeDays, 0) / totalSkus;
  const marginAtRisk = rollup.portfolio.totalGrossProfitAtRisk ?? 0;
  const skusBelowTarget = rollup.portfolio.productsBelowTarget ?? priceActionCount;

  const status: RiskLevel =
    criticalPOs > 0 || skusBelowTarget > totalSkus * 0.4
      ? "critical"
      : skusBelowTarget > totalSkus * 0.2 || conc.topCountryShare > 0.55
        ? "warning"
        : skusBelowTarget > 0
          ? "watch"
          : "safe";

  return {
    status,
    marginAtRisk: Math.round(marginAtRisk),
    skusBelowTarget,
    totalSkus,
    tariffExposure: Math.round(tariffExposure),
    openPOValue: Math.round(openPOValue),
    cashTiedInInventory: Math.round(cashTied),
    criticalPOs,
    avgMargin,
    avgLeadTime,
    topCountry: conc.topCountry,
    topCountryShare: conc.topCountryShare,
    highRiskSuppliers,
    productsNeedingPriceAction: priceActionCount,
  };
}
