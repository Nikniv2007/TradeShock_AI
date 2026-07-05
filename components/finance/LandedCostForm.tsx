"use client";

import * as React from "react";
import { Field, Input, NumberInput, Select } from "@/components/ui/primitives";
import type { LandedCostInput, Incoterm, Currency } from "@/lib/types";

const INCOTERMS: Incoterm[] = ["EXW", "FOB", "CIF", "DDP"];
const CURRENCIES: Currency[] = ["USD", "CNY", "VND", "MXN", "INR", "TRY", "EUR"];

/** Reusable input grid for a landed-cost calculation. Fully controlled. */
export function LandedCostForm({
  value,
  onChange,
}: {
  value: LandedCostInput;
  onChange: (patch: Partial<LandedCostInput>) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Identification */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Product Name">
          <Input value={value.productName ?? ""} onChange={(e) => onChange({ productName: e.target.value })} placeholder="e.g. Steel Bracket" />
        </Field>
        <Field label="SKU">
          <Input value={value.sku ?? ""} onChange={(e) => onChange({ sku: e.target.value })} placeholder="e.g. SB-100" />
        </Field>
        <Field label="Supplier Country">
          <Input value={value.supplierCountry ?? ""} onChange={(e) => onChange({ supplierCountry: e.target.value })} placeholder="e.g. China" />
        </Field>
      </div>

      {/* Trade terms */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Incoterm">
          <Select value={value.incoterm} onChange={(e) => onChange({ incoterm: e.target.value as Incoterm })}>
            {INCOTERMS.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
        </Field>
        <Field label="Currency">
          <Select value={value.currency} onChange={(e) => onChange({ currency: e.target.value as Currency })}>
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Supplier Unit Cost" hint="per unit, in currency above">
          <NumberInput value={value.supplierUnitCost} onChange={(v) => onChange({ supplierUnitCost: v })} step="0.01" />
        </Field>
        <Field label="Quantity">
          <NumberInput value={value.quantity} onChange={(v) => onChange({ quantity: v })} step="1" />
        </Field>
      </div>

      {/* Logistics totals */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Freight Total"><NumberInput value={value.freightTotal} onChange={(v) => onChange({ freightTotal: v })} step="0.01" /></Field>
        <Field label="Insurance Total"><NumberInput value={value.insuranceTotal} onChange={(v) => onChange({ insuranceTotal: v })} step="0.01" /></Field>
        <Field label="Broker Fees"><NumberInput value={value.brokerFees} onChange={(v) => onChange({ brokerFees: v })} step="0.01" /></Field>
        <Field label="Port Fees"><NumberInput value={value.portFees} onChange={(v) => onChange({ portFees: v })} step="0.01" /></Field>
        <Field label="Handling Fees"><NumberInput value={value.handlingFees} onChange={(v) => onChange({ handlingFees: v })} step="0.01" /></Field>
        <Field label="Warehouse Fees"><NumberInput value={value.warehouseFees} onChange={(v) => onChange({ warehouseFees: v })} step="0.01" /></Field>
        <Field label="Domestic Delivery"><NumberInput value={value.domesticDeliveryFees} onChange={(v) => onChange({ domesticDeliveryFees: v })} step="0.01" /></Field>
        <Field label="Inspection Fees"><NumberInput value={value.inspectionFees} onChange={(v) => onChange({ inspectionFees: v })} step="0.01" /></Field>
        <Field label="Other Fees"><NumberInput value={value.otherFees} onChange={(v) => onChange({ otherFees: v })} step="0.01" /></Field>
      </div>

      {/* Duties & pricing */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tariff Rate" hint="0..1 ratio (e.g. 0.10 = 10%)">
          <NumberInput value={value.tariffRate} onChange={(v) => onChange({ tariffRate: v })} step="0.01" />
        </Field>
        <Field label="Additional Tariff" hint="0..1 ratio">
          <NumberInput value={value.additionalTariffRate} onChange={(v) => onChange({ additionalTariffRate: v })} step="0.01" />
        </Field>
        <Field label="Selling Price" hint="per unit">
          <NumberInput value={value.sellingPrice} onChange={(v) => onChange({ sellingPrice: v })} step="0.01" />
        </Field>
        <Field label="Target Margin" hint="0..1 ratio">
          <NumberInput value={value.targetMargin} onChange={(v) => onChange({ targetMargin: v })} step="0.01" />
        </Field>
      </div>
    </div>
  );
}
