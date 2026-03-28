import type {
  AcquisitionType,
  FinancingSourceType,
  MissingDataFlag,
  OptimizationTarget,
  StrategyType,
} from "../../../../../packages/contracts/dist/enums";
import type { RunWarningDto } from "../../../../../packages/contracts/dist/common";
import type { ScenarioResultExplanationDto } from "../../../../../packages/contracts/dist/feasibility";

export interface ScenarioSnapshotFundingItem {
  id: string;
  label: string;
  financingSourceType: FinancingSourceType;
  stackOrder: number;
  isEnabled: boolean;
  fundingProgramVariantId: string | null;
}

export interface ScenarioSnapshotInput {
  scenarioId: string;
  strategyType: StrategyType;
  acquisitionType: AcquisitionType;
  optimizationTarget: OptimizationTarget;
  parcelId: string | null;
  strategyMixJson: Record<string, unknown> | null;
  fundingVariants: ScenarioSnapshotFundingItem[];
}

export interface FeasibilityPlanningInput {
  parcelAreaSqm: number;
  grz?: number;
  gfz?: number;
  maxBgfSqm?: number;
  maxHeightM?: number;
  maxFloors?: number;
  maxUnits?: number;
  parkingSpacesPerUnit?: number;
  buildableWindowAreaSqm?: number;
  rentCapEurSqm?: number;
  subsidyEligibility?: boolean;
  loanCapPct?: number;
}

export interface FeasibilityFundingStackItemInput {
  id: string;
  label: string;
  financingSourceType: FinancingSourceType;
  stackOrder: number;
  isEnabled: boolean;
  amountOverride?: number;
  sharePctOverride?: number;
  interestRatePct?: number;
  termMonths?: number;
  maxLoanPct?: number;
  maxLoanPerSqm?: number;
  rentCapEurSqm?: number;
  loanCapPct?: number;
  subsidyEligibleSharePct?: number;
  allowsKfwCombination?: boolean;
}

export interface FeasibilityEngineInput {
  organizationId: string;
  scenarioId: string;
  strategyType: StrategyType;
  optimizationTarget: OptimizationTarget;
  avgUnitSizeSqm?: number;
  targetMarketRentEurSqm?: number;
  targetSubsidizedRentEurSqm?: number;
  targetSalesPriceEurSqm?: number;
  subsidizedSharePct?: number;
  hardCostPerBgfSqm?: number;
  softCostPct?: number;
  parkingCostPerSpace?: number;
  landCost?: number;
  equityTargetPct?: number;
  planning: FeasibilityPlanningInput;
  fundingStack: FeasibilityFundingStackItemInput[];
}

export interface FeasibilityMetricOutputs {
  buildableFootprintSqm: number | null;
  buildableBgfSqm: number | null;
  effectiveFloors: number | null;
  estimatedUnitCount: number | null;
  requiredParkingSpaces: number | null;
  hardCost: number | null;
  softCost: number | null;
  parkingCost: number | null;
  totalDevelopmentCost: number | null;
  freeFinancingAmount: number | null;
  stateSubsidyAmount: number | null;
  kfwAmount: number | null;
  grantAmount: number | null;
  equityAmount: number | null;
  requiredEquity: number | null;
  breakEvenRentEurSqm: number | null;
  breakEvenSalesPriceEurSqm: number | null;
  subsidyAdjustedBreakEvenRentEurSqm: number | null;
  subsidyAdjustedProfitPct: number | null;
  subsidyAdjustedIrrPct: number | null;
  objectiveValue: number | null;
}

export interface FeasibilityConfidenceOutput {
  inputConfidencePct: number;
  outputConfidencePct: number;
  reasons: string[];
}

export interface FeasibilityEngineOutput {
  heuristicVersion: string;
  warnings: RunWarningDto[];
  missingDataFlags: MissingDataFlag[];
  confidence: FeasibilityConfidenceOutput;
  outputs: FeasibilityMetricOutputs;
  explanation: ScenarioResultExplanationDto;
}
