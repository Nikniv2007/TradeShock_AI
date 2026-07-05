"use client";

import * as React from "react";
import { Button } from "@/components/ui/primitives";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <Button variant="primary" className="no-print" onClick={() => window.print()}>
      <Printer className="h-3.5 w-3.5" /> Print to PDF
    </Button>
  );
}
