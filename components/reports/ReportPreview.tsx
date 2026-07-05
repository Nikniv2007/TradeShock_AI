"use client";

import * as React from "react";

export function ReportPreview({ children }: { children: React.ReactNode }) {
  return <div className="print-page card space-y-6 p-6">{children}</div>;
}
