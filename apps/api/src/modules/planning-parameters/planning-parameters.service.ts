import { BadRequestException, ConflictException, Injectable, NotFoundException, Scope } from "@nestjs/common";
import type {
  ListPlanningParametersResponseDto,
  PlanningParameterDto,
  UpsertPlanningParameterRequestDto,
} from "../../generated-contracts/planning";
import { resolvePlanningKeyParts } from "../../generated-contracts/planning-keys";
import { toApiDate, toApiDecimal, toApiJson, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";

@Injectable({ scope: Scope.REQUEST })
export class PlanningParametersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async listForParcel(parcelId: string): Promise<ListPlanningParametersResponseDto> {
    const parcel = await this.assertParcelAccess(parcelId);

    const items = await this.prisma.planningParameter.findMany({
      where: {
        parcelId: parcel.anchorParcelId,
        organizationId: this.requestContext.organizationId,
        ...(parcel.parcelGroupId
          ? {
              OR: [
                { parcelGroupId: parcel.parcelGroupId },
                { parcelGroupId: null },
              ],
            }
          : {}),
      },
      orderBy: [{ keyNamespace: "asc" }, { keySlug: "asc" }, { createdAt: "desc" }],
    });

    return {
      items: items.map((item) => this.mapPlanningParameter(item)),
      total: items.length,
      page: 1,
      pageSize: items.length,
    };
  }

  async createForParcel(parcelId: string, dto: UpsertPlanningParameterRequestDto): Promise<PlanningParameterDto> {
    const parcel = await this.assertWritableParcelAccess(parcelId);
    const key = this.resolveKey(dto);

    const created = await this.prisma.planningParameter.create({
      data: {
        organizationId: this.requestContext.organizationId,
        parcelId: parcel.anchorParcelId,
        parcelGroupId: parcel.parcelGroupId,
        planningDocumentId: dto.planningDocumentId ?? null,
        parameterKey: key.parameterKey,
        customKey: key.customKey,
        keyNamespace: key.keyNamespace,
        keySlug: key.keySlug,
        parameterType: dto.parameterType,
        label: dto.label,
        unit: dto.unit ?? null,
        valueText: dto.valueText ?? null,
        valueNumber: dto.valueNumber ?? null,
        valueBoolean: dto.valueBoolean ?? null,
        valueJson: toPrismaJson(dto.valueJson ?? null),
        geom: toPrismaJson(dto.geom ?? null),
        sourceType: dto.sourceType,
        sourceReference: dto.sourceReference ?? null,
        confidenceScore: dto.confidenceScore ?? null,
      },
    });

    return this.mapPlanningParameter(created);
  }

  async updateForParcel(parcelId: string, planningParameterId: string, dto: UpsertPlanningParameterRequestDto) {
    const parcel = await this.assertWritableParcelAccess(parcelId);
    const existing = await this.prisma.planningParameter.findFirst({
      where: {
        id: planningParameterId,
        parcelId: parcel.anchorParcelId,
        organizationId: this.requestContext.organizationId,
        ...(parcel.parcelGroupId
          ? {
              OR: [
                { parcelGroupId: parcel.parcelGroupId },
                { parcelGroupId: null },
              ],
            }
          : {}),
      },
    });

    if (!existing) {
      throw new NotFoundException("Planning parameter not found");
    }

    const key = dto.parameterKey || dto.customKey || dto.keyNamespace
      ? this.resolveKey(dto)
      : {
          parameterKey: existing.parameterKey,
          customKey: existing.customKey,
          keyNamespace: existing.keyNamespace,
          keySlug: existing.keySlug,
        };

    const updated = await this.prisma.planningParameter.update({
      where: { id: planningParameterId },
      data: {
        parcelGroupId: parcel.parcelGroupId,
        planningDocumentId: dto.planningDocumentId === undefined ? undefined : dto.planningDocumentId,
        parameterKey: key.parameterKey,
        customKey: key.customKey,
        keyNamespace: key.keyNamespace,
        keySlug: key.keySlug,
        parameterType: dto.parameterType ?? existing.parameterType,
        label: dto.label ?? existing.label,
        unit: dto.unit === undefined ? undefined : dto.unit,
        valueText: dto.valueText === undefined ? undefined : dto.valueText,
        valueNumber: dto.valueNumber === undefined ? undefined : dto.valueNumber,
        valueBoolean: dto.valueBoolean === undefined ? undefined : dto.valueBoolean,
        valueJson: toPrismaJson(dto.valueJson),
        geom: toPrismaJson(dto.geom),
        sourceType: dto.sourceType ?? existing.sourceType,
        sourceReference: dto.sourceReference === undefined ? undefined : dto.sourceReference,
        confidenceScore: dto.confidenceScore === undefined ? undefined : dto.confidenceScore,
      },
    });

    return this.mapPlanningParameter(updated);
  }

  private async assertParcelAccess(parcelId: string) {
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

    return {
      ...parcel,
      anchorParcelId: parcel.parcelGroupId && !parcel.isGroupSite
        ? parcel.parcelGroup?.siteParcelId ?? parcel.id
        : parcel.id,
    };
  }

  private async assertWritableParcelAccess(parcelId: string) {
    const parcel = await this.assertParcelAccess(parcelId);

    if (parcel.parcelGroupId && !parcel.isGroupSite) {
      throw new ConflictException({
        code: "GROUPED_SITE_WRITE_REQUIRED",
        message: `This parcel is a grouped-site member. Write planning inputs against ${parcel.parcelGroup?.siteParcel?.name ?? parcel.parcelGroup?.name ?? "the grouped site"} instead.`,
        siteParcelId: parcel.parcelGroup?.siteParcel?.id ?? parcel.parcelGroup?.siteParcelId ?? null,
        parcelGroupId: parcel.parcelGroupId,
      });
    }

    return parcel;
  }

  private resolveKey(dto: UpsertPlanningParameterRequestDto) {
    try {
      return resolvePlanningKeyParts(dto);
    } catch {
      throw new BadRequestException("Either parameterKey or customKey is required.");
    }
  }

  private mapPlanningParameter(item: {
    id: string;
    organizationId: string;
    planningDocumentId: string | null;
    parcelId: string | null;
    parcelGroupId: string | null;
    parameterKey: PlanningParameterDto["parameterKey"];
    customKey: string | null;
    keyNamespace: string;
    keySlug: string;
    parameterType: PlanningParameterDto["parameterType"];
    label: string;
    unit: string | null;
    valueText: string | null;
    valueNumber: { toString(): string } | null;
    valueBoolean: boolean | null;
    valueJson: unknown | null;
    geom: unknown | null;
    sourceType: PlanningParameterDto["sourceType"];
    sourceReference: string | null;
    confidenceScore: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): PlanningParameterDto {
    return {
      id: item.id,
      organizationId: item.organizationId,
      planningDocumentId: item.planningDocumentId,
      parcelId: item.parcelId,
      parcelGroupId: item.parcelGroupId,
      parameterKey: item.parameterKey,
      customKey: item.customKey,
      keyNamespace: item.keyNamespace,
      keySlug: item.keySlug,
      parameterType: item.parameterType,
      label: item.label,
      unit: item.unit,
      valueText: item.valueText,
      valueNumber: toApiDecimal(item.valueNumber as never),
      valueBoolean: item.valueBoolean,
      valueJson: toApiJson(item.valueJson as never),
      geom: toApiJson(item.geom as never),
      sourceType: item.sourceType,
      sourceReference: item.sourceReference,
      confidenceScore: item.confidenceScore,
      createdAt: toApiDate(item.createdAt)!,
      updatedAt: toApiDate(item.updatedAt)!,
    };
  }
}
