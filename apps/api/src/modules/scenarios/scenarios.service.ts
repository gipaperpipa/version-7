import { Injectable, NotFoundException, Scope } from "@nestjs/common";
import type {
  CreateScenarioRequestDto,
  ListScenariosResponseDto,
  ScenarioDto,
  UpdateScenarioRequestDto,
  UpsertScenarioFundingStackRequestDto,
} from "../../generated-contracts/scenarios";
import { toApiDate, toApiDecimal, toApiJson, toPrismaDecimal, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { scenarioWithFundingArgs, type ScenarioWithFunding } from "./scenario.types";

@Injectable({ scope: Scope.REQUEST })
export class ScenariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
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
        inputsJson: toPrismaJson(dto.inputsJson ?? null),
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
    await this.assertScenarioAccess(scenarioId);

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
        inputsJson: toPrismaJson(dto.inputsJson),
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

  private async assertScenarioAccess(scenarioId: string) {
    const scenario = await this.prisma.scenario.findFirst({
      where: {
        id: scenarioId,
        organizationId: this.requestContext.organizationId,
      },
      select: { id: true },
    });

    if (!scenario) {
      throw new NotFoundException("Scenario not found");
    }
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
}
