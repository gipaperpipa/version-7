import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Scope,
} from "@nestjs/common";
import { SourceType } from "@prisma/client";
import type {
  CreateParcelRequestDto,
  CreateSourceParcelIntakeRequestDto,
  ListParcelsResponseDto,
  ParcelDto,
  ParcelGroupSummaryDto,
  SearchSourceParcelsResponseDto,
  SourceParcelIntakeConflictCode,
  SourceParcelIntakeOutcome,
  SourceParcelIntakeResponseDto,
  SourceParcelSearchResultDto,
  UpdateParcelRequestDto,
} from "../../generated-contracts/parcels";
import { calculateMultiPolygonCentroid, mergeMultiPolygons } from "../../common/geo/geometry-metrics";
import { normalizePolygonGeometryToMultiPolygon } from "../../common/geo/polygon-normalization";
import { toApiDate, toApiDecimal, toApiJson, toPrismaJson } from "../../common/prisma/api-mappers";
import { PrismaService } from "../../common/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { getSourceParcelsByIds, searchSourceParcels } from "./source-parcel-catalog";
import {
  getParcelConfidenceBand,
  normalizeConfidenceScore,
  toNullableDecimalString,
} from "./source-parcel-model";

type ParcelTrustMode = NonNullable<ParcelDto["provenance"]>["trustMode"];

type ExistingParcelMatch = {
  id: string;
  name: string | null;
  sourceProviderName: string | null;
  sourceProviderParcelId: string | null;
  parcelGroupId: string | null;
  isGroupSite: boolean;
  planningParameters: Array<{
    id: string;
    valueNumber: unknown | null;
    valueBoolean: boolean | null;
    valueJson: unknown | null;
    geom: unknown | null;
  }>;
  scenarios: Array<{
    id: string;
    name: string;
    status: string;
    latestRunAt: Date | null;
  }>;
  parcelGroup: {
    id: string;
    name: string;
    siteParcelId: string | null;
    siteParcel: {
      id: string;
      name: string | null;
    } | null;
  } | null;
};

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
    return geometryDerived && areaDerived ? "GROUP_DERIVED" : "SOURCE_INCOMPLETE";
  }

  return geometryDerived && areaDerived ? "SOURCE_PRIMARY" : "SOURCE_INCOMPLETE";
}

function hasPlanningValue(item: ExistingParcelMatch["planningParameters"][number]) {
  return item.valueNumber !== null || item.valueBoolean !== null || item.valueJson !== null || item.geom !== null;
}

function getDownstreamWorkSummary(match: ExistingParcelMatch) {
  const planningValueCount = match.planningParameters.filter(hasPlanningValue).length;
  const scenarios = match.scenarios.map((item) => ({
    id: item.id,
    name: item.name,
    status: item.status as SearchSourceParcelsResponseDto["items"][number]["downstreamWork"]["scenarios"][number]["status"],
    latestRunAt: item.latestRunAt?.toISOString() ?? null,
  }));

  return {
    planningValueCount,
    scenarioCount: match.scenarios.length,
    scenarios,
  };
}

function hasDownstreamWork(match: ExistingParcelMatch) {
  const summary = getDownstreamWorkSummary(match);
  return summary.planningValueCount > 0 || summary.scenarioCount > 0;
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
    rawMetadata: {
      ...(sourceParcel.rawMetadata ?? {}),
      sourceReference: sourceParcel.sourceReference,
      confidenceScore: sourceParcel.confidenceScore,
      confidenceBand: sourceParcel.confidenceBand,
      completeness: {
        hasGeometry: sourceParcel.hasGeometry,
        hasLandArea: sourceParcel.hasLandArea,
      },
    },
  } as const;
}

function buildGroupName(sourceParcels: SourceParcelSearchResultDto[], siteName?: string | null) {
  if (siteName?.trim()) {
    return siteName.trim();
  }

  if (sourceParcels.length === 1) {
    return sourceParcels[0].displayName;
  }

  const locality = sourceParcels
    .map((item) => item.municipalityName ?? item.city ?? item.displayName)
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => left.localeCompare(right))[0] ?? "Source-selected";

  return `${locality} grouped site (${sourceParcels.length} parcels)`;
}

function buildSourceSelectionSignature(
  sourceParcels: Array<Pick<SourceParcelSearchResultDto, "providerName" | "providerParcelId">>,
) {
  const parts = sourceParcels
    .map((item) => `${item.providerName}::${item.providerParcelId}`)
    .sort((left, right) => left.localeCompare(right));

  return `source-group:${parts.join("+")}`;
}

function buildIntakeBadRequest(
  code: SourceParcelIntakeConflictCode,
  message: string,
  extra?: Record<string, unknown>,
): BadRequestException {
  return new BadRequestException({ code, message, ...(extra ?? {}) });
}

function buildIntakeConflict(
  code: SourceParcelIntakeConflictCode,
  message: string,
  extra?: Record<string, unknown>,
): ConflictException {
  return new ConflictException({ code, message, ...(extra ?? {}) });
}

function computeGroupedConfidence(sourceParcels: SourceParcelSearchResultDto[]) {
  const memberScores = sourceParcels.map((item) => normalizeConfidenceScore(item.confidenceScore) ?? 55);
  const baseAverage = memberScores.reduce((sum, item) => sum + item, 0) / Math.max(memberScores.length, 1);
  const missingGeometryCount = sourceParcels.filter((item) => !item.hasGeometry).length;
  const unresolvedAreaCount = sourceParcels.filter((item) => !item.hasLandArea).length;
  const incompleteMemberCount = sourceParcels.filter((item) => !item.hasGeometry || !item.hasLandArea).length;
  const penalties = {
    missingGeometryPenalty: missingGeometryCount * 8,
    unresolvedAreaPenalty: unresolvedAreaCount * 6,
    incompleteSourcePenalty: incompleteMemberCount * 4,
  };
  const finalScore = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        baseAverage
        - penalties.missingGeometryPenalty
        - penalties.unresolvedAreaPenalty
        - penalties.incompleteSourcePenalty,
      ),
    ),
  );

  return {
    score: finalScore,
    band: getParcelConfidenceBand(finalScore),
    inputs: {
      memberScores,
      baseAverage: Math.round(baseAverage * 100) / 100,
      missingGeometryCount,
      unresolvedAreaCount,
      incompleteMemberCount,
      penalties,
    },
  };
}

function buildGroupDerivedProvenance(args: {
  sourceParcels: SourceParcelSearchResultDto[];
  mergedGeom: ParcelDto["geom"];
  combinedAreaSqm: string | null;
  selectionSignature: string;
  unresolvedAreaMemberIds: string[];
  unresolvedGeometryMemberIds: string[];
  confidenceScore: number;
  confidenceBand: ParcelDto["confidenceBand"];
  confidenceInputs: Record<string, unknown>;
  migrationMetadata: Record<string, unknown> | null;
}) {
  const geometryComplete = args.unresolvedGeometryMemberIds.length === 0 && Boolean(args.mergedGeom);
  const areaComplete = args.unresolvedAreaMemberIds.length === 0 && Boolean(args.combinedAreaSqm);
  const geometryResolution = geometryComplete ? "COMPLETE" : args.mergedGeom ? "PARTIAL" : "ABSENT";
  const areaResolution = areaComplete ? "COMPLETE" : args.combinedAreaSqm ? "PARTIAL" : "ABSENT";

  return {
    providerName: "Merged source parcel set",
    providerParcelId: null,
    trustMode: geometryComplete && areaComplete ? "GROUP_DERIVED" as const : "SOURCE_INCOMPLETE" as const,
    geometryDerived: geometryComplete,
    areaDerived: areaComplete,
    rawMetadata: {
      intakeMode: "MULTI_PARCEL_SOURCE_GROUP",
      membershipStable: true,
      normalizedMemberSetSignature: args.selectionSignature,
      constituentSourceParcelIds: args.sourceParcels
        .map((item) => `${item.providerName}::${item.providerParcelId}`)
        .sort((left, right) => left.localeCompare(right)),
      providerNames: Array.from(new Set(args.sourceParcels.map((item) => item.providerName))),
      unresolvedAreaMemberIds: args.unresolvedAreaMemberIds,
      unresolvedGeometryMemberIds: args.unresolvedGeometryMemberIds,
      resolution: {
        geometry: {
          state: geometryResolution,
          rule: "MERGE_AVAILABLE_MEMBER_GEOMETRIES_ONLY",
          available: Boolean(args.mergedGeom),
        },
        area: {
          state: areaResolution,
          rule: "SUM_RESOLVABLE_MEMBER_AREAS_ONLY",
          available: Boolean(args.combinedAreaSqm),
        },
      },
      confidence: {
        score: args.confidenceScore,
        band: args.confidenceBand,
        ...args.confidenceInputs,
      },
      safeMigration: args.migrationMetadata,
    },
  };
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
    const results = searchSourceParcels(query, municipality, limit);
    if (!results.items.length) {
      return results;
    }

    const existingMatches = await this.prisma.parcel.findMany({
      where: {
        organizationId: this.requestContext.organizationId,
        OR: results.items.map((item) => ({
          sourceProviderName: item.providerName,
          sourceProviderParcelId: item.providerParcelId,
        })),
      },
      select: {
        id: true,
        name: true,
        sourceProviderName: true,
        sourceProviderParcelId: true,
        parcelGroupId: true,
        isGroupSite: true,
        planningParameters: {
          select: {
            id: true,
            valueNumber: true,
            valueBoolean: true,
            valueJson: true,
            geom: true,
          },
        },
        scenarios: {
          select: {
            id: true,
            name: true,
            status: true,
            latestRunAt: true,
          },
          orderBy: [{ latestRunAt: "desc" }, { updatedAt: "desc" }],
          take: 3,
        },
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
    }) satisfies ExistingParcelMatch[];

    const matchesBySourceKey = new Map<string, ExistingParcelMatch[]>();
    for (const match of existingMatches) {
      const key = `${match.sourceProviderName ?? ""}::${match.sourceProviderParcelId ?? ""}`;
      const bucket = matchesBySourceKey.get(key) ?? [];
      bucket.push(match);
      matchesBySourceKey.set(key, bucket);
    }

    return {
      ...results,
      items: results.items.map((item) => {
        const matches = matchesBySourceKey.get(`${item.providerName}::${item.providerParcelId}`) ?? [];
        const groupedMember = matches.find((match) => !match.isGroupSite && Boolean(match.parcelGroupId)) ?? null;
        const standalone = matches.find((match) => !match.isGroupSite && !match.parcelGroupId) ?? null;

        if (groupedMember) {
          return {
            ...item,
            workspaceState: "GROUPED_SITE_MEMBER" as const,
            regroupingEligible: false,
            lockReason: "GROUP_SITE_MEMBERSHIP_STABLE" as const,
            existingParcelId: groupedMember.id,
            existingSite: groupedMember.parcelGroup
              ? {
                  id: groupedMember.parcelGroup.id,
                  name: groupedMember.parcelGroup.siteParcel?.name ?? groupedMember.parcelGroup.name,
                  siteParcelId: groupedMember.parcelGroup.siteParcel?.id ?? groupedMember.parcelGroup.siteParcelId ?? null,
                }
              : null,
            downstreamWork: getDownstreamWorkSummary(groupedMember),
          };
        }

        if (standalone) {
          const downstreamWork = getDownstreamWorkSummary(standalone);
          const locked = downstreamWork.planningValueCount > 0 || downstreamWork.scenarioCount > 0;
          return {
            ...item,
            workspaceState: locked ? "EXISTING_STANDALONE_LOCKED" as const : "EXISTING_STANDALONE_REUSABLE" as const,
            regroupingEligible: true,
            lockReason: locked ? "DOWNSTREAM_WORK_PRESENT" as const : "NONE" as const,
            existingParcelId: standalone.id,
            existingSite: null,
            downstreamWork,
          };
        }

        return {
          ...item,
          workspaceState: "NEW" as const,
          regroupingEligible: true,
          lockReason: "NONE" as const,
          existingParcelId: null,
          existingSite: null,
          downstreamWork: {
            planningValueCount: 0,
            scenarioCount: 0,
            scenarios: [],
          },
        };
      }),
    };
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
        confidenceScore: normalizeConfidenceScore(dto.confidenceScore),
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
      throw buildIntakeBadRequest("EMPTY_SOURCE_SELECTION", "At least one source parcel must be selected.");
    }

    const sourceParcels = getSourceParcelsByIds(sourceParcelIds);
    if (sourceParcels.length !== sourceParcelIds.length) {
      throw buildIntakeBadRequest(
        "SOURCE_RECORD_UNAVAILABLE",
        "One or more selected source parcels are no longer available.",
      );
    }

    const selectionSignature = buildSourceSelectionSignature(sourceParcels);

    if (sourceParcels.length === 1) {
      const sourceParcel = sourceParcels[0];
      const groupedMember = await this.prisma.parcel.findFirst({
        where: {
          organizationId: this.requestContext.organizationId,
          sourceProviderName: sourceParcel.providerName,
          sourceProviderParcelId: sourceParcel.providerParcelId,
          parcelGroupId: { not: null },
          isGroupSite: false,
        },
        include: {
          parcelGroup: {
            include: {
              siteParcel: {
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
              },
            },
          },
        },
      });

      if (groupedMember?.parcelGroup?.siteParcel) {
        const mappedExistingSite = this.mapParcel(groupedMember.parcelGroup.siteParcel);
        return {
          outcome: "REUSED_GROUPED_SITE",
          primaryParcel: mappedExistingSite,
          createdParcels: Array.isArray(groupedMember.parcelGroup.siteParcel.parcelGroup?.parcels)
            ? groupedMember.parcelGroup.siteParcel.parcelGroup.parcels.map((item: any) => this.mapParcel(item))
            : [],
          parcelGroup: mappedExistingSite.parcelGroup,
        };
      }

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
          outcome: "REUSED_STANDALONE_SOURCE_PARCEL",
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
          confidenceScore: normalizeConfidenceScore(sourceParcel.confidenceScore),
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
        outcome: "CREATED_STANDALONE_SOURCE_PARCEL",
        primaryParcel: mappedCreated,
        createdParcels: [mappedCreated],
        parcelGroup: null,
      };
    }

    const existingGroup = await this.prisma.parcelGroup.findFirst({
      where: {
        organizationId: this.requestContext.organizationId,
        sourceReference: selectionSignature,
      },
      include: {
        siteParcel: {
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
        },
      },
    });

    if (existingGroup?.siteParcel) {
      const mappedExistingSite = this.mapParcel(existingGroup.siteParcel);
      return {
        outcome: "REUSED_GROUPED_SITE",
        primaryParcel: mappedExistingSite,
        createdParcels: Array.isArray(existingGroup.siteParcel.parcelGroup?.parcels)
          ? existingGroup.siteParcel.parcelGroup.parcels.map((item: any) => this.mapParcel(item))
          : [],
        parcelGroup: mappedExistingSite.parcelGroup,
      };
    }

    if (!sourceParcels.some((item) => item.hasGeometry || item.hasLandArea)) {
      throw buildIntakeBadRequest(
        "SOURCE_CONTEXT_INCOMPLETE_FOR_GROUP",
        "The selected source parcels do not contain enough geometry or area context to create a grouped site yet.",
      );
    }

    const existingSelectedParcels = await this.prisma.parcel.findMany({
      where: {
        organizationId: this.requestContext.organizationId,
        OR: sourceParcels.map((item) => ({
          sourceProviderName: item.providerName,
          sourceProviderParcelId: item.providerParcelId,
        })),
      },
      select: {
        id: true,
        name: true,
        sourceProviderName: true,
        sourceProviderParcelId: true,
        parcelGroupId: true,
        isGroupSite: true,
        planningParameters: {
          select: {
            id: true,
            valueNumber: true,
            valueBoolean: true,
            valueJson: true,
            geom: true,
          },
        },
        scenarios: {
          select: {
            id: true,
            name: true,
            status: true,
            latestRunAt: true,
          },
          orderBy: [{ latestRunAt: "desc" }, { updatedAt: "desc" }],
          take: 3,
        },
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
    }) satisfies ExistingParcelMatch[];

    const groupedMembers = existingSelectedParcels.filter((item) => !item.isGroupSite && Boolean(item.parcelGroupId));
    if (groupedMembers.length) {
      const site = groupedMembers[0].parcelGroup
        ? {
            id: groupedMembers[0].parcelGroup.id,
            name: groupedMembers[0].parcelGroup.siteParcel?.name ?? groupedMembers[0].parcelGroup.name,
            siteParcelId: groupedMembers[0].parcelGroup.siteParcel?.id ?? groupedMembers[0].parcelGroup.siteParcelId ?? null,
          }
        : null;

      throw buildIntakeConflict(
        "GROUP_MEMBER_ALREADY_ASSIGNED",
        `One or more selected source parcels already belong to ${site?.name ?? "an existing grouped site"}. Reuse that grouped site instead of creating a second site identity.`,
        {
          parcelIds: groupedMembers.map((item) => item.id),
          existingSite: site,
        },
      );
    }

    const existingStandalones = existingSelectedParcels.filter((item) => !item.isGroupSite && !item.parcelGroupId);
    const lockedStandalones = existingStandalones.filter((item) => hasDownstreamWork(item));

    if (lockedStandalones.length > 1) {
      throw buildIntakeConflict(
        "DOWNSTREAM_RECONCILIATION_REQUIRED",
        "Multiple selected source parcels already have planning or scenario work attached. Reconcile those workstreams before forming a grouped site.",
        {
          parcelIds: lockedStandalones.map((item) => item.id),
        },
      );
    }

    const safeMigrationCandidate = lockedStandalones[0] ?? null;
    const standaloneBySourceKey = new Map(
      existingStandalones.map((item) => [`${item.sourceProviderName ?? ""}::${item.sourceProviderParcelId ?? ""}`, item]),
    );

    const mergedGeom = mergeMultiPolygons(sourceParcels.map((item) => item.geom));
    const unresolvedAreaMemberIds = sourceParcels
      .filter((item) => !item.hasLandArea)
      .map((item) => `${item.providerName}::${item.providerParcelId}`);
    const unresolvedGeometryMemberIds = sourceParcels
      .filter((item) => !item.hasGeometry)
      .map((item) => `${item.providerName}::${item.providerParcelId}`);
    const combinedAreaSqm = toNullableDecimalString(
      sourceParcels.reduce((sum, item) => sum + Number(item.landAreaSqm ?? 0), 0),
    );
    const groupedConfidence = computeGroupedConfidence(sourceParcels);
    const siteName = buildGroupName(sourceParcels, dto.siteName);

    const transactionResult = await this.prisma.$transaction(async (transaction) => {
      const initialGroupProvenance = buildGroupDerivedProvenance({
        sourceParcels,
        mergedGeom,
        combinedAreaSqm,
        selectionSignature,
        unresolvedAreaMemberIds,
        unresolvedGeometryMemberIds,
        confidenceScore: groupedConfidence.score,
        confidenceBand: groupedConfidence.band,
        confidenceInputs: groupedConfidence.inputs,
        migrationMetadata: null,
      });

      const parcelGroup = await transaction.parcelGroup.create({
        data: {
          organizationId: this.requestContext.organizationId,
          name: siteName,
          landAreaSqm: combinedAreaSqm,
          sourceType: SourceType.SYSTEM_DERIVED,
          sourceReference: selectionSignature,
          sourceProviderName: "Merged source parcel set",
          confidenceScore: groupedConfidence.score,
          geom: toPrismaJson(mergedGeom),
          centroid: toPrismaJson(calculateMultiPolygonCentroid(mergedGeom)),
          provenanceJson: toPrismaJson(initialGroupProvenance),
        },
      });

      for (const existingStandalone of existingStandalones) {
        await transaction.parcel.update({
          where: { id: existingStandalone.id },
          data: {
            parcelGroupId: parcelGroup.id,
          },
        });
      }

      for (const sourceParcel of sourceParcels) {
        const existingStandalone = standaloneBySourceKey.get(`${sourceParcel.providerName}::${sourceParcel.providerParcelId}`);
        if (existingStandalone) {
          continue;
        }

        await transaction.parcel.create({
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
            confidenceScore: normalizeConfidenceScore(sourceParcel.confidenceScore),
            geom: toPrismaJson(sourceParcel.geom),
            centroid: toPrismaJson(sourceParcel.centroid),
            provenanceJson: toPrismaJson(buildSourceParcelProvenance(sourceParcel)),
          },
        });
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
          districtName: sourceParcels
            .map((item) => item.districtName)
            .filter((item): item is string => Boolean(item))
            .join(", ") || null,
          landAreaSqm: combinedAreaSqm,
          sourceType: SourceType.SYSTEM_DERIVED,
          sourceReference: `parcel-group:${parcelGroup.id}`,
          sourceProviderName: "Merged source parcel set",
          sourceProviderParcelId: null,
          confidenceScore: groupedConfidence.score,
          geom: toPrismaJson(mergedGeom),
          centroid: toPrismaJson(calculateMultiPolygonCentroid(mergedGeom)),
          provenanceJson: toPrismaJson(initialGroupProvenance),
        },
      });

      await transaction.parcelGroup.update({
        where: { id: parcelGroup.id },
        data: { siteParcelId: siteParcel.id },
      });

      let migrationMetadata: Record<string, unknown> | null = null;
      if (safeMigrationCandidate) {
        const planningRecords = await transaction.planningParameter.findMany({
          where: {
            organizationId: this.requestContext.organizationId,
            parcelId: safeMigrationCandidate.id,
          },
          select: { id: true },
        });
        const scenarios = await transaction.scenario.findMany({
          where: {
            organizationId: this.requestContext.organizationId,
            parcelId: safeMigrationCandidate.id,
          },
          select: { id: true },
        });

        await transaction.planningParameter.updateMany({
          where: {
            organizationId: this.requestContext.organizationId,
            parcelId: safeMigrationCandidate.id,
          },
          data: {
            parcelId: siteParcel.id,
            parcelGroupId: parcelGroup.id,
          },
        });

        await transaction.scenario.updateMany({
          where: {
            organizationId: this.requestContext.organizationId,
            parcelId: safeMigrationCandidate.id,
          },
          data: {
            parcelId: siteParcel.id,
            parcelGroupId: parcelGroup.id,
          },
        });

        migrationMetadata = {
          migratedParcelId: safeMigrationCandidate.id,
          migratedPlanningParameterIds: planningRecords.map((item) => item.id),
          migratedScenarioIds: scenarios.map((item) => item.id),
          migratedAt: new Date().toISOString(),
          reason: "SAFE_REGROUP_FROM_STANDALONE_SOURCE_PARCEL",
        };

        const migratedProvenance = buildGroupDerivedProvenance({
          sourceParcels,
          mergedGeom,
          combinedAreaSqm,
          selectionSignature,
          unresolvedAreaMemberIds,
          unresolvedGeometryMemberIds,
          confidenceScore: groupedConfidence.score,
          confidenceBand: groupedConfidence.band,
          confidenceInputs: groupedConfidence.inputs,
          migrationMetadata,
        });

        await transaction.parcelGroup.update({
          where: { id: parcelGroup.id },
          data: { provenanceJson: toPrismaJson(migratedProvenance) },
        });
        await transaction.parcel.update({
          where: { id: siteParcel.id },
          data: { provenanceJson: toPrismaJson(migratedProvenance) },
        });
      }

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
        outcome: safeMigrationCandidate
          ? "CREATED_GROUPED_SITE_WITH_SAFE_MIGRATION" as SourceParcelIntakeOutcome
          : "CREATED_GROUPED_SITE" as SourceParcelIntakeOutcome,
        primaryParcel: this.mapParcel(hydratedSiteParcel),
        createdParcels: Array.isArray(hydratedSiteParcel.parcelGroup?.parcels)
          ? hydratedSiteParcel.parcelGroup.parcels.map((item: any) => this.mapParcel(item))
          : [],
      };
    });

    return {
      outcome: transactionResult.outcome,
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
        confidenceScore: dto.confidenceScore === undefined ? undefined : normalizeConfidenceScore(dto.confidenceScore),
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
    const confidenceScore = normalizeConfidenceScore(parcelGroup.confidenceScore);

    return {
      id: parcelGroup.id,
      name: parcelGroup.name,
      memberCount: memberParcels.length,
      combinedLandAreaSqm: toApiDecimal(parcelGroup.landAreaSqm as never),
      siteParcelId: parcelGroup.siteParcelId ?? null,
      sourceType: parcelGroup.sourceType,
      sourceReference: parcelGroup.sourceReference ?? null,
      confidenceScore,
      confidenceBand: getParcelConfidenceBand(confidenceScore),
    };
  }

  private mapParcel(parcel: any): ParcelDto {
    const provenance = toApiJson(parcel.provenanceJson as never) as ParcelDto["provenance"] | null;
    const confidenceScore = normalizeConfidenceScore(parcel.confidenceScore);
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
          .map((item: any) => {
            const memberConfidenceScore = normalizeConfidenceScore(item.confidenceScore);
            return {
              id: item.id,
              name: item.name,
              cadastralId: item.cadastralId,
              municipalityName: item.municipalityName,
              landAreaSqm: toApiDecimal(item.landAreaSqm as never),
              confidenceScore: memberConfidenceScore,
              confidenceBand: getParcelConfidenceBand(memberConfidenceScore),
              sourceProviderName: item.sourceProviderName ?? null,
              sourceProviderParcelId: item.sourceProviderParcelId ?? null,
              sourceReference: item.sourceReference ?? null,
            };
          })
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
      confidenceScore,
      confidenceBand: getParcelConfidenceBand(confidenceScore),
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
