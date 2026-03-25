import { SourceType } from "@repo/contracts";

export type ConfidenceBand = "High" | "Medium" | "Low" | "Unscored";

export function getConfidenceBand(score: number | null | undefined): ConfidenceBand {
  if (score == null) return "Unscored";
  if (score >= 85) return "High";
  if (score >= 60) return "Medium";
  if (score >= 1) return "Low";
  return "Unscored";
}

export function getSourceLabel(sourceType: SourceType | null | undefined) {
  switch (sourceType) {
    case SourceType.USER_INPUT:
    case SourceType.MANUAL_OVERRIDE:
      return "Manual";
    case SourceType.SYSTEM_DERIVED:
      return "Derived";
    case SourceType.IMPORT:
    case SourceType.GIS_CADASTRE:
    case SourceType.PLANNING_DOCUMENT:
    case SourceType.THIRD_PARTY_API:
      return "Source";
    default:
      return null;
  }
}

export function getConfidenceBandClasses(band: ConfidenceBand) {
  switch (band) {
    case "High":
      return "border-emerald-300 bg-emerald-50 text-emerald-900";
    case "Medium":
      return "border-amber-300 bg-amber-50 text-amber-900";
    case "Low":
      return "border-rose-300 bg-rose-50 text-rose-900";
    default:
      return "border-slate-300 bg-white text-slate-700";
  }
}
