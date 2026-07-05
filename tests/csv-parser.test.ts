import { describe, it, expect } from "vitest";
import { parseCSV, REQUIRED_COLUMNS } from "@/lib/data/csvParser";
import { SAMPLE_TEMPLATES } from "@/lib/data/templates";

describe("CSV parsing", () => {
  it("parses a valid product template with no errors", () => {
    const r = parseCSV(SAMPLE_TEMPLATES.products, "products");
    expect(r.missingColumns).toHaveLength(0);
    expect(r.summary.valid).toBe(2);
    expect(r.summary.failed).toBe(0);
  });

  it("flags missing required columns", () => {
    const csv = "name,category\nWidget,Tools";
    const r = parseCSV(csv, "products");
    expect(r.missingColumns).toContain("sku");
    expect(r.missingColumns).toContain("sellingPrice");
  });

  it("fails rows with non-positive selling price", () => {
    const csv = `sku,name,category,supplierName,countryOfOrigin,supplierUnitCost,sellingPrice,targetMargin
TS-1,Widget,Tools,Acme,China,5,0,0.3`;
    const r = parseCSV(csv, "products");
    expect(r.summary.failed).toBe(1);
    expect(r.issues.some((i) => i.field === "sellingPrice" && i.severity === "error")).toBe(true);
  });

  it("warns on invalid target margin without failing the row", () => {
    const csv = `sku,name,category,supplierName,countryOfOrigin,supplierUnitCost,sellingPrice,targetMargin
TS-1,Widget,Tools,Acme,China,5,20,55`;
    const r = parseCSV(csv, "products");
    expect(r.issues.some((i) => i.field === "targetMargin" && i.severity === "warning")).toBe(true);
  });

  it("fails PO rows with zero quantity", () => {
    const csv = `poNumber,supplierName,sku,quantity,unitCost,expectedArrivalDate
PO-1,Acme,TS-1,0,5,2026-08-01`;
    const r = parseCSV(csv, "purchaseOrders");
    expect(r.summary.failed).toBe(1);
  });

  it("flags duplicate SKUs as a warning", () => {
    const csv = `sku,name,category,supplierName,countryOfOrigin,supplierUnitCost,sellingPrice,targetMargin
TS-1,Widget,Tools,Acme,China,5,20,0.3
TS-1,Widget Dupe,Tools,Acme,China,5,20,0.3`;
    const r = parseCSV(csv, "products");
    expect(r.issues.some((i) => i.field === "sku" && /Duplicate SKU/.test(i.message))).toBe(true);
  });

  it("flags duplicate PO lines (poNumber+sku)", () => {
    const csv = `poNumber,supplierName,sku,quantity,unitCost,expectedArrivalDate
PO-1,Acme,TS-1,100,5,2026-08-01
PO-1,Acme,TS-1,100,5,2026-08-01`;
    const r = parseCSV(csv, "purchaseOrders");
    expect(r.issues.some((i) => /Duplicate PO line/.test(i.message))).toBe(true);
  });

  it("warns on customer without margin data", () => {
    const csv = `name,type,annualRevenue,grossMargin,paymentTerms
Acme,retail,100000,,net_30`;
    const r = parseCSV(csv, "customers");
    expect(r.issues.some((i) => i.field === "grossMargin" && /without margin data/.test(i.message))).toBe(true);
  });

  it("fails BOM components without a quantity", () => {
    const csv = `finishedSku,componentName,supplierName,countryOfOrigin,unitCost,quantityPerFinishedGood
TS-1,Bracket,Acme,China,2.5,0`;
    const r = parseCSV(csv, "bom");
    expect(r.summary.failed).toBe(1);
    expect(r.issues.some((i) => i.field === "quantityPerFinishedGood")).toBe(true);
  });

  it("validates every entity template round-trips its required columns", () => {
    (Object.keys(SAMPLE_TEMPLATES) as (keyof typeof SAMPLE_TEMPLATES)[]).forEach((kind) => {
      const r = parseCSV(SAMPLE_TEMPLATES[kind], kind);
      expect(r.missingColumns, `missing cols for ${kind}`).toHaveLength(0);
      REQUIRED_COLUMNS[kind].forEach((col) => {
        expect(r.rawRows[0]).toHaveProperty(col);
      });
    });
  });
});
