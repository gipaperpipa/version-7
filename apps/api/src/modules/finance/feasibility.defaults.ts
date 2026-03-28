import { RunWarningCode } from "../../../../../packages/contracts/dist/enums";

export const FEASIBILITY_V0_DEFAULTS = {
  floorToFloorMeters: 3.1,
  fallbackEffectiveFloors: 4,
  fallbackParcelFootprintShare: 0.4,
  nlaEfficiencyFactor: 0.82,
  defaultParkingSpacesPerUnit: 0.7,
  defaultParkingCostPerSpace: 25_000,
  defaultSoftCostPct: 0.15,
  breakEvenYears: 20,
  monthsPerYear: 12,
  kfwSubsidyEquivalentFactor: 0.15,
} as const;

export const FEASIBILITY_V0_WARNINGS = [
  {
    code: RunWarningCode.HEURISTIC_BUILDABILITY,
    message: "Heuristic v0 buildability formulas. Replace later.",
  },
  {
    code: RunWarningCode.HEURISTIC_COSTS,
    message: "Heuristic v0 cost formulas. Replace later.",
  },
  {
    code: RunWarningCode.HEURISTIC_CAPITAL_STACK,
    message: "Heuristic v0 capital stack allocation. Replace later.",
  },
] as const;
