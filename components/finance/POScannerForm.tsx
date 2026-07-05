"use client";

import * as React from "react";
import { Field, Input, NumberInput, Select } from "@/components/ui/primitives";
import type { PurchaseOrder, Incoterm, PaymentTerms } from "@/lib/types";

const INCOTERMS: Incoterm[] = ["EXW", "FOB", "CIF", "DDP"];
const PAYMENT_TERMS: PaymentTerms[] = ["prepaid", "deposit_50_50", "deposit_30_70", "net_15", "net_30", "net_60"];
const STATUSES: PurchaseOrder["status"][] = ["draft", "pending", "approved", "on_hold"];
const CONFIDENCE: PurchaseOrder["forecastConfidence"][] = ["low", "medium", "high"];

function label(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Editable panel for the key inputs that drive a PO risk scan. */
export function POScannerForm({
  po,
  onChange,
}: {
  po: PurchaseOrder;
  onChange: (patch: Partial<PurchaseOrder>) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="PO Number">
        <Input value={po.poNumber} onChange={(e) => onChange({ poNumber: e.target.value })} />
      </Field>
      <Field label="Status">
        <Select value={po.status} onChange={(e) => onChange({ status: e.target.value as PurchaseOrder["status"] })}>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </Select>
      </Field>
      <Field label="Incoterm">
        <Select value={po.incoterm} onChange={(e) => onChange({ incoterm: e.target.value as Incoterm })}>
          {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      </Field>
      <Field label="Payment Terms">
        <Select value={po.paymentTerms} onChange={(e) => onChange({ paymentTerms: e.target.value as PaymentTerms })}>
          {PAYMENT_TERMS.map((t) => <option key={t} value={t}>{label(t)}</option>)}
        </Select>
      </Field>
      <Field label="Deposit Required" hint="0..1 ratio">
        <NumberInput value={po.depositRequiredPercent} onChange={(v) => onChange({ depositRequiredPercent: v })} step="0.01" />
      </Field>
      <Field label="Cash Available">
        <NumberInput value={po.currentCashAvailable} onChange={(v) => onChange({ currentCashAvailable: v })} step="100" />
      </Field>
      <Field label="Monthly Demand (units)">
        <NumberInput value={po.monthlyDemandUnits} onChange={(v) => onChange({ monthlyDemandUnits: v })} step="1" />
      </Field>
      <Field label="Warehouse Capacity (units)">
        <NumberInput value={po.warehouseCapacityUnits} onChange={(v) => onChange({ warehouseCapacityUnits: v })} step="1" />
      </Field>
      <Field label="Forecast Confidence">
        <Select value={po.forecastConfidence} onChange={(e) => onChange({ forecastConfidence: e.target.value as PurchaseOrder["forecastConfidence"] })}>
          {CONFIDENCE.map((c) => <option key={c} value={c}>{label(c)}</option>)}
        </Select>
      </Field>
    </div>
  );
}
