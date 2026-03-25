import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { ScenarioRunStatus, ScenarioStatus } from "@prisma/client";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FeasibilityEngineV0Service } from "../finance/feasibility-engine-v0.service";
import { ScenarioInputBuilderService } from "../scenarios/scenario-input-builder.service";
import { ScenarioReadinessService } from "../scenarios/scenario-readiness.service";

@Injectable()
@Processor("scenario-runs")
export class ScenarioRunsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feasibilityEngineV0Service: FeasibilityEngineV0Service,
    private readonly scenarioReadinessService: ScenarioReadinessService,
    private readonly scenarioInputBuilderService: ScenarioInputBuilderService,
  ) {
    super();
  }

  async process(job: Job<{ scenarioRunId: string }>) {
    const run = await this.prisma.scenarioRun.findUniqueOrThrow({
      where: { id: job.data.scenarioRunId },
    });

    await this.prisma.scenarioRun.update({
      where: { id: run.id },
      data: {
        status: ScenarioRunStatus.RUNNING,
        startedAt: new Date(),
        engineVersion: this.feasibilityEngineV0Service.heuristicVersion,
      },
    });

    try {
      const scenario = await this.scenarioReadinessService.loadScenarioForValidation(run.scenarioId);
      const result = this.feasibilityEngineV0Service.execute(
        this.scenarioInputBuilderService.buildFeasibilityInput(scenario),
      );

      await this.prisma.$transaction([
        this.prisma.financialResult.upsert({
          where: { scenarioRunId: run.id },
          update: {
            buildableFootprintSqm: result.outputs.buildableFootprintSqm,
            buildableBgfSqm: result.outputs.buildableBgfSqm,
            effectiveFloors: result.outputs.effectiveFloors,
            estimatedUnitCount: result.outputs.estimatedUnitCount,
            requiredParkingSpaces: result.outputs.requiredParkingSpaces,
            hardCost: result.outputs.hardCost,
            softCost: result.outputs.softCost,
            parkingCost: result.outputs.parkingCost,
            totalDevelopmentCost: result.outputs.totalDevelopmentCost,
            freeFinancingAmount: result.outputs.freeFinancingAmount,
            stateSubsidyAmount: result.outputs.stateSubsidyAmount,
            kfwAmount: result.outputs.kfwAmount,
            grantAmount: result.outputs.grantAmount,
            equityAmount: result.outputs.equityAmount,
            requiredEquity: result.outputs.requiredEquity,
            breakEvenRentEurSqm: result.outputs.breakEvenRentEurSqm,
            breakEvenSalesPriceEurSqm: result.outputs.breakEvenSalesPriceEurSqm,
            subsidyAdjustedBreakEvenRentEurSqm: result.outputs.subsidyAdjustedBreakEvenRentEurSqm,
            subsidyAdjustedProfitPct: result.outputs.subsidyAdjustedProfitPct,
            subsidyAdjustedIrrPct: result.outputs.subsidyAdjustedIrrPct,
            warningsJson: result.warnings,
            missingDataFlagsJson: result.missingDataFlags,
            confidenceReasonsJson: result.confidence.reasons,
            outputConfidencePct: result.confidence.outputConfidencePct,
            outputsJson: {
              heuristicVersion: result.heuristicVersion,
              objectiveValue: result.outputs.objectiveValue,
              explanation: result.explanation,
            },
          },
          create: {
            scenarioRunId: run.id,
            buildableFootprintSqm: result.outputs.buildableFootprintSqm,
            buildableBgfSqm: result.outputs.buildableBgfSqm,
            effectiveFloors: result.outputs.effectiveFloors,
            estimatedUnitCount: result.outputs.estimatedUnitCount,
            requiredParkingSpaces: result.outputs.requiredParkingSpaces,
            hardCost: result.outputs.hardCost,
            softCost: result.outputs.softCost,
            parkingCost: result.outputs.parkingCost,
            totalDevelopmentCost: result.outputs.totalDevelopmentCost,
            freeFinancingAmount: result.outputs.freeFinancingAmount,
            stateSubsidyAmount: result.outputs.stateSubsidyAmount,
            kfwAmount: result.outputs.kfwAmount,
            grantAmount: result.outputs.grantAmount,
            equityAmount: result.outputs.equityAmount,
            requiredEquity: result.outputs.requiredEquity,
            breakEvenRentEurSqm: result.outputs.breakEvenRentEurSqm,
            breakEvenSalesPriceEurSqm: result.outputs.breakEvenSalesPriceEurSqm,
            subsidyAdjustedBreakEvenRentEurSqm: result.outputs.subsidyAdjustedBreakEvenRentEurSqm,
            subsidyAdjustedProfitPct: result.outputs.subsidyAdjustedProfitPct,
            subsidyAdjustedIrrPct: result.outputs.subsidyAdjustedIrrPct,
            warningsJson: result.warnings,
            missingDataFlagsJson: result.missingDataFlags,
            confidenceReasonsJson: result.confidence.reasons,
            outputConfidencePct: result.confidence.outputConfidencePct,
            outputsJson: {
              heuristicVersion: result.heuristicVersion,
              objectiveValue: result.outputs.objectiveValue,
              explanation: result.explanation,
            },
          },
        }),
        this.prisma.scenarioRun.update({
          where: { id: run.id },
          data: {
            status: ScenarioRunStatus.SUCCEEDED,
            finishedAt: new Date(),
            warningsJson: result.warnings,
            missingDataFlagsJson: result.missingDataFlags,
            confidenceReasonsJson: result.confidence.reasons,
            outputConfidencePct: result.confidence.outputConfidencePct,
          },
        }),
        this.prisma.scenario.update({
          where: { id: run.scenarioId },
          data: {
            latestRunAt: new Date(),
            status: ScenarioStatus.COMPLETED,
          },
        }),
      ]);
    } catch (error) {
      await this.prisma.scenarioRun.update({
        where: { id: run.id },
        data: {
          status: ScenarioRunStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: error instanceof Error ? error.message : "Unknown execution error",
        },
      });
      throw error;
    }
  }
}
