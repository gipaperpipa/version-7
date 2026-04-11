import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SourceParcelMapBoundsDto,
  SourceParcelSearchResultDto,
} from "../../generated-contracts/parcels";
import { PrismaService } from "../../common/prisma/prisma.service";

type CachedSourceParcelRecord = {
  sourceParcelId: string;
  providerKey: string;
  providerParcelId: string;
  recordJson: unknown;
  fetchedAt: Date;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProviderKeyFromSourceParcelId(sourceParcelId: string) {
  const [providerKey] = sourceParcelId.split(":");
  return providerKey?.trim() || "unknown";
}

function getGeometryBounds(
  geom: SourceParcelSearchResultDto["geom"] | null | undefined,
): SourceParcelMapBoundsDto | null {
  if (!geom || geom.type !== "MultiPolygon") {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const polygon of geom.coordinates) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }
  }

  if (![west, south, east, north].every(Number.isFinite)) {
    return null;
  }

  return { west, south, east, north };
}

function mapCachedRecord(record: CachedSourceParcelRecord): SourceParcelSearchResultDto | null {
  if (!isRecord(record.recordJson)) {
    return null;
  }

  const payload = record.recordJson as unknown as SourceParcelSearchResultDto;
  if (
    typeof payload.id !== "string"
    || typeof payload.providerName !== "string"
    || typeof payload.providerParcelId !== "string"
  ) {
    return null;
  }

  return {
    ...payload,
    rawMetadata: {
      ...(isRecord(payload.rawMetadata) ? payload.rawMetadata : {}),
      cache: {
        providerKey: record.providerKey,
        fetchedAt: record.fetchedAt.toISOString(),
        source: "PERSISTED_SOURCE_PARCEL_CACHE",
      },
    },
  };
}

@Injectable()
export class SourceParcelCacheService {
  private readonly ttlMinutes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const configuredTtl = Number(this.configService.get<string>("SOURCE_PARCEL_CACHE_TTL_MINUTES"));
    this.ttlMinutes = Number.isFinite(configuredTtl) && configuredTtl > 0
      ? Math.round(configuredTtl)
      : 24 * 60;
  }

  async getFreshByIds(sourceParcelIds: string[]) {
    return this.getByIds(sourceParcelIds, true);
  }

  async getAnyByIds(sourceParcelIds: string[]) {
    return this.getByIds(sourceParcelIds, false);
  }

  async getFreshByBounds(providerKey: string, bounds: SourceParcelMapBoundsDto, limit = 120) {
    return this.getByBounds(providerKey, bounds, limit, true);
  }

  async getAnyByBounds(providerKey: string, bounds: SourceParcelMapBoundsDto, limit = 120) {
    return this.getByBounds(providerKey, bounds, limit, false);
  }

  async upsertMany(records: SourceParcelSearchResultDto[]) {
    if (!records.length) {
      return;
    }

    await this.prisma.$transaction(
      records.map((record) => {
        const providerKey = getProviderKeyFromSourceParcelId(record.id);
        const bounds = getGeometryBounds(record.geom);

        return this.prisma.sourceParcelCache.upsert({
          where: { sourceParcelId: record.id },
          update: {
            providerKey,
            providerName: record.providerName,
            providerParcelId: record.providerParcelId,
            sourceAuthority: record.sourceAuthority,
            bboxWest: bounds?.west ?? null,
            bboxSouth: bounds?.south ?? null,
            bboxEast: bounds?.east ?? null,
            bboxNorth: bounds?.north ?? null,
            recordJson: record as never,
            fetchedAt: new Date(),
          },
          create: {
            providerKey,
            sourceParcelId: record.id,
            providerName: record.providerName,
            providerParcelId: record.providerParcelId,
            sourceAuthority: record.sourceAuthority,
            bboxWest: bounds?.west ?? null,
            bboxSouth: bounds?.south ?? null,
            bboxEast: bounds?.east ?? null,
            bboxNorth: bounds?.north ?? null,
            recordJson: record as never,
            fetchedAt: new Date(),
          },
        });
      }),
    );
  }

  private async getByIds(sourceParcelIds: string[], freshOnly: boolean) {
    const trimmedIds = Array.from(new Set(sourceParcelIds.map((item) => item.trim()).filter(Boolean)));
    if (!trimmedIds.length) {
      return [];
    }

    const records = await this.prisma.sourceParcelCache.findMany({
      where: {
        sourceParcelId: { in: trimmedIds },
        ...(freshOnly ? { fetchedAt: { gte: this.getFreshCutoff() } } : {}),
      },
      select: {
        sourceParcelId: true,
        providerKey: true,
        providerParcelId: true,
        recordJson: true,
        fetchedAt: true,
      },
    });

    const mapped = new Map(
      records
        .map((record) => [record.sourceParcelId, mapCachedRecord(record)] as const)
        .filter((entry): entry is readonly [string, SourceParcelSearchResultDto] => Boolean(entry[1])),
    );

    return trimmedIds
      .map((sourceParcelId) => mapped.get(sourceParcelId) ?? null)
      .filter((item): item is SourceParcelSearchResultDto => Boolean(item));
  }

  private async getByBounds(
    providerKey: string,
    bounds: SourceParcelMapBoundsDto,
    limit: number,
    freshOnly: boolean,
  ) {
    const records = await this.prisma.sourceParcelCache.findMany({
      where: {
        providerKey,
        bboxWest: { lte: bounds.east },
        bboxEast: { gte: bounds.west },
        bboxSouth: { lte: bounds.north },
        bboxNorth: { gte: bounds.south },
        ...(freshOnly ? { fetchedAt: { gte: this.getFreshCutoff() } } : {}),
      },
      select: {
        sourceParcelId: true,
        providerKey: true,
        providerParcelId: true,
        recordJson: true,
        fetchedAt: true,
      },
      orderBy: [
        { fetchedAt: "desc" },
        { providerParcelId: "asc" },
      ],
      take: Math.max(1, Math.min(limit, 200)),
    });

    return records
      .map((record) => mapCachedRecord(record))
      .filter((item): item is SourceParcelSearchResultDto => Boolean(item));
  }

  private getFreshCutoff() {
    return new Date(Date.now() - this.ttlMinutes * 60 * 1000);
  }
}
