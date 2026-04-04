import { BadRequestException, Injectable, NotFoundException, Scope } from "@nestjs/common";
import { SourceType } from "@prisma/client";
import type {
  CreateParcelRequestDto,
  CreateSourceParcelIntakeRequestDto,
  ListParcelsResponseDto,
  ParcelDto,
  ParcelGroupSummaryDto,
  SearchSourceParcelsResponseDto,
  SourceParcelIntakeResponseDto,
  SourceParcelSearchResultDto,
  UpdateParcelRequestDto,
} from "../../generated-contracts/parcels";
import { calculateMultiPolygonAreaSqm, calculateMultiPolygonCentroid, mergeMultiPolygons } from "../../common/geo/geometry-metrics";
import { normalizePolygonGeometryToMultiPolygon } from "../../common/geo/polygon-normalization";
import { toApiDate, toApiDecimal, toApiJson, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { getSourceParcelsByIds, searchSourceParcels } from "./source-parcel-catalog";

type ParcelTrustMode = NonNullable<ParcelDto["provenance"]>["trustMode"];

function deriveTrustMode({
  sourceType,
  geometryDerived,
  areaDerived,
}: {
  sourceType: ParcelDto["sourceType"];
  geometryDerived: boolean;
  areaDerived: boolean;
}): ParcelTrustMode {
  if (sourceType === SourceType.USER_INPUT || sourceType === SourceType.MANUAL_OVERRIDE) {
    return "MANUAL_FALLBACK";
  }

  if (sourceType === SourceType.SYSTEM_DERIVED) {
    return "GROUP_DERIVED";
  }

  return geometryDerived && areaDerived ? "SOURCE_PRIMARY" : "SOURCE_INCOMPLETE";
}

function buildManualFallbackProvenance(dto: CreateParcelRequestDto | UpdateParcelRequestDto) {
  const geometryDerived = Boolean("geom" in dto && dto.geom);
  const areaDerived = Boolean("landAreaSqm" in dto && dto.landAreaSqm);

  return {
    providerName: null,
    providerParcelId: null,
    trustMode: deriveTrustMode({
      sourceType: dto.sourceType ?? SourceType.USER_INPUT,
      geometryDerived,
      areaDerived,
    }),
    geometryDerived,
    areaDerived,
    rawMetadata: null,
  } as const;
}

function buildSourceParcelProvenance(sourceParcel: SourceParcelSearchResultDto) {
  return {
    providerName: sourceParcel.providerName,
    providerParcelId: sourceParcel.providerParcelId,
    trustMode: deriveTrustMode({
      sourceType: SourceType.GIS_CADASTRE,
      geometryDerived: sourceParcel.hasGeometry,
      areaDerived: sourceParcel.hasLandArea,
    }),
    geometryDerived: sourceParcel.hasGeometry,
    areaDerived: sourceParcel.hasLandArea,
    rawMetadata: sourceParcel.rawMetadata,
  } as const;
}

function buildGroupDerivedProvenance(
  sourceParcels: SourceParcelSearchResultDto[],
  mergedGeom: ParcelDto["geom"],
  combinedAreaSqm: string | null,
) {
  return {
    providerName: "Merged source parcel set",
    providerParcelId: null,
    trustMode: "GROUP_DERIVED" as const,
    geometryDerived: Boolean(mergedGeom),
    areaDerived: Boolean(combinedAreaSqm),
    rawMetadata: {
      intakeMode: "MULTI_PARCEL_SOURCE_GROUP",
      sourceParcelIds: sourceParcels.map((item) => item.providerParcelId),
      providerNames: Array.from(new Set(sourceParcels.map((item) => item.providerName))),
    },
  };
}

function toNullableDecimalString(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return null;
  return String(Math.round(value * 100) / 100);
}

function buildGroupName(sourceParcels: SourceParcelSearchResultDto[], siteName?: string | null) {
  if (siteName?.trim()) {
    return siteName.trim();
  }

  if (sourceParcels.length === 1) {
    return sourceParcels[0].displayName;
  }

  const municipality = sourceParcels[0]?.municipalityName ?? sourceParcels[0]?.city ?? "Site";
  return `${municipality} assembled site`;
}

@Injectable({ scope: Scope.REQUEST })
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async list(params: { page: number; pageSize: number }): Promise<ListParcelsResponseDto> {
    const page = Math.max(1, params.page);
    const pageSize = Math.min(100, Math.max(1, params.pageSize));

    const where = {
      organizationId: this.requestContext.organizationId,
      OR: [
        { parcelGroupId: null },
        { isGroupSite: true },
      ],
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.parcel.findMany({
        where,
        include: {
          parcelGroup: {
            include: {
              parcels: {
                where: { isGroupSite: false },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.parcel.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapParcel(item)),
      total,
      page,
      pageSize,
    };
  }

  async searchSource(query?: string | null, municipality?: string | null, limit = 12): Promise<SearchSourceParcelsResponseDto> {
    return searchSourceParcels(query, municipality, limit);
  }

  async create(dto: CreateParcelRequestDto): Promise<ParcelDto> {
    const created = await this.prisma.parcel.create({
      data: {
        organizationId: this.requestContext.organizationId,
        name: dto.name ?? null,
        cadastralId: dto.cadastralId ?? null,
        addressLine1: dto.addressLine1 ?? null,
        city: dto.city ?? null,
        postalCode: dto.postalCode ?? null,
        stateCode: dto.stateCode ?? null,
        countryCode: dto.countryCode ?? "DE",
        municipalityName: dto.municipalityName ?? null,
        districtName: dto.districtName ?? null,
        landAreaSqm: dto.landAreaSqm ?? null,
        sourceType: dto.sourceType,
        sourceReference: dto.sourceReference ?? null,
        sourceProviderName: dto.sourceProviderName ?? null,
        sourceProviderParcelId: dto.sourceProviderParcelId ?? null,
        confidenceScore: dto.confidenceScore ?? null,
        geom: toPrismaJson(normalizePolygonGeometryToMultiPolygon(dto.geom) ?? null),
        centroid: toPrismaJson(calculateMultiPolygonCentroid(normalizePolygonGeometryToMultiPolygon(dto.geom) ?? null)),
        provenanceJson: toPrismaJson(dto.provenance ?? buildManualFallbackProvenance(dto)),
      },
      include: {
        parcelGroup: {
          include: {
            parcels: {
              where: { isGroupSite: false },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    return this.mapParcel(created);
  }

  async intakeFromSource(dto: CreateSourceParcelIntakeRequestDto): Promise<SourceParcelIntakeResponseDto> {
    const sourceParcelIds = Array.from(new Set(dto.sourceParcelIds.filter((item) => item.trim())));
    if (!sourceParcelIds.length) {
      throw new BadRequestException("At least one source parcel must be selected.");
    }

    const sourceParcels = getSourceParcelsByIds(sourceParcelIds);
    if (sourceParcels.length !== sourceParcelIds.length) {
      throw new BadRequestException("One or more selected source parcels are no longer available.");
    }

    if (sourceParcels.length === 1) {
      const sourceParcel = sourceParcels[0];
      const existing = await this.prisma.parcel.findFirst({
        where: {
          organizationId: this.requestContext.organizationId,
          sourceProviderName: sourceParcel.providerName,
          sourceProviderParcelId: sourceParcel.providerParcelId,
          parcelGroupId: null,
          isGroupSite: false,
        },
        include: {
          parcelGroup: {
            include: {
              parcels: {
                where: { isGroupSite: false },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (existing) {
        const mappedExisting = this.mapParcel(existing);
        return {
          primaryParcel: mappedExisting,
          createdParcels: [mappedExisting],
          parcelGroup: null,
        };
      }

      const created = await this.prisma.parcel.create({
        data: {
          organizationId: this.requestContext.organizationId,
          name: sourceParcel.displayName,
          cadastralId: sourceParcel.cadastralId,
          addressLine1: sourceParcel.addressLine1,
          city: sourceParcel.city,
          postalCode: sourceParcel.postalCode,
          stateCode: sourceParcel.stateCode,
          countryCode: sourceParcel.countryCode ?? "DE",
          municipalityName: sourceParcel.municipalityName,
          districtName: sourceParcel.districtName,
          landAreaSqm: sourceParcel.landAreaSqm,
          sourceType: SourceType.GIS_CADASTRE,
          sourceReference: sourceParcel.sourceReference,
          sourceProviderName: sourceParcel.providerName,
          sourceProviderParcelId: sourceParcel.providerParcelId,
          confidenceScore: sourceParcel.confidenceScore,
          geom: toPrismaJson(sourceParcel.geom),
          centroid: toPrismaJson(sourceParcel.centroid),
          provenanceJson: toPrismaJson(buildSourceParcelProvenance(sourceParcel)),
        },
        include: {
          parcelGroup: {
            include: {
              parcels: {
                where: { isGroupSite: false },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      const mappedCreated = this.mapParcel(created);
      return {
        primaryParcel: mappedCreated,
        createdParcels: [mappedCreated],
        parcelGroup: null,
      };
    }

    const mergedGeom = mergeMultiPolygons(sourceParcels.map((item) => item.geom));
    const combinedAreaSqm = toNullableDecimalString(
      sourceParcels.reduce((sum, item) => sum + Number(item.landAreaSqm ?? 0), 0),
    );
    const groupConfidence = Math.round(
      sourceParcels.reduce((sum, item) => sum + (item.confidenceScore ?? 70), 0) / sourceParcels.length,
    );
    const siteName = buildGroupName(sourceParcels, dto.siteName);

    const transactionResult = await this.prisma.$transaction(async (transaction) => {
      const parcelGroup = await transaction.parcelGroup.create({
        data: {
          organizationId: this.requestContext.organizationId,
          name: siteName,
          landAreaSqm: combinedAreaSqm,
          sourceType: SourceType.SYSTEM_DERIVED,
          sourceReference: `source-group:${sourceParcels.map((item) => item.providerParcelId).join("+")}`,
          sourceProviderName: "Merged source parcel set",
          confidenceScore: groupConfidence,
          geom: toPrismaJson(mergedGeom),
          centroid: toPrismaJson(calculateMultiPolygonCentroid(mergedGeom)),
          provenanceJson: toPrismaJson(buildGroupDerivedProvenance(sourceParcels, mergedGeom, combinedAreaSqm)),
        },
      });

      const createdMembers = [];
      for (const sourceParcel of sourceParcels) {
        createdMembers.push(await transaction.parcel.create({
          data: {
            organizationId: this.requestContext.organizationId,
            parcelGroupId: parcelGroup.id,
            isGroupSite: false,
            name: sourceParcel.displayName,
            cadastralId: sourceParcel.cadastralId,
            addressLine1: sourceParcel.addressLine1,
            city: sourceParcel.city,
            postalCode: sourceParcel.postalCode,
            stateCode: sourceParcel.stateCode,
            countryCode: sourceParcel.countryCode ?? "DE",
            municipalityName: sourceParcel.municipalityName,
            districtName: sourceParcel.districtName,
            landAreaSqm: sourceParcel.landAreaSqm,
            sourceType: SourceType.GIS_CADASTRE,
            sourceReference: sourceParcel.sourceReference,
            sourceProviderName: sourceParcel.providerName,
            sourceProviderParcelId: sourceParcel.providerParcelId,
            confidenceScore: sourceParcel.confidenceScore,
            geom: toPrismaJson(sourceParcel.geom),
            centroid: toPrismaJson(sourceParcel.centroid),
            provenanceJson: toPrismaJson(buildSourceParcelProvenance(sourceParcel)),
          },
        }));
      }

      const siteParcel = await transaction.parcel.create({
        data: {
          organizationId: this.requestContext.organizationId,
          parcelGroupId: parcelGroup.id,
          isGroupSite: true,
          name: siteName,
          cadastralId: null,
          addressLine1: null,
          city: sourceParcels[0]?.city ?? null,
          postalCode: sourceParcels[0]?.postalCode ?? null,
          stateCode: sourceParcels[0]?.stateCode ?? null,
          countryCode: sourceParcels[0]?.countryCode ?? "DE",
          municipalityName: sourceParcels[0]?.municipalityName ?? null,
          districtName: sourceParcels.map((item) => item.districtName).filter((item): item is string => Boolean(item)).join(", ") || null,
          landAreaSqm: combinedAreaSqm,
          sourceType: SourceType.SYSTEM_DERIVED,
          sourceReference: `parcel-group:${parcelGroup.id}`,
          sourceProviderName: "Merged source parcel set",
          sourceProviderParcelId: null,
          confidenceScore: groupConfidence,
          geom: toPrismaJson(mergedGeom),
          centroid: toPrismaJson(calculateMultiPolygonCentroid(mergedGeom)),
          provenanceJson: toPrismaJson(buildGroupDerivedProvenance(sourceParcels, mergedGeom, combinedAreaSqm)),
        },
      });

      await transaction.parcelGroup.update({
        where: { id: parcelGroup.id },
        data: { siteParcelId: siteParcel.id },
      });

      const hydratedSiteParcel = await transaction.parcel.findFirst({
        where: {
          id: siteParcel.id,
          organizationId: this.requestContext.organizationId,
        },
        include: {
          parcelGroup: {
            include: {
              parcels: {
                where: { isGroupSite: false },
                orderBy: { createdAt: "asc" },
              },
            },
          },
        },
      });

      if (!hydratedSiteParcel) {
        throw new NotFoundException("Grouped site parcel could not be loaded after intake.");
      }

      return {
        primaryParcel: this.mapParcel(hydratedSiteParcel),
        createdParcels: createdMembers.map((item) => this.mapParcel(item)),
      };
    });

    return {
      primaryParcel: transactionResult.primaryParcel,
      createdParcels: transactionResult.createdParcels,
      parcelGroup: transactionResult.primaryParcel.parcelGroup,
    };
  }

  async getById(parcelId: string): Promise<ParcelDto> {
    const parcel = await this.prisma.parcel.findFirst({
      where: {
        id: parcelId,
        organizationId: this.requestContext.organizationId,
      },
      include: {
        parcelGroup: {
          include: {
            parcels: {
              where: { isGroupSite: false },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }

    return this.mapParcel(parcel);
  }

  async update(parcelId: string, dto: UpdateParcelRequestDto): Promise<ParcelDto> {
    await this.assertParcelAccess(parcelId);

    const normalizedGeom = "geom" in dto
      ? normalizePolygonGeometryToMultiPolygon(dto.geom)
      : undefined;
    const provenance = dto.provenance ?? (dto.sourceType ? buildManualFallbackProvenance(dto) : undefined);

    const updated = await this.prisma.parcel.update({
      where: { id: parcelId },
      data: {
        name: dto.name,
        cadastralId: dto.cadastralId,
        addressLine1: dto.addressLine1,
        city: dto.city,
        postalCode: dto.postalCode,
        stateCode: dto.stateCode,
        countryCode: dto.countryCode,
        municipalityName: dto.municipalityName,
        districtName: dto.districtName,
        landAreaSqm: dto.landAreaSqm === undefined ? undefined : dto.landAreaSqm,
        sourceReference: dto.sourceReference,
        sourceProviderName: dto.sourceProviderName,
        sourceProviderParcelId: dto.sourceProviderParcelId,
        confidenceScore: dto.confidenceScore,
        geom: "geom" in dto ? toPrismaJson(normalizedGeom) : undefined,
        centroid: "geom" in dto ? toPrismaJson(calculateMultiPolygonCentroid(normalizedGeom)) : undefined,
        provenanceJson: provenance === undefined ? undefined : toPrismaJson(provenance),
      },
      include: {
        parcelGroup: {
          include: {
            parcels: {
              where: { isGroupSite: false },
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
    });

    return this.mapParcel(updated);
  }

  private async assertParcelAccess(parcelId: string) {
    const parcel = await this.prisma.parcel.findFirst({
      where: { id: parcelId, organizationId: this.requestContext.organizationId },
      select: { id: true },
    });

    if (!parcel) {
      throw new NotFoundException("Parcel not found");
    }
  }

  private mapParcelGroup(parcelGroup: any): ParcelGroupSummaryDto | null {
    if (!parcelGroup) {
      return null;
    }

    const memberParcels = Array.isArray(parcelGroup.parcels)
      ? parcelGroup.parcels.filter((item: any) => !item.isGroupSite)
      : [];

    return {
      id: parcelGroup.id,
      name: parcelGroup.name,
      memberCount: memberParcels.length,
      combinedLandAreaSqm: toApiDecimal(parcelGroup.landAreaSqm as never),
      siteParcelId: parcelGroup.siteParcelId ?? null,
      sourceType: parcelGroup.sourceType,
      sourceReference: parcelGroup.sourceReference ?? null,
      confidenceScore: parcelGroup.confidenceScore ?? null,
    };
  }

  private mapParcel(parcel: any): ParcelDto {
    const provenance = toApiJson(parcel.provenanceJson as never) as ParcelDto["provenance"] | null;
    const derivedProvenance = provenance ?? {
      providerName: parcel.sourceProviderName ?? null,
      providerParcelId: parcel.sourceProviderParcelId ?? null,
      trustMode: deriveTrustMode({
        sourceType: parcel.sourceType,
        geometryDerived: Boolean(parcel.geom),
        areaDerived: Boolean(parcel.landAreaSqm),
      }),
      geometryDerived: Boolean(parcel.geom),
      areaDerived: Boolean(parcel.landAreaSqm),
      rawMetadata: null,
    };

    const constituentParcels = Array.isArray(parcel.parcelGroup?.parcels)
      ? parcel.parcelGroup.parcels
          .filter((item: any) => !item.isGroupSite)
          .map((item: any) => ({
            id: item.id,
            name: item.name,
            cadastralId: item.cadastralId,
            municipalityName: item.municipalityName,
            landAreaSqm: toApiDecimal(item.landAreaSqm as never),
            confidenceScore: item.confidenceScore,
            sourceProviderName: item.sourceProviderName ?? null,
            sourceProviderParcelId: item.sourceProviderParcelId ?? null,
            sourceReference: item.sourceReference ?? null,
          }))
      : [];

    return {
      id: parcel.id,
      organizationId: parcel.organizationId,
      parcelGroupId: parcel.parcelGroupId ?? null,
      isGroupSite: Boolean(parcel.isGroupSite),
      name: parcel.name,
      cadastralId: parcel.cadastralId,
      addressLine1: parcel.addressLine1,
      city: parcel.city,
      postalCode: parcel.postalCode,
      stateCode: parcel.stateCode,
      countryCode: parcel.countryCode,
      municipalityName: parcel.municipalityName,
      districtName: parcel.districtName,
      landAreaSqm: toApiDecimal(parcel.landAreaSqm as never),
      sourceType: parcel.sourceType,
      sourceReference: parcel.sourceReference,
      sourceProviderName: parcel.sourceProviderName ?? null,
      sourceProviderParcelId: parcel.sourceProviderParcelId ?? null,
      confidenceScore: parcel.confidenceScore,
      geom: toApiJson(parcel.geom as never),
      centroid: toApiJson(parcel.centroid as never),
      provenance: derivedProvenance,
      parcelGroup: this.mapParcelGroup(parcel.parcelGroup),
      constituentParcels,
      createdAt: toApiDate(parcel.createdAt)!,
      updatedAt: toApiDate(parcel.updatedAt)!,
    };
  }
}
