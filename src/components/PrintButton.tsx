"use client";
import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary no-print">
      <Printer size={15} /> Save as PDF
    </button>
  );
}
