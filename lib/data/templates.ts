// ─────────────────────────────────────────────────────────────
// Downloadable sample CSV templates + client-side download helpers.
// ─────────────────────────────────────────────────────────────

import type { EntityKind } from "./csvParser";

export const SAMPLE_TEMPLATES: Record<EntityKind, string> = {
  products: `sku,name,category,supplierName,countryOfOrigin,supplierUnitCost,sellingPrice,targetMargin,currentTariffRate,additionalTariffRate,monthlyDemand,currentInventory,leadTimeDays,priceFlexibility
TS-2001,Insulated Lunch Bag,Kitchen,Hanoi FlexGoods Co.,Vietnam,3.10,12.00,0.42,0.07,0,540,800,34,high
TS-2002,Cast Iron Skillet,Kitchen,Guadalajara Metalworks,Mexico,11.40,32.00,0.36,0.05,0,180,300,16,low`,
  suppliers: `name,country,currency,unitCost,reliabilityScore,qualityScore,communicationScore,capacityScore,complianceScore,averageLeadTimeDays,paymentTerms,depositRequiredPercent,defectRate,minimumOrderQuantity
Bangkok Craft Works,Thailand,THB,4.20,80,82,78,84,80,36,net_30,0.2,0.03,300
Porto Ceramics,Portugal,EUR,6.80,88,90,86,72,90,28,net_30,0.15,0.02,200`,
  purchaseOrders: `poNumber,supplierName,sku,quantity,unitCost,expectedShipDate,expectedArrivalDate,paymentTerms,depositRequiredPercent
PO-2001,Bangkok Craft Works,TS-2001,1200,3.10,2026-07-01,2026-08-05,net_30,0.2
PO-2001,Bangkok Craft Works,TS-2002,400,11.40,2026-07-01,2026-08-05,net_30,0.2`,
  customers: `name,type,annualRevenue,grossMargin,paymentTerms,discountLevel,contractType,priceFlexibility,churnRisk,strategicImportance,tariffPassThroughClause
Coastal Living Retail,retail,1400000,0.34,net_30,0.1,flexible,medium,low,high,false
Summit B2B Supply,b2b,900000,0.4,net_15,0.05,spot,high,medium,low,false`,
  bom: `finishedSku,componentName,supplierName,countryOfOrigin,unitCost,quantityPerFinishedGood,tariffRate,freightAllocation,defectRate,criticalComponent,substituteAvailable
TS-2002,Cast Iron Body,Guadalajara Metalworks,Mexico,7.20,1,0.05,0.4,0.02,true,false
TS-2002,Wooden Handle,Hanoi FlexGoods Co.,Vietnam,1.10,1,0.06,0.1,0.03,false,true`,
};

export const TEMPLATE_LABELS: Record<EntityKind, string> = {
  products: "Products",
  suppliers: "Suppliers",
  purchaseOrders: "Purchase Orders",
  customers: "Customers",
  bom: "BOM Components",
};

export function downloadText(filename: string, content: string, mime = "text/csv") {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadJSON(filename: string, data: unknown) {
  downloadText(filename, JSON.stringify(data, null, 2), "application/json");
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}
