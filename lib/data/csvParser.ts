// ─────────────────────────────────────────────────────────────
// CSV import system. Wraps papaparse and validates required columns,
// surfacing data-quality warnings without throwing.
// ─────────────────────────────────────────────────────────────

import Papa from "papaparse";

export type EntityKind = "products" | "suppliers" | "purchaseOrders" | "customers" | "bom";

export interface DataQualityIssue {
  row: number; // 1-indexed data row
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ParseResult<T = Record<string, string>> {
  kind: EntityKind;
  rawRows: Record<string, string>[];
  validRows: T[];
  failedRows: { row: number; reason: string }[];
  issues: DataQualityIssue[];
  missingColumns: string[];
  summary: { total: number; valid: number; failed: number; warnings: number };
}

export const REQUIRED_COLUMNS: Record<EntityKind, string[]> = {
  products: ["sku", "name", "category", "supplierName", "countryOfOrigin", "supplierUnitCost", "sellingPrice", "targetMargin"],
  suppliers: ["name", "country", "currency", "reliabilityScore", "averageLeadTimeDays", "paymentTerms"],
  purchaseOrders: ["poNumber", "supplierName", "sku", "quantity", "unitCost", "expectedArrivalDate"],
  customers: ["name", "type", "annualRevenue", "grossMargin", "paymentTerms"],
  bom: ["finishedSku", "componentName", "supplierName", "countryOfOrigin", "unitCost", "quantityPerFinishedGood"],
};

function num(v: string | undefined): number {
  const n = parseFloat((v ?? "").toString().replace(/[$,%]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

export function parseCSV(text: string, kind: EntityKind): ParseResult {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rawRows = (parsed.data || []).filter((r) => Object.keys(r).length > 0);
  const headers = parsed.meta.fields ?? [];
  const required = REQUIRED_COLUMNS[kind];
  const missingColumns = required.filter((c) => !headers.includes(c));

  const issues: DataQualityIssue[] = [];
  const failedRows: { row: number; reason: string }[] = [];
  const validRows: Record<string, string>[] = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 1;
    let rowFailed = false;

    // Required present
    for (const col of required) {
      if (!row[col] || row[col].toString().trim() === "") {
        issues.push({ row: rowNum, field: col, message: `Missing ${col}.`, severity: "error" });
        rowFailed = true;
      }
    }

    // Entity-specific quality checks
    if (kind === "products") {
      if (num(row.sellingPrice) <= 0) issues.push({ row: rowNum, field: "sellingPrice", message: "Missing or non-positive selling price.", severity: "error" }), (rowFailed = true);
      if (num(row.supplierUnitCost) < 0) issues.push({ row: rowNum, field: "supplierUnitCost", message: "Negative cost.", severity: "error" }), (rowFailed = true);
      if (!row.supplierName) issues.push({ row: rowNum, field: "supplierName", message: "Product has no supplier.", severity: "warning" });
      if (!row.countryOfOrigin) issues.push({ row: rowNum, field: "countryOfOrigin", message: "Product has no country of origin.", severity: "warning" });
      const tm = num(row.targetMargin);
      if (Number.isNaN(tm) || tm < 0 || tm >= 1) issues.push({ row: rowNum, field: "targetMargin", message: "Target margin should be between 0 and 1 (e.g. 0.35).", severity: "warning" });
      if (row.currentTariffRate === undefined || row.currentTariffRate === "") issues.push({ row: rowNum, field: "currentTariffRate", message: "Tariff rate missing — defaults to 0.", severity: "warning" });
    }
    if (kind === "suppliers") {
      if (!row.averageLeadTimeDays || num(row.averageLeadTimeDays) <= 0) issues.push({ row: rowNum, field: "averageLeadTimeDays", message: "Supplier without lead time.", severity: "warning" });
    }
    if (kind === "purchaseOrders") {
      if (num(row.quantity) <= 0) issues.push({ row: rowNum, field: "quantity", message: "Zero or negative quantity.", severity: "error" }), (rowFailed = true);
      if (!row.expectedArrivalDate) issues.push({ row: rowNum, field: "expectedArrivalDate", message: "PO missing arrival date.", severity: "warning" });
    }
    if (kind === "customers") {
      const gm = num(row.grossMargin);
      if (Number.isNaN(gm) || gm < 0 || gm >= 1) issues.push({ row: rowNum, field: "grossMargin", message: "Gross margin should be 0..1.", severity: "warning" });
    }

    if (rowFailed) failedRows.push({ row: rowNum, reason: issues.filter((i) => i.row === rowNum && i.severity === "error").map((i) => i.message).join(" ") });
    else validRows.push(row);
  });

  return {
    kind,
    rawRows,
    validRows,
    failedRows,
    issues,
    missingColumns,
    summary: {
      total: rawRows.length,
      valid: validRows.length,
      failed: failedRows.length,
      warnings: issues.filter((i) => i.severity === "warning").length,
    },
  };
}
