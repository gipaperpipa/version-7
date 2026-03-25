import type { DecimalString, Id, IsoDateTime, RunDiagnosticsDto } from "./common";
import type { ScenarioReadinessStatus, ScenarioRunStatus } from "./enums";
import type { ScenarioReadinessIssueDto } from "./readiness";

export interface ScenarioResultExplanationDto {
  heuristicVersion: string;
  summary: string;
  dominantDrivers: string[];
  fallbackAssumptions: string[];
  capitalStackNarrative: string[];
}

export interface CreateScenarioRunRequestDto {}

export interface FinancialResultDto extends RunDiagnosticsDto {
  id: Id;
  scenarioRunId: Id;
  buildableFootprintSqm: DecimalString | null;
  buildableBgfSqm: DecimalString | null;
  effectiveFloors: number | null;
  estimatedUnitCount: number | null;
  requiredParkingSpaces: number | null;
  hardCost: DecimalString | null;
  softCost: DecimalString | null;
  parkingCost: DecimalString | null;
  totalDevelopmentCost: DecimalString | null;
  freeFinancingAmount: DecimalString | null;
  stateSubsidyAmount: DecimalString | null;
  kfwAmount: DecimalString | null;
  grantAmount: DecimalString | null;
  equityAmount: DecimalString | null;
  requiredEquity: DecimalString | null;
  breakEvenRentEurSqm: DecimalString | null;
  breakEvenSalesPriceEurSqm: DecimalString | null;
  subsidyAdjustedBreakEvenRentEurSqm: DecimalString | null;
  subsidyAdjustedProfitPct: DecimalString | null;
  subsidyAdjustedIrrPct: DecimalString | null;
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
