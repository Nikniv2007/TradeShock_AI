import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TradeShock AI — The AI Tariff, Supplier, and Margin War Room",
  description:
    "AI-powered trade-finance platform: true landed cost, tariff shock simulation, supplier ROI, PO risk scanning, HTS review, and margin protection for import-reliant businesses.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
