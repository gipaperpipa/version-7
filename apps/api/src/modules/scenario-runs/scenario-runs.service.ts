import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, NotFoundException, Scope, UnprocessableEntityException } from "@nestjs/common";
import { Queue } from "bullmq";
import { ScenarioRunStatus } from "@prisma/client";
import type { FinancialResultDto, ScenarioRunDto } from "../../generated-contracts/feasibility";
import { toApiDate, toApiDecimal, toApiJson, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ScenarioInputBuilderService } from "../scenarios/scenario-input-builder.service";
import { ScenarioReadinessService } from "../scenarios/scenario-readiness.service";
import {
  decodeExplanation,
  decodeReadinessIssues,
  decodeRecord,
  decodeRunWarnings,
  decodeStringArray,
} from "./scenario-run-json";
import { scenarioRunWithResultArgs, type ScenarioRunFinancialResult, type ScenarioRunWithResult } from "./scenario-run.types";

@Injectable({ scope: Scope.REQUEST })
export class ScenarioRunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly scenarioReadinessService: ScenarioReadinessService,
    private readonly scenarioInputBuilderService: ScenarioInputBuilderService,
    @InjectQueue("scenario-runs") private readonly scenarioRunsQueue: Queue,
  ) {}

  async enqueue(scenarioId: string): Promise<ScenarioRunDto> {
    const scenario = await this.scenarioReadinessService.loadScenarioForValidation(scenarioId);
    const readiness = this.scenarioReadinessService.evaluateLoadedScenario(scenario);

    if (!readiness.readiness.canRun) {
      throw new UnprocessableEntityException(readiness.readiness);
    }

    const run = await this.prisma.scenarioRun.create({
      data: {
        organizationId: this.requestContext.organizationId,
        scenarioId: scenario.id,
        triggeredById: this.requestContext.userId,
        status: ScenarioRunStatus.QUEUED,
        readinessStatus: readiness.readiness.status,
        inputSnapshot: toPrismaJson(this.scenarioInputBuilderService.buildSnapshot(scenario)),
        readinessIssuesJson: toPrismaJson(readiness.readiness.issues),
        warningsJson: toPrismaJson(readiness.readiness.issues.filter((item) => item.severity === "WARNING")),
        missingDataFlagsJson: toPrismaJson([]),
        confidenceReasonsJson: toPrismaJson(readiness.confidenceReasons),
        inputConfidencePct: readiness.inputConfidencePct,
      },
    });

    const job = await this.scenarioRunsQueue.add("run-feasibility-v0", { scenarioRunId: run.id });

    await this.prisma.scenarioRun.update({
      where: { id: run.id },
      data: { queueJobId: String(job.id) },
    });

    return this.getById(run.id);
  }

  async getById(runId: string): Promise<ScenarioRunDto> {
    const run = await this.prisma.scenarioRun.findFirst({
      ...scenarioRunWithResultArgs,
      where: {
        id: runId,
        organizationId: this.requestContext.organizationId,
      },
    });

    if (!run) {
      throw new NotFoundException("Scenario run not found");
    }

    return this.mapRun(run);
  }

  private mapRun(run: ScenarioRunWithResult): ScenarioRunDto {
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
      financialResult: run.financialResult ? this.mapFinancialResult(run.financialResult, run) : null,
      createdAt: toApiDate(run.createdAt)!,
      updatedAt: toApiDate(run.updatedAt)!,
    };
  }

  private mapFinancialResult(result: ScenarioRunFinancialResult, run: ScenarioRunWithResult): FinancialResultDto {
    const outputsJson = decodeRecord(toApiJson(result.outputsJson));

    return {
      id: result.id,
      scenarioRunId: result.scenarioRunId,
      buildableFootprintSqm: toApiDecimal(result.buildableFootprintSqm),
      buildableBgfSqm: toApiDecimal(result.buildableBgfSqm),
      effectiveFloors: result.effectiveFloors,
      estimatedUnitCount: result.estimatedUnitCount,
      requiredParkingSpaces: result.requiredParkingSpaces,
      hardCost: toApiDecimal(result.hardCost),
      softCost: toApiDecimal(result.softCost),
      parkingCost: toApiDecimal(result.parkingCost),
      totalDevelopmentCost: toApiDecimal(result.totalDevelopmentCost),
      freeFinancingAmount: toApiDecimal(result.freeFinancingAmount),
      stateSubsidyAmount: toApiDecimal(result.stateSubsidyAmount),
      kfwAmount: toApiDecimal(result.kfwAmount),
      grantAmount: toApiDecimal(result.grantAmount),
      equityAmount: toApiDecimal(result.equityAmount),
      requiredEquity: toApiDecimal(result.requiredEquity),
      breakEvenRentEurSqm: toApiDecimal(result.breakEvenRentEurSqm),
      breakEvenSalesPriceEurSqm: toApiDecimal(result.breakEvenSalesPriceEurSqm),
      subsidyAdjustedBreakEvenRentEurSqm: toApiDecimal(result.subsidyAdjustedBreakEvenRentEurSqm),
      subsidyAdjustedProfitPct: toApiDecimal(result.subsidyAdjustedProfitPct),
      subsidyAdjustedIrrPct: toApiDecimal(result.subsidyAdjustedIrrPct),
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
}
