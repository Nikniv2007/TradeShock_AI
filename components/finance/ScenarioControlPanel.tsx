"use client";

import * as React from "react";
import { Slider, Select, Field } from "@/components/ui/primitives";
import type { Scenario } from "@/lib/types";
import { fmtPercent, fmtPoints } from "@/lib/utils/formatters";

const pct = (v: number) => fmtPercent(v);
const pts = (v: number) => `+${fmtPoints(v * 100)}`;

/** Slider panel for editing a shock Scenario. Fully controlled. */
export function ScenarioControlPanel({
  scenario,
  onChange,
}: {
  scenario: Scenario;
  onChange: (patch: Partial<Scenario>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        <Slider label="Tariff Increase (points)" value={scenario.tariffIncreasePercent} min={0} max={0.5} step={0.01} onChange={(v) => onChange({ tariffIncreasePercent: v })} format={pts} />
        <Slider label="Additional Duty (points)" value={scenario.additionalDutyPercent} min={0} max={0.5} step={0.01} onChange={(v) => onChange({ additionalDutyPercent: v })} format={pts} />
        <Slider label="Freight Increase" value={scenario.freightIncreasePercent} min={0} max={2} step={0.05} onChange={(v) => onChange({ freightIncreasePercent: v })} format={pct} />
        <Slider label="Supplier Cost Increase" value={scenario.supplierCostIncreasePercent} min={0} max={1} step={0.01} onChange={(v) => onChange({ supplierCostIncreasePercent: v })} format={pct} />
        <Slider label="Currency Impact" value={scenario.currencyImpactPercent} min={-0.5} max={0.5} step={0.01} onChange={(v) => onChange({ currencyImpactPercent: v })} format={pct} />
        <Slider label="Insurance Cost Increase" value={scenario.insuranceCostIncreasePercent} min={0} max={1} step={0.01} onChange={(v) => onChange({ insuranceCostIncreasePercent: v })} format={pct} />
        <Slider label="Warehouse Cost Increase" value={scenario.warehouseCostIncreasePercent} min={0} max={1} step={0.01} onChange={(v) => onChange({ warehouseCostIncreasePercent: v })} format={pct} />
        <Slider label="Demand Drop" value={scenario.demandDropPercent} min={0} max={1} step={0.01} onChange={(v) => onChange({ demandDropPercent: v })} format={pct} />
        <Slider label="Lead Time Increase (days)" value={scenario.leadTimeIncreaseDays} min={0} max={90} step={1} onChange={(v) => onChange({ leadTimeIncreaseDays: v })} format={(v) => `${Math.round(v)}d`} />
        <Slider label="Target Margin" value={scenario.targetMargin} min={0} max={0.8} step={0.01} onChange={(v) => onChange({ targetMargin: v })} format={pct} />
        <Slider label="Price Increase Allowed" value={scenario.priceIncreaseAllowedPercent} min={0} max={0.5} step={0.01} onChange={(v) => onChange({ priceIncreaseAllowedPercent: v })} format={pct} />
      </div>

      <Field label="Customer Price Sensitivity">
        <Select
          value={scenario.customerPriceSensitivity}
          onChange={(e) => onChange({ customerPriceSensitivity: e.target.value as Scenario["customerPriceSensitivity"] })}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </Select>
      </Field>
    </div>
  );
}
