import { Injectable, NotFoundException, Scope, UnprocessableEntityException } from "@nestjs/common";
import type {
  CreateScenarioRequestDto,
  ListScenariosResponseDto,
  ScenarioComparisonResponseDto,
  ScenarioDto,
  UpdateScenarioRequestDto,
  UpsertScenarioFundingStackRequestDto,
} from "../../generated-contracts/scenarios";
import type { OptimizationTarget, ScenarioReadinessDto, ScenarioRunDto } from "../../generated-contracts";
import { toApiDate, toApiDecimal, toApiJson, toPrismaDecimal, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { mapScenarioRunDto } from "../scenario-runs/scenario-run.mapper";
import { scenarioRunWithResultArgs } from "../scenario-runs/scenario-run.types";
import { ScenarioValidationService } from "./scenario-validation.service";
import {
  extractScenarioAssumptionSet,
  withScenarioAssumptionSet,
} from "./scenario-assumptions";
import { scenarioWithFundingArgs, type ScenarioWithFunding } from "./scenario.types";

@Injectable({ scope: Scope.REQUEST })
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly scenarioValidationService: ScenarioValidationService,
  ) {}

  async list(params: { page: number; pageSize: number }): Promise<ListScenariosResponseDto> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));

    const [items, total] = await this.prisma.$transaction([
      this.prisma.scenario.findMany({
        ...scenarioWithFundingArgs,
        where: { organizationId: this.requestContext.organizationId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.scenario.count({
        where: { organizationId: this.requestContext.organizationId },
      }),
    ]);

    return {
      items: items.map((item) => this.mapScenario(item)),
      total,
      page,
      pageSize,
    };
  }

  async create(dto: CreateScenarioRequestDto): Promise<ScenarioDto> {
    const created = await this.prisma.scenario.create({
      data: {
        organizationId: this.requestContext.organizationId,
        createdById: this.requestContext.userId,
        parcelId: dto.parcelId ?? null,
        parcelGroupId: dto.parcelGroupId ?? null,
        name: dto.name,
        description: dto.description ?? null,
        strategyType: dto.strategyType,
        acquisitionType: dto.acquisitionType,
        optimizationTarget: dto.optimizationTarget,
        strategyMixJson: toPrismaJson(dto.strategyType === "MIXED_STRATEGY" ? dto.strategyMixJson ?? null : null),
        avgUnitSizeSqm: toPrismaDecimal(dto.avgUnitSizeSqm),
        targetMarketRentEurSqm: toPrismaDecimal(dto.targetMarketRentEurSqm),
        targetSubsidizedRentEurSqm: toPrismaDecimal(dto.targetSubsidizedRentEurSqm),
        targetSalesPriceEurSqm: toPrismaDecimal(dto.targetSalesPriceEurSqm),
        subsidizedSharePct: toPrismaDecimal(dto.subsidizedSharePct),
        hardCostPerBgfSqm: toPrismaDecimal(dto.hardCostPerBgfSqm),
        softCostPct: toPrismaDecimal(dto.softCostPct),
        parkingCostPerSpace: toPrismaDecimal(dto.parkingCostPerSpace),
        landCost: toPrismaDecimal(dto.landCost),
        equityTargetPct: toPrismaDecimal(dto.equityTargetPct),
        inputsJson: toPrismaJson(withScenarioAssumptionSet(dto.inputsJson ?? null, dto.assumptionSet) ?? null),
      },
    });

    return this.getById(created.id);
  }

  async getById(scenarioId: string): Promise<ScenarioDto> {
    const scenario = await this.prisma.scenario.findFirst({
      ...scenarioWithFundingArgs,
      where: {
        id: scenarioId,
        organizationId: this.requestContext.organizationId,
      },
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found");
    }

    return this.mapScenario(scenario);
  }

  async update(scenarioId: string, dto: UpdateScenarioRequestDto): Promise<ScenarioDto> {
    const existing = await this.assertScenarioAccess(scenarioId);

    await this.prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        parcelId: dto.parcelId === undefined ? undefined : dto.parcelId,
        parcelGroupId: dto.parcelGroupId === undefined ? undefined : dto.parcelGroupId,
        name: dto.name,
        description: dto.description === undefined ? undefined : dto.description,
        strategyType: dto.strategyType,
        acquisitionType: dto.acquisitionType,
        optimizationTarget: dto.optimizationTarget,
        strategyMixJson:
          dto.strategyType === undefined
            ? toPrismaJson(dto.strategyMixJson)
            : dto.strategyType === "MIXED_STRATEGY"
              ? toPrismaJson(dto.strategyMixJson ?? null)
              : toPrismaJson(null),
        avgUnitSizeSqm: dto.avgUnitSizeSqm === undefined ? undefined : toPrismaDecimal(dto.avgUnitSizeSqm),
        targetMarketRentEurSqm: dto.targetMarketRentEurSqm === undefined ? undefined : toPrismaDecimal(dto.targetMarketRentEurSqm),
        targetSubsidizedRentEurSqm: dto.targetSubsidizedRentEurSqm === undefined ? undefined : toPrismaDecimal(dto.targetSubsidizedRentEurSqm),
        targetSalesPriceEurSqm: dto.targetSalesPriceEurSqm === undefined ? undefined : toPrismaDecimal(dto.targetSalesPriceEurSqm),
        subsidizedSharePct: dto.subsidizedSharePct === undefined ? undefined : toPrismaDecimal(dto.subsidizedSharePct),
        hardCostPerBgfSqm: dto.hardCostPerBgfSqm === undefined ? undefined : toPrismaDecimal(dto.hardCostPerBgfSqm),
        softCostPct: dto.softCostPct === undefined ? undefined : toPrismaDecimal(dto.softCostPct),
        parkingCostPerSpace: dto.parkingCostPerSpace === undefined ? undefined : toPrismaDecimal(dto.parkingCostPerSpace),
        landCost: dto.landCost === undefined ? undefined : toPrismaDecimal(dto.landCost),
        equityTargetPct: dto.equityTargetPct === undefined ? undefined : toPrismaDecimal(dto.equityTargetPct),
        inputsJson: toPrismaJson(withScenarioAssumptionSet(
          dto.inputsJson === undefined ? toApiJson(existing.inputsJson) : dto.inputsJson,
          dto.assumptionSet,
        )),
        status: dto.status,
      },
    });

    return this.getById(scenarioId);
  }

  async upsertFundingStack(scenarioId: string, dto: UpsertScenarioFundingStackRequestDto): Promise<ScenarioDto> {
    await this.assertScenarioAccess(scenarioId);

    await this.prisma.$transaction([
      this.prisma.scenarioFundingVariant.deleteMany({
        where: { scenarioId },
      }),
      this.prisma.scenarioFundingVariant.createMany({
        data: dto.items.map((item: UpsertScenarioFundingStackRequestDto["items"][number]) => ({
          scenarioId,
          fundingProgramVariantId: item.fundingProgramVariantId ?? null,
          label: item.label,
          financingSourceType: item.financingSourceType,
          stackOrder: item.stackOrder,
          isEnabled: item.isEnabled ?? true,
          amountOverride: toPrismaDecimal(item.amountOverride),
          sharePctOverride: toPrismaDecimal(item.sharePctOverride),
          interestRateOverridePct: toPrismaDecimal(item.interestRateOverridePct),
          termMonthsOverride: item.termMonthsOverride ?? null,
          notes: item.notes ?? null,
        })),
      }),
    ]);

    return this.getById(scenarioId);
  }

  async compare(params: {
    scenarioIds: string[];
    rankingTarget?: OptimizationTarget;
  }): Promise<ScenarioComparisonResponseDto> {
    const scenarioIds = Array.from(new Set(params.scenarioIds.filter(Boolean)));
    if (scenarioIds.length < 2) {
      throw new UnprocessableEntityException("Select at least two scenarios to compare.");
    }

    const scenarios = await Promise.all(scenarioIds.map((scenarioId) => this.getById(scenarioId)));
    const mixedOptimizationTargets = new Set(scenarios.map((scenario) => scenario.optimizationTarget)).size > 1;
    const rankingTarget = params.rankingTarget ?? scenarios[0].optimizationTarget;
    const objectiveDirection = this.getObjectiveDirection(rankingTarget);

    const parcelIds = Array.from(new Set(scenarios.map((scenario) => scenario.parcelId).filter((value): value is string => Boolean(value))));
    const parcels = parcelIds.length
      ? await this.prisma.parcel.findMany({
          where: {
            organizationId: this.requestContext.organizationId,
            id: { in: parcelIds },
          },
          select: {
            id: true,
            name: true,
            cadastralId: true,
            municipalityName: true,
            landAreaSqm: true,
            confidenceScore: true,
            sourceType: true,
          },
        })
      : [];
    const parcelById = new Map(parcels.map((parcel) => [parcel.id, parcel]));

    const readinessPairs = await Promise.all(
      scenarioIds.map(async (scenarioId) => {
        const loaded = await this.scenarioValidationService.loadScenarioForOrganization(
          scenarioId,
          this.requestContext.organizationId,
        );
        return [scenarioId, this.scenarioValidationService.evaluateLoadedScenario(loaded).readiness] as const;
      }),
    );
    const readinessByScenario = new Map<string, ScenarioReadinessDto>(readinessPairs);

    const runs = await this.prisma.scenarioRun.findMany({
      ...scenarioRunWithResultArgs,
      where: {
        organizationId: this.requestContext.organizationId,
        scenarioId: { in: scenarioIds },
      },
      orderBy: [{ scenarioId: "asc" }, { requestedAt: "desc" }],
    });
    const latestRunByScenario = new Map<string, ScenarioRunDto>();
    for (const run of runs) {
      if (!latestRunByScenario.has(run.scenarioId)) {
        latestRunByScenario.set(run.scenarioId, mapScenarioRunDto(run));
      }
    }

    const entries = scenarios.map((scenario) => {
      const latestRun = latestRunByScenario.get(scenario.id) ?? null;
      const latestExplanation = latestRun?.financialResult?.explanation ?? null;
      const readiness = readinessByScenario.get(scenario.id)!;
      const objectiveValue = this.getObjectiveValue(latestRun, rankingTarget);
      const blockerCount = readiness.issues.filter((issue) => issue.severity === "BLOCKING").length;
      const warningCount = latestRun
        ? new Set([
            ...readiness.issues.filter((issue) => issue.severity === "WARNING").map((issue) => issue.message),
            ...latestRun.warnings.map((warning) => warning.message),
          ]).size
        : readiness.issues.filter((issue) => issue.severity === "WARNING").length;

      return {
        scenario,
        parcel: scenario.parcelId ? parcelById.get(scenario.parcelId) ?? null : null,
        readiness,
        latestRun,
        rank: null as number | null,
        objectiveValue,
        deltaToLeader: null as string | null,
        warningCount,
        blockerCount,
        missingDataCount: latestRun?.missingDataFlags.length ?? 0,
        topDrivers: latestExplanation?.dominantDrivers?.slice(0, 3) ?? [],
        assumptionSummary: this.getAssumptionSummary(scenario),
        recommendation: this.getComparisonRecommendation(readiness, latestRun),
      };
    });

    const ranked = entries
      .filter((entry) => entry.objectiveValue !== null)
      .sort((left, right) => this.compareObjectiveValues(left.objectiveValue!, right.objectiveValue!, objectiveDirection));
    const leader = ranked[0] ?? null;
    const leaderValue = leader?.objectiveValue ? Number(leader.objectiveValue) : null;

    ranked.forEach((entry, index) => {
      entry.rank = index + 1;
      const entryValue = entry.objectiveValue ? Number(entry.objectiveValue) : null;
      if (leaderValue == null || entryValue == null || index === 0) {
        entry.deltaToLeader = index === 0 ? "0" : null;
        return;
      }
      const delta = objectiveDirection === "min" ? entryValue - leaderValue : leaderValue - entryValue;
      entry.deltaToLeader = this.formatMetricValue(delta);
    });

    return {
      rankingTarget,
      objectiveDirection,
      mixedOptimizationTargets,
      leaderScenarioId: leader?.scenario.id ?? null,
      entries: [
        ...ranked,
        ...entries.filter((entry) => entry.objectiveValue === null),
      ].map((entry) => ({
        scenario: entry.scenario,
        parcel: entry.parcel
          ? {
              id: entry.parcel.id,
              name: entry.parcel.name,
              cadastralId: entry.parcel.cadastralId,
              municipalityName: entry.parcel.municipalityName,
              landAreaSqm: toApiDecimal(entry.parcel.landAreaSqm),
              confidenceScore: entry.parcel.confidenceScore,
              sourceType: entry.parcel.sourceType,
            }
          : null,
        readiness: entry.readiness,
        latestRun: entry.latestRun,
        rank: entry.rank,
        objectiveValue: entry.objectiveValue,
        deltaToLeader: entry.deltaToLeader,
        warningCount: entry.warningCount,
        blockerCount: entry.blockerCount,
        missingDataCount: entry.missingDataCount,
        topDrivers: entry.topDrivers,
        assumptionSummary: entry.assumptionSummary,
        recommendation: entry.recommendation,
      })),
    };
  }

  private async assertScenarioAccess(scenarioId: string) {
    const scenario = await this.prisma.scenario.findFirst({
      where: {
        id: scenarioId,
        organizationId: this.requestContext.organizationId,
      },
      select: { id: true, inputsJson: true },
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found");
    }

    return scenario;
  }

  private mapScenario(item: ScenarioWithFunding): ScenarioDto {
    return {
      id: item.id,
      organizationId: item.organizationId,
      createdById: item.createdById,
      parcelId: item.parcelId,
      parcelGroupId: item.parcelGroupId,
      name: item.name,
      description: item.description,
      status: item.status,
      strategyType: item.strategyType,
      acquisitionType: item.acquisitionType,
      optimizationTarget: item.optimizationTarget,
      strategyMixJson: toApiJson(item.strategyMixJson),
      avgUnitSizeSqm: toApiDecimal(item.avgUnitSizeSqm),
      targetMarketRentEurSqm: toApiDecimal(item.targetMarketRentEurSqm),
      targetSubsidizedRentEurSqm: toApiDecimal(item.targetSubsidizedRentEurSqm),
      targetSalesPriceEurSqm: toApiDecimal(item.targetSalesPriceEurSqm),
      subsidizedSharePct: toApiDecimal(item.subsidizedSharePct),
      hardCostPerBgfSqm: toApiDecimal(item.hardCostPerBgfSqm),
      softCostPct: toApiDecimal(item.softCostPct),
      parkingCostPerSpace: toApiDecimal(item.parkingCostPerSpace),
      landCost: toApiDecimal(item.landCost),
      equityTargetPct: toApiDecimal(item.equityTargetPct),
      assumptionSet: extractScenarioAssumptionSet(toApiJson(item.inputsJson)),
      inputsJson: toApiJson(item.inputsJson),
      latestRunAt: toApiDate(item.latestRunAt),
      fundingVariants: item.fundingVariants.map((variant) => ({
        id: variant.id,
        scenarioId: variant.scenarioId,
        fundingProgramVariantId: variant.fundingProgramVariantId,
        label: variant.label,
        financingSourceType: variant.financingSourceType,
        stackOrder: variant.stackOrder,
        isEnabled: variant.isEnabled,
        amountOverride: toApiDecimal(variant.amountOverride),
        sharePctOverride: toApiDecimal(variant.sharePctOverride),
        interestRateOverridePct: toApiDecimal(variant.interestRateOverridePct),
        termMonthsOverride: variant.termMonthsOverride,
        notes: variant.notes,
      })),
      createdAt: toApiDate(item.createdAt)!,
      updatedAt: toApiDate(item.updatedAt)!,
    };
  }

  private getObjectiveDirection(target: OptimizationTarget): "min" | "max" {
    return target === "MAX_SUBSIDY_ADJUSTED_IRR" || target === "MAX_UNIT_COUNT" ? "max" : "min";
  }

  private getObjectiveValue(run: ScenarioRunDto | null, target: OptimizationTarget) {
    const result = run?.financialResult;
    if (!result) return null;

    switch (target) {
      case "MIN_BREAK_EVEN_RENT":
        return result.breakEvenRentEurSqm;
      case "MIN_BREAK_EVEN_SALES_PRICE":
        return result.breakEvenSalesPriceEurSqm;
      case "MIN_REQUIRED_EQUITY":
        return result.requiredEquity;
      case "MAX_SUBSIDY_ADJUSTED_IRR":
        return result.subsidyAdjustedIrrPct;
      case "MAX_UNIT_COUNT":
        return result.estimatedUnitCount != null ? String(result.estimatedUnitCount) : null;
      default:
        return result.objectiveValue;
    }
  }

  private compareObjectiveValues(left: string, right: string, direction: "min" | "max") {
    const leftValue = Number(left);
    const rightValue = Number(right);
    if (direction === "min") {
      return leftValue - rightValue;
    }
    return rightValue - leftValue;
  }

  private formatMetricValue(value: number) {
    if (!Number.isFinite(value)) return null;
    if (Number.isInteger(value)) return String(value);
    return value.toFixed(Math.abs(value) >= 100 ? 0 : 2).replace(/\.?0+$/, "");
  }

  private getAssumptionSummary(scenario: ScenarioDto) {
    const assumptionSet = scenario.assumptionSet;
    if (!assumptionSet) return "Baseline assumptions";
    const overrideCount = Object.values(assumptionSet.overrides).filter((value) => value !== null).length;
    return overrideCount
      ? `${assumptionSet.profileKey} profile + ${overrideCount} override${overrideCount === 1 ? "" : "s"}`
      : `${assumptionSet.profileKey} profile`;
  }

  private getComparisonRecommendation(readiness: ScenarioReadinessDto, latestRun: ScenarioRunDto | null) {
    if (!latestRun) {
      return readiness.canRun
        ? "Run the scenario once to unlock ranking and KPI deltas."
        : readiness.issues[0]?.message ?? "Resolve blockers before comparing this case.";
    }

    if (latestRun.status === "FAILED") {
      return latestRun.errorMessage ?? "Fix the failing run path before using this case in a decision set.";
    }

    if (latestRun.missingDataFlags.length) {
      return `Tighten ${latestRun.missingDataFlags.slice(0, 2).join(", ")} before relying on the ranking.`;
    }

    return latestRun.financialResult?.explanation?.nextActions?.[0]
      ?? "Use the leader ranking directionally, then test the weakest assumptions.";
  }
}
