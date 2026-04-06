import { calculateMultiPolygonAreaSqm } from "../../common/geo/geometry-metrics";
import { normalizePolygonGeometryToMultiPolygon } from "../../common/geo/polygon-normalization";
import type { PointDto, PolygonalGeometryDto } from "../../generated-contracts/common";
import {
  buildNormalizedSourceSearchResult,
  normalizeConfidenceScore,
  toNullableDecimalString,
  type NormalizedSourceParcelRecord,
} from "./source-parcel-model";
import {
  SourceParcelProviderError,
  type SourceParcelProvider,
} from "./source-parcel-provider";

type HessenCadastreProviderConfig = {
  baseUrl: string;
  collectionId: string;
  userAgent: string;
  timeoutMs: number;
  bboxRadiusMeters: number;
  bboxWest: number;
  bboxSouth: number;
  bboxEast: number;
  bboxNorth: number;
  maxSeedCount: number;
};

type GeoJsonFeature = {
  id?: string | number;
  geometry?: PolygonalGeometryDto | null;
  properties?: Record<string, unknown> | null;
};

type GeoJsonFeatureCollection = {
  type?: string;
  features?: GeoJsonFeature[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFeatureCollection(value: unknown): value is GeoJsonFeatureCollection {
  return isRecord(value) && Array.isArray(value.features);
}

function isFeature(value: unknown): value is GeoJsonFeature {
  return isRecord(value);
}

function buildSourceId(featureId: string) {
  return `hessen-alkis:${encodeURIComponent(featureId)}`;
}

function decodeSourceId(sourceParcelId: string) {
  if (!sourceParcelId.startsWith("hessen-alkis:")) {
    return null;
  }

  return decodeURIComponent(sourceParcelId.replace(/^hessen-alkis:/, ""));
}

function normalizeGeometry(geometry: PolygonalGeometryDto | null | undefined) {
  const normalized = normalizePolygonGeometryToMultiPolygon(geometry ?? null);
  return normalized?.type === "MultiPolygon" ? normalized : null;
}

function toPoint(lon: number, lat: number): PointDto {
  return { type: "Point", coordinates: [lon, lat] };
}

function isPoint(value: PointDto | null | undefined): value is PointDto {
  return Boolean(value?.coordinates?.length === 2);
}

function isInsideBounds(point: PointDto, config: HessenCadastreProviderConfig) {
  const [lon, lat] = point.coordinates;
  return lon >= config.bboxWest
    && lon <= config.bboxEast
    && lat >= config.bboxSouth
    && lat <= config.bboxNorth;
}

function metersToLatitudeDegrees(meters: number) {
  return meters / 111_320;
}

function metersToLongitudeDegrees(meters: number, latitude: number) {
  const safeCosine = Math.max(0.2, Math.cos((latitude * Math.PI) / 180));
  return meters / (111_320 * safeCosine);
}

function buildBbox(point: PointDto, radiusMeters: number) {
  const [lon, lat] = point.coordinates;
  const latDelta = metersToLatitudeDegrees(radiusMeters);
  const lonDelta = metersToLongitudeDegrees(radiusMeters, lat);
  return {
    west: lon - lonDelta,
    south: lat - latDelta,
    east: lon + lonDelta,
    north: lat + latDelta,
  };
}

function pointDistanceScore(left: PointDto, right: PointDto) {
  const [leftLon, leftLat] = left.coordinates;
  const [rightLon, rightLat] = right.coordinates;
  const lonDelta = leftLon - rightLon;
  const latDelta = leftLat - rightLat;
  return Math.sqrt(lonDelta * lonDelta + latDelta * latDelta);
}

function getScalarValue(properties: Record<string, unknown>, pattern: RegExp) {
  const entry = Object.entries(properties).find(([key]) => pattern.test(key));
  const value = entry?.[1];
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function parseArea(properties: Record<string, unknown>) {
  const areaKeys = [
    /amtliche.*flaeche/i,
    /flaeche/i,
    /landparcel.*area/i,
    /area/i,
  ];

  for (const keyPattern of areaKeys) {
    const raw = getScalarValue(properties, keyPattern);
    if (!raw) continue;
    const normalized = Number(String(raw).replace(",", ".").replace(/[^0-9.-]/g, ""));
    if (Number.isFinite(normalized) && normalized > 0) {
      return toNullableDecimalString(normalized);
    }
  }

  return null;
}

function buildCadastralId(properties: Record<string, unknown>, featureId: string) {
  const direct = [
    /flurstueckskennzeichen/i,
    /flurstueck.*kennzeichen/i,
    /landparcelidentifier/i,
    /flurstuecksnummer/i,
  ]
    .map((pattern) => getScalarValue(properties, pattern))
    .find((value): value is string => Boolean(value));
  if (direct) {
    return direct;
  }

  const gemarkung = getScalarValue(properties, /gemarkung/i);
  const flur = getScalarValue(properties, /flur/i);
  const zaehler = getScalarValue(properties, /zaehler/i);
  const nenner = getScalarValue(properties, /nenner/i);
  if (gemarkung || flur || zaehler || nenner) {
    const primary = [gemarkung, flur].filter(Boolean).join("-");
    const parcelNumber = [zaehler, nenner].filter(Boolean).join("/");
    return [primary, parcelNumber].filter(Boolean).join("-");
  }

  return featureId;
}

function getMunicipality(properties: Record<string, unknown>) {
  return getScalarValue(properties, /gemeinde|municipality|ortschaft|stadt/i);
}

function getDistrict(properties: Record<string, unknown>) {
  return getScalarValue(properties, /gemarkung|stadtteil|district|bezirk/i);
}

function getAddressLine(properties: Record<string, unknown>) {
  return getScalarValue(properties, /lagebezeichnung|anschrift|address|lage/i);
}

function computeConfidenceScore(args: {
  hasGeometry: boolean;
  hasLandArea: boolean;
  municipalityName: string | null;
  districtName: string | null;
  cadastralId: string | null;
}) {
  let score = args.hasGeometry ? 94 : 74;
  if (args.hasLandArea) score += 3;
  if (args.municipalityName) score += 2;
  if (args.districtName) score += 1;
  if (args.cadastralId) score += 2;
  return Math.max(72, Math.min(98, normalizeConfidenceScore(score) ?? 72));
}

export class SourceParcelHessenCadastreProvider implements SourceParcelProvider {
  readonly key = "hessen-alkis";
  readonly kind = "REAL" as const;

  constructor(
    private readonly config: HessenCadastreProviderConfig,
    private readonly searchSeedProvider: Pick<SourceParcelProvider, "search">,
  ) {}

  canHandleSourceParcelId(sourceParcelId: string) {
    return sourceParcelId.startsWith("hessen-alkis:");
  }

  async search(query?: string | null, municipality?: string | null, limit = 12) {
    const seedResults = await this.searchSeedProvider.search(query, municipality, Math.max(1, Math.min(this.config.maxSeedCount, limit)));
    const hessenSeeds = seedResults
      .filter((item) => isPoint(item.centroid))
      .filter((item) => isInsideBounds(item.centroid!, this.config));

    if (!hessenSeeds.length) {
      return [];
    }

    const deduped = new Map<string, { record: NormalizedSourceParcelRecord; distance: number }>();

    for (const seed of hessenSeeds) {
      const bbox = buildBbox(seed.centroid!, this.config.bboxRadiusMeters);
      const url = new URL(`/collections/${encodeURIComponent(this.config.collectionId)}/items`, this.withTrailingSlash(this.config.baseUrl));
      url.searchParams.set("f", "json");
      url.searchParams.set("limit", String(Math.max(5, Math.min(limit * 2, 20))));
      url.searchParams.set("bbox", [bbox.west, bbox.south, bbox.east, bbox.north].join(","));

      const json = await this.fetchJson(url);
      if (!isFeatureCollection(json)) {
        throw new SourceParcelProviderError(
          "SOURCE_PROVIDER_LOOKUP_FAILED",
          this.key,
          "Hessen cadastre provider returned an unexpected search payload.",
        );
      }

      for (const feature of json.features ?? []) {
        const mapped = this.mapFeature(feature, seed);
        if (!mapped || !isPoint(mapped.centroid) || !isPoint(seed.centroid)) {
          continue;
        }

        const distance = pointDistanceScore(mapped.centroid, seed.centroid);
        const existing = deduped.get(mapped.id);
        if (!existing || distance < existing.distance) {
          deduped.set(mapped.id, { record: mapped, distance });
        }
      }
    }

    return Array.from(deduped.values())
      .sort((left, right) => {
        const confidenceDiff = (right.record.confidenceScore ?? 0) - (left.record.confidenceScore ?? 0);
        if (confidenceDiff !== 0) return confidenceDiff;
        return left.distance - right.distance;
      })
      .slice(0, Math.max(1, Math.min(limit, 25)))
      .map((item) => item.record);
  }

  getSupportedRegions() {
    return [
      {
        id: "hessen-alkis",
        name: "Hessen parcel-grade selection",
        providerName: "Hessen ALKIS Flurstueck",
        description: "Parcel-grade map selection is supported inside the Hessen ALKIS coverage area only.",
        sourceAuthority: "CADASTRAL_GRADE" as const,
        bounds: {
          west: this.config.bboxWest,
          south: this.config.bboxSouth,
          east: this.config.bboxEast,
          north: this.config.bboxNorth,
        },
      },
    ];
  }

  async searchByBounds(bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  }, limit = 120) {
    const url = new URL(`/collections/${encodeURIComponent(this.config.collectionId)}/items`, this.withTrailingSlash(this.config.baseUrl));
    url.searchParams.set("f", "json");
    url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 200))));
    url.searchParams.set("bbox", [bounds.west, bounds.south, bounds.east, bounds.north].join(","));

    const json = await this.fetchJson(url);
    if (!isFeatureCollection(json)) {
      throw new SourceParcelProviderError(
        "SOURCE_PROVIDER_LOOKUP_FAILED",
        this.key,
        "Hessen cadastre provider returned an unexpected map preview payload.",
      );
    }

    return (json.features ?? [])
      .map((feature) => this.mapFeature(feature, null))
      .filter((item): item is NormalizedSourceParcelRecord => Boolean(item && item.geom))
      .sort((left, right) => {
        const confidenceDiff = (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0);
        if (confidenceDiff !== 0) return confidenceDiff;
        return left.providerParcelId.localeCompare(right.providerParcelId);
      })
      .slice(0, Math.max(1, Math.min(limit, 200)));
  }

  async getByIds(sourceParcelIds: string[]) {
    const featureIds = sourceParcelIds
      .map((item) => decodeSourceId(item.trim()))
      .filter((item): item is string => Boolean(item));

    if (!featureIds.length) {
      return [];
    }

    const results: NormalizedSourceParcelRecord[] = [];
    for (const featureId of featureIds) {
      const url = new URL(
        `/collections/${encodeURIComponent(this.config.collectionId)}/items/${encodeURIComponent(featureId)}`,
        this.withTrailingSlash(this.config.baseUrl),
      );
      url.searchParams.set("f", "json");
      const json = await this.fetchJson(url);
      if (!isFeature(json)) {
        throw new SourceParcelProviderError(
          "SOURCE_PROVIDER_LOOKUP_FAILED",
          this.key,
          "Hessen cadastre provider returned an unexpected parcel lookup payload.",
        );
      }

      const mapped = this.mapFeature(json, null);
      if (mapped) {
        results.push(mapped);
      }
    }

    const byId = new Map(results.map((item) => [item.id, item]));
    return sourceParcelIds
      .map((item) => byId.get(item) ?? null)
      .filter((item): item is NormalizedSourceParcelRecord => Boolean(item));
  }

  private withTrailingSlash(baseUrl: string) {
    return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  }

  private async fetchJson(url: URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/geo+json,application/json",
          "User-Agent": this.config.userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SourceParcelProviderError(
          response.status === 404 ? "SOURCE_PROVIDER_LOOKUP_FAILED" : "SOURCE_PROVIDER_UNAVAILABLE",
          this.key,
          `Hessen cadastre provider returned ${response.status} ${response.statusText}.`,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof SourceParcelProviderError) {
        throw error;
      }

      throw new SourceParcelProviderError(
        "SOURCE_PROVIDER_UNAVAILABLE",
        this.key,
        "Hessen cadastre provider is currently unavailable.",
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapFeature(feature: GeoJsonFeature, searchSeed: NormalizedSourceParcelRecord | null) {
    const featureId = feature.id != null ? String(feature.id) : null;
    if (!featureId) {
      return null;
    }

    const properties = isRecord(feature.properties) ? feature.properties : {};
    const geom = normalizeGeometry(feature.geometry);
    const cadastralId = buildCadastralId(properties, featureId);
    const sourceAreaSqm = parseArea(properties);
    const resolvedAreaSqm = sourceAreaSqm ?? toNullableDecimalString(calculateMultiPolygonAreaSqm(geom));
    const municipalityName = getMunicipality(properties) ?? searchSeed?.municipalityName ?? searchSeed?.city ?? null;
    const districtName = getDistrict(properties) ?? searchSeed?.districtName ?? null;
    const addressLine1 = getAddressLine(properties) ?? searchSeed?.addressLine1 ?? null;
    const centroid = geom ? undefined : searchSeed?.centroid ?? null;
    const confidenceScore = computeConfidenceScore({
      hasGeometry: Boolean(geom),
      hasLandArea: Boolean(resolvedAreaSqm),
      municipalityName,
      districtName,
      cadastralId,
    });

    return buildNormalizedSourceSearchResult({
      id: buildSourceId(featureId),
      providerName: "Hessen ALKIS Flurstueck",
      providerParcelId: cadastralId,
      sourceAuthority: "CADASTRAL_GRADE",
      displayName: municipalityName && cadastralId ? `${municipalityName} ${cadastralId}` : cadastralId,
      cadastralId,
      addressLine1,
      city: municipalityName,
      postalCode: searchSeed?.postalCode ?? null,
      stateCode: "HE",
      countryCode: "DE",
      municipalityName,
      districtName,
      landAreaSqm: resolvedAreaSqm,
      confidenceScore,
      geom,
      centroid: centroid ?? undefined,
      rawMetadata: {
        sourceSystem: "hessen-alkis-ogc-api-features",
        providerKind: "REAL",
        sourceAuthority: "CADASTRAL_GRADE",
        providerFeatureId: featureId,
        providerCollection: this.config.collectionId,
        providerBaseUrl: this.config.baseUrl,
        sourceAreaSqm,
        resolvedAreaSource: sourceAreaSqm ? "PROVIDER_AREA_FIELD" : resolvedAreaSqm ? "GEOMETRY_DERIVED" : null,
        geometryResolution: geom ? "CADASTRAL_FEATURE_GEOMETRY" : "GEOMETRY_NOT_RETURNED",
        geometryAuthority: geom ? "PARCEL_GRADE" : "NONE",
        searchSeed: searchSeed
          ? {
              id: searchSeed.id,
              providerName: searchSeed.providerName,
              providerParcelId: searchSeed.providerParcelId,
              displayName: searchSeed.displayName,
            }
          : null,
        coverage: "HESSEN_ONLY",
        providerPropertyKeys: Object.keys(properties).sort(),
        providerParcelAttributes: {
          cadastralId,
          municipalityName,
          districtName,
          addressLine1,
        },
      },
    });
  }
}
