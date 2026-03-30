import type {
  AcquisitionType,
  AssumptionProfileKey,
  FinancingSourceType,
  MissingDataFlag,
  OptimizationTarget,
  StrategyType,
} from "../../generated-contracts/enums";
import type { RunWarningDto } from "../../generated-contracts/common";
import type { ScenarioResultExplanationDto } from "../../generated-contracts/feasibility";

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
  assumptionSet: {
    profileKey: AssumptionProfileKey;
    notes: string | null;
    overrideCount: number;
  };
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

export interface FeasibilityAssumptionInput {
  profileKey: AssumptionProfileKey;
  planningBufferPct: number;
  efficiencyFactorPct: number;
  vacancyPct: number;
  operatingCostPerNlaSqmYear: number;
  acquisitionClosingCostPct: number;
  contingencyPct: number;
  developerFeePct: number;
  targetProfitPct: number;
  exitCapRatePct: number;
  salesClosingCostPct: number;
  salesAbsorptionMonths: number;
  parkingRevenuePerSpaceMonth: number;
  parkingSalePricePerSpace: number;
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
  assumptions: FeasibilityAssumptionInput;
  planning: FeasibilityPlanningInput;
  fundingStack: FeasibilityFundingStackItemInput[];
}

export interface FeasibilityMetricOutputs {
  buildableFootprintSqm: number | null;
  buildableBgfSqm: number | null;
  planningAdjustedBgfSqm: number | null;
  effectiveFloors: number | null;
  estimatedUnitCount: number | null;
  requiredParkingSpaces: number | null;
  acquisitionCost: number | null;
  hardCost: number | null;
  softCost: number | null;
  parkingCost: number | null;
  contingencyCost: number | null;
  developerFee: number | null;
  totalDevelopmentCost: number | null;
  totalCapitalizedUses: number | null;
  freeFinancingAmount: number | null;
  stateSubsidyAmount: number | null;
  kfwAmount: number | null;
  grantAmount: number | null;
  equityAmount: number | null;
  requiredEquity: number | null;
  grossResidentialRevenueAnnual: number | null;
  vacancyAdjustedRevenueAnnual: number | null;
  operatingCostAnnual: number | null;
  parkingRevenueAnnual: number | null;
  parkingSalesRevenue: number | null;
  netOperatingIncomeAnnual: number | null;
  grossSalesRevenue: number | null;
  netSalesRevenue: number | null;
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
