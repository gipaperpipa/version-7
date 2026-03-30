import type { DecimalString, Id, IsoDateTime, RunDiagnosticsDto } from "./common";
import type { ScenarioReadinessStatus, ScenarioRunStatus } from "./enums";
import type { ScenarioReadinessIssueDto } from "./readiness";
import type { ScenarioAssumptionEffectiveDto } from "./scenarios";

export interface ScenarioResultExplanationDto {
  heuristicVersion: string;
  summary: string;
  objectiveNarrative: string;
  dominantDrivers: string[];
  fallbackAssumptions: string[];
  capitalStackNarrative: string[];
  weakestLinks: string[];
  tradeoffs: string[];
  nextActions: string[];
}

export interface CreateScenarioRunRequestDto {}

export interface FinancialResultDto extends RunDiagnosticsDto {
  id: Id;
  scenarioRunId: Id;
  buildableFootprintSqm: DecimalString | null;
  buildableBgfSqm: DecimalString | null;
  planningAdjustedBgfSqm: DecimalString | null;
  effectiveFloors: number | null;
  estimatedUnitCount: number | null;
  requiredParkingSpaces: number | null;
  acquisitionCost: DecimalString | null;
  hardCost: DecimalString | null;
  softCost: DecimalString | null;
  parkingCost: DecimalString | null;
  contingencyCost: DecimalString | null;
  developerFee: DecimalString | null;
  totalDevelopmentCost: DecimalString | null;
  totalCapitalizedUses: DecimalString | null;
  freeFinancingAmount: DecimalString | null;
  stateSubsidyAmount: DecimalString | null;
  kfwAmount: DecimalString | null;
  grantAmount: DecimalString | null;
  equityAmount: DecimalString | null;
  requiredEquity: DecimalString | null;
  grossResidentialRevenueAnnual: DecimalString | null;
  vacancyAdjustedRevenueAnnual: DecimalString | null;
  operatingCostAnnual: DecimalString | null;
  parkingRevenueAnnual: DecimalString | null;
  parkingSalesRevenue: DecimalString | null;
  netOperatingIncomeAnnual: DecimalString | null;
  grossSalesRevenue: DecimalString | null;
  netSalesRevenue: DecimalString | null;
  breakEvenRentEurSqm: DecimalString | null;
  breakEvenSalesPriceEurSqm: DecimalString | null;
  subsidyAdjustedBreakEvenRentEurSqm: DecimalString | null;
  subsidyAdjustedProfitPct: DecimalString | null;
  subsidyAdjustedIrrPct: DecimalString | null;
  objectiveValue: DecimalString | null;
  assumptions: ScenarioAssumptionEffectiveDto | null;
  explanation: ScenarioResultExplanationDto | null;
  outputsJson: Record<string, unknown> | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ScenarioRunDto extends RunDiagnosticsDto {
  id: Id;
  organizationId: Id;
  scenarioId: Id;
  triggeredById: Id | null;
  status: ScenarioRunStatus;
  readinessStatus: ScenarioReadinessStatus | null;
  readinessIssues: ScenarioReadinessIssueDto[];
  queueJobId: string | null;
  engineVersion: string | null;
  inputSnapshot: Record<string, unknown> | null;
  errorMessage: string | null;
  requestedAt: IsoDateTime;
  startedAt: IsoDateTime | null;
  finishedAt: IsoDateTime | null;
  financialResult: FinancialResultDto | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
