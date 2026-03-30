import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import type { Job } from "bullmq";
import { ScenarioRunStatus, ScenarioStatus } from "@prisma/client";
import { toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { FeasibilityEngineV0Service } from "../finance/feasibility-engine-v0.service";
import { ScenarioInputBuilderService } from "../scenarios/scenario-input-builder.service";
import { ScenarioValidationService } from "../scenarios/scenario-validation.service";

@Injectable()
@Processor("scenario-runs")
export class ScenarioRunsProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly feasibilityEngineV0Service: FeasibilityEngineV0Service,
    private readonly scenarioValidationService: ScenarioValidationService,
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
      const scenario = await this.scenarioValidationService.loadScenarioForOrganization(
        run.scenarioId,
        run.organizationId,
      );
      const feasibilityInput = this.scenarioInputBuilderService.buildFeasibilityInput(scenario);
      const result = this.feasibilityEngineV0Service.execute(feasibilityInput);
      const outputEnvelope = {
        heuristicVersion: result.heuristicVersion,
        objectiveValue: result.outputs.objectiveValue,
        assumptions: result.confidence.inputConfidencePct != null ? feasibilityInput.assumptions : null,
        planningAdjustedBgfSqm: result.outputs.planningAdjustedBgfSqm,
        acquisitionCost: result.outputs.acquisitionCost,
        contingencyCost: result.outputs.contingencyCost,
        developerFee: result.outputs.developerFee,
        totalCapitalizedUses: result.outputs.totalCapitalizedUses,
        grossResidentialRevenueAnnual: result.outputs.grossResidentialRevenueAnnual,
        vacancyAdjustedRevenueAnnual: result.outputs.vacancyAdjustedRevenueAnnual,
        operatingCostAnnual: result.outputs.operatingCostAnnual,
        parkingRevenueAnnual: result.outputs.parkingRevenueAnnual,
        parkingSalesRevenue: result.outputs.parkingSalesRevenue,
        netOperatingIncomeAnnual: result.outputs.netOperatingIncomeAnnual,
        grossSalesRevenue: result.outputs.grossSalesRevenue,
        netSalesRevenue: result.outputs.netSalesRevenue,
        explanation: result.explanation,
      };

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
            warningsJson: toPrismaJson(result.warnings),
            missingDataFlagsJson: toPrismaJson(result.missingDataFlags),
            confidenceReasonsJson: toPrismaJson(result.confidence.reasons),
            outputConfidencePct: result.confidence.outputConfidencePct,
            outputsJson: toPrismaJson(outputEnvelope),
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
            warningsJson: toPrismaJson(result.warnings),
            missingDataFlagsJson: toPrismaJson(result.missingDataFlags),
            confidenceReasonsJson: toPrismaJson(result.confidence.reasons),
            outputConfidencePct: result.confidence.outputConfidencePct,
            outputsJson: toPrismaJson(outputEnvelope),
          },
        }),
        this.prisma.scenarioRun.update({
          where: { id: run.id },
          data: {
            status: ScenarioRunStatus.SUCCEEDED,
            finishedAt: new Date(),
            warningsJson: toPrismaJson(result.warnings),
            missingDataFlagsJson: toPrismaJson(result.missingDataFlags),
            confidenceReasonsJson: toPrismaJson(result.confidence.reasons),
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
      console.error(`[scenario-runs] Run ${run.id} failed.`);
      console.error(error);
      throw error;
    }
  }
}
