"use client";

import * as React from "react";
import { Button } from "@/components/ui/primitives";
import { downloadJSON, downloadText, toCSV } from "@/lib/data/templates";
import { FileJson, Download, Copy } from "lucide-react";

export function ExportJSONButton({ data, filename }: { data: unknown; filename: string }) {
  return (
    <Button className="no-print" onClick={() => downloadJSON(filename, data)}>
      <FileJson className="h-3.5 w-3.5" /> Export JSON
    </Button>
  );
}

export function ExportCSVButton({
  rows,
  filename,
}: {
  rows: Record<string, unknown>[];
  filename: string;
}) {
  return (
    <Button className="no-print" onClick={() => downloadText(filename, toCSV(rows))}>
      <Download className="h-3.5 w-3.5" /> Download CSV
    </Button>
  );
}

export function CopyTextButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Button className="no-print" onClick={copy}>
      <Copy className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy report text"}
    </Button>
  );
}
