"use client";

import { buttonClasses } from "@/components/ui/button";

export function PrintReportButton() {
  return (
    <button
      type="button"
      className={buttonClasses({ variant: "ghost" })}
      onClick={() => window.print()}
    >
      Print / save PDF
    </button>
  );
}
