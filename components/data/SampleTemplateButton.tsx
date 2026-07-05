"use client";

import * as React from "react";
import { Button } from "@/components/ui/primitives";
import type { EntityKind } from "@/lib/data/csvParser";
import { SAMPLE_TEMPLATES, TEMPLATE_LABELS, downloadText } from "@/lib/data/templates";
import { FileDown } from "lucide-react";

// Small button that downloads the correctly-formatted sample CSV for a given entity kind.
export function SampleTemplateButton({ kind }: { kind: EntityKind }) {
  return (
    <Button onClick={() => downloadText(`${kind}-template.csv`, SAMPLE_TEMPLATES[kind])}>
      <FileDown className="h-3.5 w-3.5" /> Download {TEMPLATE_LABELS[kind]} template
    </Button>
  );
}
