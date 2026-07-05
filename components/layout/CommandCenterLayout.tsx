import * as React from "react";

/**
 * Presentational dense-grid wrapper for command-center pages.
 * Constrains width, applies vertical rhythm, and renders an optional header row.
 */
export function CommandCenterLayout({
  children,
  header,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      {header && <div className="space-y-2">{header}</div>}
      {children}
    </div>
  );
}
