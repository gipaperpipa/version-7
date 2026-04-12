import { ConflictException, Injectable, NotFoundException, Scope, UnprocessableEntityException } from "@nestjs/common";
import type {
  CreateScenarioRequestDto,
  ListScenarioAssumptionTemplatesResponseDto,
  ListScenariosResponseDto,
  ScenarioComparisonResponseDto,
  ScenarioDto,
  UpdateScenarioRequestDto,
  UpdateScenarioWorkspaceDefaultsRequestDto,
  UpsertScenarioFundingStackRequestDto,
} from "../../generated-contracts/scenarios";
import type { OptimizationTarget, ScenarioReadinessDto, ScenarioRunDto } from "../../generated-contracts";
import { toApiDate, toApiDecimal, toApiJson, toPrismaDecimal, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { ProjectsService } from "../projects/projects.service";
import { mapScenarioRunDto } from "../scenario-runs/scenario-run.mapper";
import { scenarioRunWithResultArgs } from "../scenario-runs/scenario-run.types";
import { ScenarioValidationService } from "./scenario-validation.service";
import {
  getScenarioAssumptionTemplateByKey,
  getScenarioAssumptionTemplates,
} from "./scenario-assumption-templates";
import {
  buildScenarioAssumptionSummary,
  extractScenarioAssumptionSet,
  withScenarioAssumptionSet,
} from "./scenario-assumptions";
import { scenarioForValidationArgs, type ScenarioForValidation } from "./scenario.types";

@Injectable({ scope: Scope.REQUEST })
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly scenarioValidationService: ScenarioValidationService,
    private readonly projectsService: ProjectsService,
  ) {}

  async list(params: { page: number; pageSize: number }): Promise<ListScenariosResponseDto> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));

    const [organization, items, total, familyRows] = await this.prisma.$transaction([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: this.requestContext.organizationId },
        select: { defaultScenarioTemplateKey: true },
      }),
      this.prisma.scenario.findMany({
        ...scenarioForValidationArgs,
        where: { organizationId: this.requestContext.organizationId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.scenario.count({
        where: { organizationId: this.requestContext.organizationId },
      }),
      this.prisma.scenario.findMany({
        where: { organizationId: this.requestContext.organizationId },
        select: {
          id: true,
          projectId: true,
          parcelId: true,
          parcelGroupId: true,
          strategyType: true,
          optimizationTarget: true,
          createdAt: true,
          governanceStatus: true,
          isCurrentBest: true,
        },
      }),
    ]);
    const latestRunIdByScenario = items.length
      ? await this.buildLatestRunIdMap(items.map((item) => item.id))
      : new Map<string, string>();
    const familyMetadata = this.buildFamilyMetadataMap(familyRows);

    return {
      items: items.map((item) => this.mapScenario(item, {
        workspaceDefaultTemplateKey: organization.defaultScenarioTemplateKey,
        familyMetadata,
        latestRunId: latestRunIdByScenario.get(item.id) ?? null,
        readinessSnapshot: this.toReadinessSnapshot(this.scenarioValidationService.evaluateLoadedScenario(item).readiness),
      })),
      total,
      page,
      pageSize,
    };
  }

  async listAssumptionTemplates(): Promise<ListScenarioAssumptionTemplatesResponseDto> {
    const organization = await this.prisma.organization.findUniqueOrThrow({
      where: { id: this.requestContext.organizationId },
      select: { defaultScenarioTemplateKey: true },
    });
    const items = getScenarioAssumptionTemplates(organization.defaultScenarioTemplateKey);
    const defaultTemplate = items.find((item) => item.key === organization.defaultScenarioTemplateKey) ?? null;

    return {
      items,
      workspaceDefaultTemplateKey: organization.defaultScenarioTemplateKey,
      workspaceDefaultTemplateName: defaultTemplate?.name ?? null,
    };
  }

  async updateWorkspaceDefaults(dto: UpdateScenarioWorkspaceDefaultsRequestDto): Promise<ListScenarioAssumptionTemplatesResponseDto> {
    const nextTemplateKey = dto.defaultTemplateKey ?? null;
    if (nextTemplateKey && !getScenarioAssumptionTemplateByKey(nextTemplateKey)) {
      throw new UnprocessableEntityException("Unknown scenario assumption template key.");
    }

    await this.prisma.organization.update({
      where: { id: this.requestContext.organizationId },
      data: { defaultScenarioTemplateKey: nextTemplateKey },
    });

    return this.listAssumptionTemplates();
  }

  async create(dto: CreateScenarioRequestDto): Promise<ScenarioDto> {
    const projectContext = await this.resolveScenarioProjectContext(
      dto.projectId ?? null,
      dto.parcelId ?? null,
      dto.parcelGroupId ?? null,
      true,
    );
    const familyDefinition = this.buildScenarioFamilyDefinition(
      projectContext.projectId,
      projectContext.parcelId,
      projectContext.parcelGroupId,
      dto.strategyType,
      dto.optimizationTarget,
    );
    const [organization, familySiblings] = await Promise.all([
      this.prisma.organization.findUniqueOrThrow({
        where: { id: this.requestContext.organizationId },
        select: { defaultScenarioTemplateKey: true },
      }),
      this.findFamilyScenarios(familyDefinition),
    ]);
    const nextFamilyVersion = familySiblings.length + 1;
    const requestedGovernanceStatus = dto.governanceStatus ?? "DRAFT";
    const governanceStatus = dto.isCurrentBest ? "ACTIVE_CANDIDATE" : requestedGovernanceStatus;
    const shouldMarkCurrentBest = governanceStatus === "ACTIVE_CANDIDATE"
      && (dto.isCurrentBest === true || !familySiblings.some((item) => item.isCurrentBest));
    const assumptionSet = dto.assumptionSet ?? null;
    const inputsJson = withScenarioAssumptionSet(dto.inputsJson ?? null, assumptionSet) ?? null;

    const created = await this.prisma.scenario.create({
      data: {
        organizationId: this.requestContext.organizationId,
        createdById: this.requestContext.userId,
        projectId: projectContext.projectId,
        parcelId: projectContext.parcelId,
        parcelGroupId: projectContext.parcelGroupId,
        name: this.buildScenarioName(dto.name, nextFamilyVersion),
        description: dto.description ?? null,
        strategyType: dto.strategyType,
        acquisitionType: dto.acquisitionType,
        optimizationTarget: dto.optimizationTarget,
        governanceStatus,
        isCurrentBest: shouldMarkCurrentBest,
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
        inputsJson: toPrismaJson(inputsJson),
      },
    });

    if (shouldMarkCurrentBest) {
      await this.clearCurrentBestForFamily(familyDefinition, created.id);
    }

    return this.getById(created.id, organization.defaultScenarioTemplateKey);
  }

  async getById(scenarioId: string, workspaceDefaultTemplateKey?: string | null): Promise<ScenarioDto> {
    const scenario = await this.prisma.scenario.findFirst({
      ...scenarioForValidationArgs,
      where: {
        id: scenarioId,
        organizationId: this.requestContext.organizationId,
      },
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found");
    }

    const resolvedWorkspaceDefaultTemplateKey = workspaceDefaultTemplateKey ?? (await this.prisma.organization.findUniqueOrThrow({
      where: { id: this.requestContext.organizationId },
      select: { defaultScenarioTemplateKey: true },
    })).defaultScenarioTemplateKey;
    const familyRows = await this.prisma.scenario.findMany({
      where: { organizationId: this.requestContext.organizationId },
      select: {
        id: true,
        projectId: true,
        parcelId: true,
        parcelGroupId: true,
        strategyType: true,
        optimizationTarget: true,
        createdAt: true,
        governanceStatus: true,
        isCurrentBest: true,
      },
    });
    const latestRunId = await this.getLatestRunIdForScenario(scenario.id);

    return this.mapScenario(scenario, {
      workspaceDefaultTemplateKey: resolvedWorkspaceDefaultTemplateKey,
      familyMetadata: this.buildFamilyMetadataMap(familyRows),
      latestRunId,
      readinessSnapshot: this.toReadinessSnapshot(this.scenarioValidationService.evaluateLoadedScenario(scenario).readiness),
    });
  }

  async update(scenarioId: string, dto: UpdateScenarioRequestDto): Promise<ScenarioDto> {
    const existing = await this.assertScenarioAccess(scenarioId);
    const hasAnchorOverride = dto.projectId !== undefined || dto.parcelId !== undefined || dto.parcelGroupId !== undefined;
    const nextProjectContext = hasAnchorOverride
      ? await this.resolveScenarioProjectContext(
          dto.projectId ?? null,
          dto.parcelId === undefined ? existing.parcelId : dto.parcelId,
          dto.parcelGroupId === undefined ? existing.parcelGroupId : dto.parcelGroupId,
          true,
        )
      : {
          projectId: existing.projectId ?? null,
          parcelId: existing.parcelId,
          parcelGroupId: existing.parcelGroupId,
        };
    const nextParcelId = nextProjectContext.parcelId;
    const nextParcelGroupId = nextProjectContext.parcelGroupId;
    const nextStrategyType = dto.strategyType ?? existing.strategyType;
    const nextOptimizationTarget = dto.optimizationTarget ?? existing.optimizationTarget;
    const nextFamilyDefinition = this.buildScenarioFamilyDefinition(
      nextProjectContext.projectId,
      nextParcelId ?? null,
      nextParcelGroupId ?? null,
      nextStrategyType,
      nextOptimizationTarget,
    );
    const requestedGovernanceStatus = dto.governanceStatus ?? existing.governanceStatus;
    const governanceStatus = dto.isCurrentBest === true
      ? "ACTIVE_CANDIDATE"
      : requestedGovernanceStatus;
    const nextIsCurrentBest = governanceStatus === "ACTIVE_CANDIDATE"
      ? dto.isCurrentBest ?? existing.isCurrentBest
      : false;
    const nextAssumptionSet = dto.assumptionSet === undefined
      ? extractScenarioAssumptionSet(toApiJson(existing.inputsJson))
      : dto.assumptionSet;
    const nextInputsJson = withScenarioAssumptionSet(
      dto.inputsJson === undefined ? toApiJson(existing.inputsJson) : dto.inputsJson,
      nextAssumptionSet,
    );

    await this.prisma.scenario.update({
      where: { id: scenarioId },
      data: {
        projectId: nextProjectContext.projectId,
        parcelId: nextProjectContext.parcelId,
        parcelGroupId: nextProjectContext.parcelGroupId,
        name: dto.name,
        description: dto.description === undefined ? undefined : dto.description,
        strategyType: dto.strategyType,
        acquisitionType: dto.acquisitionType,
        optimizationTarget: dto.optimizationTarget,
        governanceStatus,
        isCurrentBest: nextIsCurrentBest,
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
        inputsJson: toPrismaJson(nextInputsJson),
        status: dto.status,
      },
    });

    if (nextIsCurrentBest) {
      await this.clearCurrentBestForFamily(nextFamilyDefinition, scenarioId);
    }

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
      select: {
        id: true,
        projectId: true,
        parcelId: true,
        parcelGroupId: true,
        strategyType: true,
        optimizationTarget: true,
        governanceStatus: true,
        isCurrentBest: true,
        inputsJson: true,
      },
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found");
    }

    return scenario;
  }

  private async resolveScenarioProjectContext(
    projectId: string | null,
    parcelId: string | null | undefined,
    parcelGroupId: string | null | undefined,
    rejectGroupedMemberWrite = false,
  ) {
    if (projectId) {
      const project = await this.projectsService.getAccessibleProjectAnchor(projectId);
      return {
        projectId: project.id,
        parcelId: project.anchorParcelId,
        parcelGroupId: project.anchorParcelGroupId ?? null,
      };
    }

    const parcelAnchor = await this.resolveScenarioParcelAnchor(parcelId, parcelGroupId, rejectGroupedMemberWrite);
    if (!parcelAnchor.parcelId) {
      return {
        projectId: null,
        parcelId: parcelAnchor.parcelId ?? null,
        parcelGroupId: parcelAnchor.parcelGroupId ?? null,
      };
    }

    const project = await this.projectsService.ensureProjectForAnchor(parcelAnchor.parcelId, {
      anchorParcelGroupId: parcelAnchor.parcelGroupId ?? null,
    });

    return {
      projectId: project.id,
      parcelId: parcelAnchor.parcelId,
      parcelGroupId: parcelAnchor.parcelGroupId ?? null,
    };
  }

  private async resolveScenarioParcelAnchor(
    parcelId: string | null | undefined,
    parcelGroupId: string | null | undefined,
    rejectGroupedMemberWrite = false,
  ) {
    if (parcelId === undefined) {
      return {
        parcelId: undefined,
        parcelGroupId: undefined,
      };
    }

    if (!parcelId) {
      return {
        parcelId: null,
        parcelGroupId: parcelGroupId ?? null,
      };
    }

    const parcel = await this.prisma.parcel.findFirst({
      where: {
        id: parcelId,
        organizationId: this.requestContext.organizationId,
      },
      select: {
        id: true,
        parcelGroupId: true,
        isGroupSite: true,
        parcelGroup: {
          select: {
            id: true,
            name: true,
            siteParcelId: true,
            siteParcel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    if (parcel.parcelGroupId && !parcel.isGroupSite) {
      if (rejectGroupedMemberWrite) {
        throw new ConflictException({
          code: "GROUPED_SITE_WRITE_REQUIRED",
          message: `This parcel is a grouped-site member. Create or update scenarios against ${parcel.parcelGroup?.siteParcel?.name ?? parcel.parcelGroup?.name ?? "the grouped site"} instead.`,
          siteParcelId: parcel.parcelGroup?.siteParcel?.id ?? parcel.parcelGroup?.siteParcelId ?? null,
          parcelGroupId: parcel.parcelGroupId,
        });
      }

      return {
        parcelId: parcel.parcelGroup?.siteParcelId ?? parcel.id,
        parcelGroupId: parcel.parcelGroupId,
      };
    }

    return {
      parcelId: parcel.id,
      parcelGroupId: parcel.parcelGroupId ?? parcelGroupId ?? null,
    };
  }

  private mapScenario(
    item: ScenarioForValidation,
    options: {
      workspaceDefaultTemplateKey: string | null;
      familyMetadata: Map<string, { familyKey: string; familyVersion: number }>;
      latestRunId: string | null;
      readinessSnapshot: ScenarioDto["readinessSnapshot"];
    },
  ): ScenarioDto {
    const assumptionSet = extractScenarioAssumptionSet(toApiJson(item.inputsJson));
    const template = getScenarioAssumptionTemplateByKey(assumptionSet?.templateKey ?? options.workspaceDefaultTemplateKey);
    const family = options.familyMetadata.get(item.id) ?? {
      familyKey: this.buildScenarioFamilyKey(item.projectId ?? null, item.parcelId, item.parcelGroupId, item.strategyType, item.optimizationTarget),
      familyVersion: 1,
    };

    return {
      id: item.id,
      organizationId: item.organizationId,
      createdById: item.createdById,
      projectId: item.projectId ?? null,
      project: item.project
        ? {
            id: item.project.id,
            name: item.project.name,
            status: item.project.status,
            anchorParcelId: item.project.anchorParcelId,
            anchorParcelGroupId: item.project.anchorParcelGroupId ?? null,
            anchorParcel: {
              id: item.project.anchorParcel.id,
              parcelGroupId: item.project.anchorParcel.parcelGroupId ?? null,
              isGroupSite: Boolean(item.project.anchorParcel.isGroupSite),
              name: item.project.anchorParcel.name,
              cadastralId: item.project.anchorParcel.cadastralId,
              municipalityName: item.project.anchorParcel.municipalityName,
              city: item.project.anchorParcel.city,
              landAreaSqm: toApiDecimal(item.project.anchorParcel.landAreaSqm),
              confidenceScore: item.project.anchorParcel.confidenceScore ?? null,
              confidenceBand: item.project.anchorParcel.confidenceScore == null
                ? "UNSCORED"
                : item.project.anchorParcel.confidenceScore >= 80
                  ? "HIGH"
                  : item.project.anchorParcel.confidenceScore >= 60
                    ? "MEDIUM"
                    : "LOW",
              sourceAuthority: (() => {
                const provenance = toApiJson<Record<string, unknown>>(item.project.anchorParcel.provenanceJson as never);
                const sourceAuthority = provenance && typeof provenance.sourceAuthority === "string"
                  ? provenance.sourceAuthority
                  : null;
                if (sourceAuthority === "DEMO" || sourceAuthority === "SEARCH_GRADE" || sourceAuthority === "CADASTRAL_GRADE") {
                  return sourceAuthority;
                }
                switch (item.project.anchorParcel.sourceType) {
                  case "GIS_CADASTRE":
                    return "CADASTRAL_GRADE";
                  case "THIRD_PARTY_API":
                    return "SEARCH_GRADE";
                  case "IMPORT":
                    return "DEMO";
                  default:
                    return null;
                }
              })(),
            },
          }
        : null,
      parcelId: item.parcelId,
      parcelGroupId: item.parcelGroupId,
      name: item.name,
      description: item.description,
      status: item.status,
      governanceStatus: item.governanceStatus,
      isCurrentBest: item.isCurrentBest,
      familyKey: family.familyKey,
      familyVersion: family.familyVersion,
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
      assumptionSet,
      assumptionSummary: buildScenarioAssumptionSummary(assumptionSet, {
        templateDefaults: template?.defaults ?? null,
        templateScope: template?.scope ?? null,
        isWorkspaceDefault: Boolean(template?.key && template.key === options.workspaceDefaultTemplateKey),
        fallbackTemplateKey: assumptionSet ? null : template?.key ?? null,
        fallbackTemplateName: assumptionSet ? null : template?.name ?? null,
        fallbackProfileKey: assumptionSet ? undefined : template?.profileKey,
      }),
      inputsJson: toApiJson(item.inputsJson),
      latestRunId: options.latestRunId,
      latestRunAt: toApiDate(item.latestRunAt),
      readinessSnapshot: options.readinessSnapshot,
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

  private async buildLatestRunIdMap(scenarioIds: string[]) {
    const rows = await this.prisma.scenarioRun.findMany({
      where: {
        organizationId: this.requestContext.organizationId,
        scenarioId: { in: scenarioIds },
      },
      select: {
        id: true,
        scenarioId: true,
      },
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    });
    const latestRunIdByScenario = new Map<string, string>();

    for (const row of rows) {
      if (!latestRunIdByScenario.has(row.scenarioId)) {
        latestRunIdByScenario.set(row.scenarioId, row.id);
      }
    }

    return latestRunIdByScenario;
  }

  private async getLatestRunIdForScenario(scenarioId: string) {
    const latestRun = await this.prisma.scenarioRun.findFirst({
      where: {
        organizationId: this.requestContext.organizationId,
        scenarioId,
      },
      orderBy: [{ requestedAt: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });

    return latestRun?.id ?? null;
  }

  private buildScenarioFamilyDefinition(
    projectId: string | null,
    parcelId: string | null,
    parcelGroupId: string | null,
    strategyType: CreateScenarioRequestDto["strategyType"],
    optimizationTarget: CreateScenarioRequestDto["optimizationTarget"],
  ) {
    return {
      projectId,
      parcelId,
      parcelGroupId,
      strategyType,
      optimizationTarget,
      familyKey: this.buildScenarioFamilyKey(projectId, parcelId, parcelGroupId, strategyType, optimizationTarget),
    };
  }

  private buildScenarioFamilyKey(
    projectId: string | null,
    parcelId: string | null,
    parcelGroupId: string | null,
    strategyType: CreateScenarioRequestDto["strategyType"],
    optimizationTarget: CreateScenarioRequestDto["optimizationTarget"],
  ) {
    const anchorKey = projectId ?? parcelGroupId ?? parcelId ?? "unlinked";
    return `${anchorKey}::${strategyType}::${optimizationTarget}`;
  }

  private async findFamilyScenarios(family: ReturnType<ScenariosService["buildScenarioFamilyDefinition"]>) {
    return this.prisma.scenario.findMany({
      where: {
        organizationId: this.requestContext.organizationId,
        projectId: family.projectId,
        parcelId: family.parcelId,
        parcelGroupId: family.parcelGroupId,
        strategyType: family.strategyType,
        optimizationTarget: family.optimizationTarget,
      },
      select: {
        id: true,
        createdAt: true,
        governanceStatus: true,
        isCurrentBest: true,
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }

  private async clearCurrentBestForFamily(
    family: ReturnType<ScenariosService["buildScenarioFamilyDefinition"]>,
    keepScenarioId: string,
  ) {
    await this.prisma.scenario.updateMany({
      where: {
        organizationId: this.requestContext.organizationId,
        projectId: family.projectId,
        parcelId: family.parcelId,
        parcelGroupId: family.parcelGroupId,
        strategyType: family.strategyType,
        optimizationTarget: family.optimizationTarget,
        NOT: { id: keepScenarioId },
      },
      data: {
        isCurrentBest: false,
      },
    });
  }

  private buildFamilyMetadataMap(
    rows: Array<{
      id: string;
      projectId: string | null;
      parcelId: string | null;
      parcelGroupId: string | null;
      strategyType: CreateScenarioRequestDto["strategyType"];
      optimizationTarget: CreateScenarioRequestDto["optimizationTarget"];
      createdAt: Date;
    }>,
  ) {
    const families = new Map<string, typeof rows>();

    for (const row of rows) {
      const familyKey = this.buildScenarioFamilyKey(row.projectId, row.parcelId, row.parcelGroupId, row.strategyType, row.optimizationTarget);
      const bucket = families.get(familyKey) ?? [];
      bucket.push(row);
      families.set(familyKey, bucket);
    }

    const metadata = new Map<string, { familyKey: string; familyVersion: number }>();

    for (const [familyKey, familyRows] of families.entries()) {
      const sorted = [...familyRows].sort((left, right) => {
        const createdAtDiff = left.createdAt.getTime() - right.createdAt.getTime();
        if (createdAtDiff !== 0) return createdAtDiff;
        return left.id.localeCompare(right.id);
      });

      sorted.forEach((row, index) => {
        metadata.set(row.id, {
          familyKey,
          familyVersion: index + 1,
        });
      });
    }

    return metadata;
  }

  private toReadinessSnapshot(readiness: ScenarioReadinessDto): ScenarioDto["readinessSnapshot"] {
    return {
      status: readiness.status,
      executionBlockers: readiness.summary.executionBlockers,
      confidenceBlockers: readiness.summary.confidenceBlockers,
      warningCount: readiness.issues.filter((issue) => issue.severity === "WARNING").length,
    };
  }

  private buildScenarioName(name: string, familyVersion: number) {
    if (familyVersion <= 1) return name;
    if (/\/ v\d+$/i.test(name)) return name;
    return `${name} / v${familyVersion}`;
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
    const summary = scenario.assumptionSummary;
    const templateLabel = summary.templateName ?? `${summary.profileKey} template`;
    return summary.overrideCount
      ? `${templateLabel} + ${summary.overrideCount} override${summary.overrideCount === 1 ? "" : "s"}`
      : templateLabel;
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
