"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStore } from "@/lib/store/useStore";
import {
  Card, SectionTitle, Button, MetricCard, Field, Select, StatusBadge, DisclaimerBox, EmptyState,
} from "@/components/ui/primitives";
import { parseCSV, REQUIRED_COLUMNS, type EntityKind, type ParseResult } from "@/lib/data/csvParser";
import { SAMPLE_TEMPLATES, TEMPLATE_LABELS, downloadText, downloadJSON } from "@/lib/data/templates";
import { num } from "@/lib/utils/validators";
import { fmtNumber, titleCase } from "@/lib/utils/formatters";
import type { Product, Customer } from "@/lib/types";
import {
  Database, Upload, FileDown, RotateCcw, DownloadCloud, CheckCircle2, AlertTriangle, FileWarning, Table,
} from "lucide-react";

const ENTITY_KINDS: EntityKind[] = ["products", "suppliers", "purchaseOrders", "customers", "bom"];

const QUALITY_CHECKS = [
  "Missing or non-positive selling price",
  "Missing supplier / product without supplier",
  "Negative supplier cost",
  "Zero or negative order quantity",
  "Invalid target margin (outside 0–1)",
  "Missing tariff rate (defaults to 0)",
  "Product without country of origin",
  "Supplier without lead time",
  "Purchase order missing arrival date",
];

export default function DataRoomPage() {
  const store = useStore();
  const { dataset } = store;
  const [mounted, setMounted] = React.useState(false);
  const [kind, setKind] = React.useState<EntityKind>("products");
  const [result, setResult] = React.useState<ParseResult | null>(null);
  const [fileName, setFileName] = React.useState("");
  const [importNote, setImportNote] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setMounted(true), []);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportNote("");
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setResult(parseCSV(text, kind));
    };
    reader.readAsText(file);
  }

  function loadSampleIntoParser() {
    setFileName(`${kind}-sample.csv`);
    setImportNote("");
    setResult(parseCSV(SAMPLE_TEMPLATES[kind], kind));
  }

  function importIntoState() {
    if (!result || result.validRows.length === 0) return;
    const now = new Date().toISOString();
    if (kind === "products") {
      const rows = result.validRows as Record<string, string>[];
      const products: Product[] = rows.map((r, i) => ({
        id: `imp-${Date.now()}-${i}`,
        companyId: dataset.company.id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        supplierId: "",
        countryOfOrigin: r.countryOfOrigin,
        currentHTSCode: r.currentHTSCode || undefined,
        currentTariffRate: num(r.currentTariffRate),
        additionalTariffRate: num(r.additionalTariffRate),
        supplierUnitCost: num(r.supplierUnitCost),
        freightPerUnit: num(r.freightPerUnit),
        otherFeesPerUnit: num(r.otherFeesPerUnit),
        sellingPrice: num(r.sellingPrice),
        targetMargin: num(r.targetMargin) || dataset.company.defaultTargetMargin,
        currentInventory: num(r.currentInventory),
        monthlyDemand: num(r.monthlyDemand),
        leadTimeDays: num(r.leadTimeDays),
        priceFlexibility: (["low", "medium", "high"].includes(r.priceFlexibility) ? r.priceFlexibility : "medium") as Product["priceFlexibility"],
        customerType: "wholesale",
        createdAt: now,
        updatedAt: now,
      }));
      store.addProducts(products);
      setImportNote(`Imported ${products.length} products into local state.`);
    } else if (kind === "customers") {
      const rows = result.validRows as Record<string, string>[];
      const customers: Customer[] = rows.map((r, i) => ({
        id: `imp-${Date.now()}-${i}`,
        companyId: dataset.company.id,
        name: r.name,
        type: (["retail", "wholesale", "marketplace", "distributor", "b2b"].includes(r.type) ? r.type : "wholesale") as Customer["type"],
        annualRevenue: num(r.annualRevenue),
        grossMargin: num(r.grossMargin),
        paymentTerms: (r.paymentTerms || "net_30") as Customer["paymentTerms"],
        discountLevel: num(r.discountLevel),
        contractType: (["fixed", "flexible", "spot"].includes(r.contractType) ? r.contractType : "flexible") as Customer["contractType"],
        priceFlexibility: (["low", "medium", "high"].includes(r.priceFlexibility) ? r.priceFlexibility : "medium") as Customer["priceFlexibility"],
        volumeCommitment: num(r.volumeCommitment),
        churnRisk: (["low", "medium", "high"].includes(r.churnRisk) ? r.churnRisk : "medium") as Customer["churnRisk"],
        strategicImportance: (["low", "medium", "high"].includes(r.strategicImportance) ? r.strategicImportance : "medium") as Customer["strategicImportance"],
        serviceCost: num(r.serviceCost),
        tariffPassThroughClause: String(r.tariffPassThroughClause).toLowerCase() === "true",
        tariffExposure: num(r.tariffExposure),
      }));
      store.setCustomers(customers);
      setImportNote(`Imported ${customers.length} customers into local state.`);
    } else {
      setImportNote(`Parsed ${result.validRows.length} valid ${TEMPLATE_LABELS[kind]} rows. Import into local state is supported for Products and Customers in demo mode.`);
    }
  }

  const counts = mounted
    ? { products: dataset.products.length, suppliers: dataset.suppliers.length, purchaseOrders: dataset.purchaseOrders.length, customers: dataset.customers.length, bom: dataset.boms.length }
    : { products: 0, suppliers: 0, purchaseOrders: 0, customers: 0, bom: 0 };

  const preview = result?.rawRows.slice(0, 5) ?? [];
  const previewCols = preview.length > 0 ? Object.keys(preview[0]) : [];

  return (
    <>
      <PageHeader
        title="Data Room"
        description="Upload, validate, and import your trade data — or load the demo portfolio. Every file is parsed client-side and checked for quality before it touches your workspace."
        icon={Database}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="amber" onClick={() => store.loadDemoData()}><DownloadCloud className="h-3.5 w-3.5" /> Load demo data</Button>
            <Button onClick={() => downloadJSON("tradeshock-dataset.json", dataset)}><FileDown className="h-3.5 w-3.5" /> Export dataset JSON</Button>
            <Button variant="danger" onClick={() => { store.resetData(); setResult(null); setImportNote("Workspace reset. Load demo data or upload a CSV to continue."); }}><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Current dataset */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <MetricCard label="Products" value={fmtNumber(counts.products)} tone={counts.products > 0 ? "cyan" : "neutral"} />
          <MetricCard label="Suppliers" value={fmtNumber(counts.suppliers)} tone={counts.suppliers > 0 ? "cyan" : "neutral"} />
          <MetricCard label="Purchase Orders" value={fmtNumber(counts.purchaseOrders)} tone={counts.purchaseOrders > 0 ? "cyan" : "neutral"} />
          <MetricCard label="Customers" value={fmtNumber(counts.customers)} tone={counts.customers > 0 ? "cyan" : "neutral"} />
          <MetricCard label="BOMs" value={fmtNumber(counts.bom)} tone={counts.bom > 0 ? "cyan" : "neutral"} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* Upload + results */}
          <div className="space-y-6">
            <Card>
              <SectionTitle icon={Upload} title="Upload a CSV" subtitle="Choose the entity type, then select a file. Parsing and validation happen instantly in your browser." />
              <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
                <Field label="Entity type">
                  <Select value={kind} onChange={(e) => { setKind(e.target.value as EntityKind); setResult(null); setImportNote(""); }}>
                    {ENTITY_KINDS.map((k) => <option key={k} value={k}>{TEMPLATE_LABELS[k]}</option>)}
                  </Select>
                </Field>
                <Field label="CSV file">
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="input cursor-pointer file:mr-3 file:rounded-md file:border-0 file:bg-base-700 file:px-3 file:py-1 file:text-ink" />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button onClick={loadSampleIntoParser}><Table className="h-3.5 w-3.5" /> Try with sample {TEMPLATE_LABELS[kind]}</Button>
                <Button onClick={() => downloadText(`${kind}-template.csv`, SAMPLE_TEMPLATES[kind])}><FileDown className="h-3.5 w-3.5" /> Download {TEMPLATE_LABELS[kind]} template</Button>
                {fileName && <span className="text-xs text-ink-faint">Loaded: {fileName}</span>}
              </div>
              <p className="mt-3 text-xs text-ink-faint">Required columns: <span className="font-mono text-ink-muted">{REQUIRED_COLUMNS[kind].join(", ")}</span></p>
            </Card>

            {!result && (
              <EmptyState icon={Table} title="No file parsed yet" message="Upload a CSV or click “Try with sample” to see the raw preview, validation, and import summary." />
            )}

            {result && (
              <>
                {/* Import summary */}
                <Card>
                  <SectionTitle icon={CheckCircle2} title="Import Summary" subtitle={`Parsed ${result.summary.total} rows for ${TEMPLATE_LABELS[result.kind]}.`}
                    right={<Button variant="primary" onClick={importIntoState} disabled={result.validRows.length === 0}><DownloadCloud className="h-3.5 w-3.5" /> Import into local state</Button>} />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricCard label="Total Rows" value={fmtNumber(result.summary.total)} />
                    <MetricCard label="Valid" value={fmtNumber(result.summary.valid)} tone="emerald" />
                    <MetricCard label="Failed" value={fmtNumber(result.summary.failed)} tone={result.summary.failed > 0 ? "danger" : "emerald"} />
                    <MetricCard label="Warnings" value={fmtNumber(result.summary.warnings)} tone={result.summary.warnings > 0 ? "amber" : "emerald"} />
                  </div>
                  {result.missingColumns.length > 0 && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 p-3 text-xs text-danger">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>Missing required columns: <span className="font-mono">{result.missingColumns.join(", ")}</span>. Add them and re-upload.</span>
                    </div>
                  )}
                  {importNote && <p className="mt-3 text-xs text-emerald">{importNote}</p>}
                </Card>

                {/* Raw preview */}
                <Card>
                  <SectionTitle icon={Table} title="Raw Preview" subtitle={`First ${preview.length} rows as parsed from the file.`} />
                  {previewCols.length === 0 ? <p className="text-sm text-ink-faint">No rows parsed.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] text-xs">
                        <thead><tr className="border-b border-white/[0.08]">{previewCols.map((c) => <th key={c} className="stat-label px-2.5 py-2 text-left">{c}</th>)}</tr></thead>
                        <tbody>
                          {preview.map((r, i) => (
                            <tr key={i} className="border-b border-white/[0.04]">{previewCols.map((c) => <td key={c} className="px-2.5 py-1.5 text-ink-muted">{r[c]}</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Data quality issues */}
                <Card>
                  <SectionTitle icon={FileWarning} title="Data Quality Issues" subtitle={`${result.issues.length} issues detected.`} />
                  {result.issues.length === 0 ? (
                    <p className="text-sm text-emerald">No data-quality issues found.</p>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-lg border border-white/[0.06]">
                      <table className="w-full min-w-[520px] text-xs">
                        <thead className="sticky top-0 bg-base-850"><tr>
                          <th className="stat-label px-2.5 py-2 text-left">Row</th>
                          <th className="stat-label px-2.5 py-2 text-left">Field</th>
                          <th className="stat-label px-2.5 py-2 text-left">Message</th>
                          <th className="stat-label px-2.5 py-2 text-left">Severity</th>
                        </tr></thead>
                        <tbody>
                          {result.issues.map((iss, i) => (
                            <tr key={i} className="border-t border-white/[0.04]">
                              <td className="px-2.5 py-1.5 tabular-nums text-ink-muted">{iss.row}</td>
                              <td className="px-2.5 py-1.5 font-mono text-ink-muted">{iss.field}</td>
                              <td className="px-2.5 py-1.5 text-ink-muted">{iss.message}</td>
                              <td className="px-2.5 py-1.5"><StatusBadge tone={iss.severity === "error" ? "danger" : "amber"}>{titleCase(iss.severity)}</StatusBadge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* Failed rows */}
                {result.failedRows.length > 0 && (
                  <Card>
                    <SectionTitle icon={AlertTriangle} title="Failed Rows" subtitle={`${result.failedRows.length} rows will not be imported.`} />
                    <ul className="space-y-1 text-xs text-ink-muted">
                      {result.failedRows.map((f) => (
                        <li key={f.row} className="flex gap-2"><span className="font-mono text-danger">Row {f.row}</span>{f.reason}</li>
                      ))}
                    </ul>
                  </Card>
                )}
              </>
            )}
          </div>

          {/* Sidebar: checks + templates */}
          <div className="space-y-6">
            <Card>
              <SectionTitle title="Data Quality Checks" subtitle="Applied automatically on every import." />
              <ul className="space-y-1.5 text-xs text-ink-muted">
                {QUALITY_CHECKS.map((c, i) => (
                  <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald" />{c}</li>
                ))}
              </ul>
            </Card>

            <Card>
              <SectionTitle title="Sample Templates" subtitle="Download a correctly-formatted starter CSV." />
              <div className="space-y-2">
                {ENTITY_KINDS.map((k) => (
                  <div key={k} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-base-900/50 px-3 py-2">
                    <span className="text-sm text-ink">{TEMPLATE_LABELS[k]}</span>
                    <button onClick={() => downloadText(`${k}-template.csv`, SAMPLE_TEMPLATES[k])} className="flex items-center gap-1 text-xs text-slateaccent hover:text-slateaccent/80"><FileDown className="h-3.5 w-3.5" /> CSV</button>
                  </div>
                ))}
              </div>
            </Card>

            <DisclaimerBox variant="general">
              Warning: this is a demo workspace. Do not upload confidential or regulated business data. Files are parsed locally in your
              browser and stored only in this browser's local storage; they are not a system of record. TradeShock AI provides
              informational analysis only, not legal, customs, tax, accounting, or financial advice.
            </DisclaimerBox>
          </div>
        </div>
      </div>
    </>
  );
}
