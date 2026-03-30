import type { FinancialResultDto, ScenarioRunDto } from "../../generated-contracts/feasibility";
import { toApiDate, toApiDecimal, toApiJson } from "../../common/prisma/api-mappers";
import {
  decodeExplanation,
  decodeReadinessIssues,
  decodeRecord,
  decodeRunWarnings,
  decodeStringArray,
} from "./scenario-run-json";
import type { ScenarioRunFinancialResult, ScenarioRunWithResult } from "./scenario-run.types";
import { decodeEffectiveScenarioAssumptions } from "../scenarios/scenario-assumptions";

function toApiNumberString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function mapScenarioRunDto(run: ScenarioRunWithResult): ScenarioRunDto {
  return {
    id: run.id,
    organizationId: run.organizationId,
    scenarioId: run.scenarioId,
    triggeredById: run.triggeredById,
    status: run.status,
    readinessStatus: run.readinessStatus,
    readinessIssues: decodeReadinessIssues(toApiJson(run.readinessIssuesJson)),
    queueJobId: run.queueJobId,
    engineVersion: run.engineVersion,
    inputSnapshot: decodeRecord(toApiJson(run.inputSnapshot)),
    errorMessage: run.errorMessage,
    requestedAt: toApiDate(run.requestedAt)!,
    startedAt: toApiDate(run.startedAt),
    finishedAt: toApiDate(run.finishedAt),
    warnings: decodeRunWarnings(toApiJson(run.warningsJson)),
    missingDataFlags: decodeStringArray(toApiJson(run.missingDataFlagsJson)),
    confidence: {
      inputConfidencePct: run.inputConfidencePct,
      outputConfidencePct: run.outputConfidencePct,
      reasons: decodeStringArray(toApiJson(run.confidenceReasonsJson)),
    },
    financialResult: run.financialResult ? mapScenarioRunFinancialResult(run.financialResult, run) : null,
    createdAt: toApiDate(run.createdAt)!,
    updatedAt: toApiDate(run.updatedAt)!,
  };
}

export function mapScenarioRunFinancialResult(
  result: ScenarioRunFinancialResult,
  run: ScenarioRunWithResult,
): FinancialResultDto {
  const outputsJson = decodeRecord(toApiJson(result.outputsJson));

  return {
    id: result.id,
    scenarioRunId: result.scenarioRunId,
    buildableFootprintSqm: toApiDecimal(result.buildableFootprintSqm),
    buildableBgfSqm: toApiDecimal(result.buildableBgfSqm),
    planningAdjustedBgfSqm: toApiNumberString(outputsJson?.planningAdjustedBgfSqm),
    effectiveFloors: result.effectiveFloors,
    estimatedUnitCount: result.estimatedUnitCount,
    requiredParkingSpaces: result.requiredParkingSpaces,
    acquisitionCost: toApiNumberString(outputsJson?.acquisitionCost),
    hardCost: toApiDecimal(result.hardCost),
    softCost: toApiDecimal(result.softCost),
    parkingCost: toApiDecimal(result.parkingCost),
    contingencyCost: toApiNumberString(outputsJson?.contingencyCost),
    developerFee: toApiNumberString(outputsJson?.developerFee),
    totalDevelopmentCost: toApiDecimal(result.totalDevelopmentCost),
    totalCapitalizedUses: toApiNumberString(outputsJson?.totalCapitalizedUses),
    freeFinancingAmount: toApiDecimal(result.freeFinancingAmount),
    stateSubsidyAmount: toApiDecimal(result.stateSubsidyAmount),
    kfwAmount: toApiDecimal(result.kfwAmount),
    grantAmount: toApiDecimal(result.grantAmount),
    equityAmount: toApiDecimal(result.equityAmount),
    requiredEquity: toApiDecimal(result.requiredEquity),
    grossResidentialRevenueAnnual: toApiNumberString(outputsJson?.grossResidentialRevenueAnnual),
    vacancyAdjustedRevenueAnnual: toApiNumberString(outputsJson?.vacancyAdjustedRevenueAnnual),
    operatingCostAnnual: toApiNumberString(outputsJson?.operatingCostAnnual),
    parkingRevenueAnnual: toApiNumberString(outputsJson?.parkingRevenueAnnual),
    parkingSalesRevenue: toApiNumberString(outputsJson?.parkingSalesRevenue),
    netOperatingIncomeAnnual: toApiNumberString(outputsJson?.netOperatingIncomeAnnual),
    grossSalesRevenue: toApiNumberString(outputsJson?.grossSalesRevenue),
    netSalesRevenue: toApiNumberString(outputsJson?.netSalesRevenue),
    breakEvenRentEurSqm: toApiDecimal(result.breakEvenRentEurSqm),
    breakEvenSalesPriceEurSqm: toApiDecimal(result.breakEvenSalesPriceEurSqm),
    subsidyAdjustedBreakEvenRentEurSqm: toApiDecimal(result.subsidyAdjustedBreakEvenRentEurSqm),
    subsidyAdjustedProfitPct: toApiDecimal(result.subsidyAdjustedProfitPct),
    subsidyAdjustedIrrPct: toApiDecimal(result.subsidyAdjustedIrrPct),
    objectiveValue: toApiNumberString(outputsJson?.objectiveValue),
    assumptions: decodeEffectiveScenarioAssumptions(outputsJson?.assumptions),
    explanation: decodeExplanation(outputsJson?.explanation),
    outputsJson,
    warnings: decodeRunWarnings(toApiJson(result.warningsJson)),
    missingDataFlags: decodeStringArray(toApiJson(result.missingDataFlagsJson)),
    confidence: {
      inputConfidencePct: run.inputConfidencePct,
      outputConfidencePct: result.outputConfidencePct,
      reasons: decodeStringArray(toApiJson(result.confidenceReasonsJson)),
    },
    createdAt: toApiDate(result.createdAt)!,
    updatedAt: toApiDate(result.updatedAt)!,
  };
}
