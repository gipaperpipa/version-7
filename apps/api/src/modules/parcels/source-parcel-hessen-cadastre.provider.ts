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
  apiBaseUrl: string;
  collectionId: string;
  wfsBaseUrl: string;
  wfsTypeName: string;
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
  bbox?: [number, number, number, number] | null;
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

function getFeatureId(feature: GeoJsonFeature, properties: Record<string, unknown>) {
  if (feature.id != null) {
    return String(feature.id);
  }

  return getScalarValue(properties, /gml_id|localid|nationalcadastralreference/i);
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

function getCadastralLabel(properties: Record<string, unknown>) {
  return getScalarValue(properties, /label|flurstuecksnummer|cadastral/i);
}

function getStableParcelReference(properties: Record<string, unknown>, featureId: string) {
  return getScalarValue(properties, /nationalcadastralreference|localid|gml_id/i) ?? featureId;
}

function parseArea(properties: Record<string, unknown>) {
  const rawValue = getScalarValue(properties, /areavalue|flaeche|area/i);
  if (!rawValue) {
    return null;
  }

  const numeric = Number(String(rawValue).replace(",", ".").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? toNullableDecimalString(numeric) : null;
}

function parsePositionPoint(properties: Record<string, unknown>) {
  const rawPosition = getScalarValue(properties, /pos/i);
  if (!rawPosition) {
    return null;
  }

  const parts = rawPosition
    .split(/\s+/)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
  if (parts.length !== 2) {
    return null;
  }

  const [latitude, longitude] = parts;
  return toPoint(longitude, latitude);
}

function computeConfidenceScore(args: {
  hasGeometry: boolean;
  hasLandArea: boolean;
  municipalityName: string | null;
  districtName: string | null;
  cadastralReference: string | null;
}) {
  let score = args.hasGeometry ? 95 : 74;
  if (args.hasLandArea) score += 3;
  if (args.municipalityName) score += 1;
  if (args.districtName) score += 1;
  if (args.cadastralReference) score += 1;
  return Math.max(74, Math.min(99, normalizeConfidenceScore(score) ?? 74));
}

function stripMarkup(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    const seedResults = await this.searchSeedProvider.search(
      query,
      municipality,
      Math.max(1, Math.min(this.config.maxSeedCount, limit)),
    );
    const hessenSeeds = seedResults
      .filter((item) => isPoint(item.centroid))
      .filter((item) => isInsideBounds(item.centroid!, this.config));

    if (!hessenSeeds.length) {
      return [];
    }

    const deduped = new Map<string, { record: NormalizedSourceParcelRecord; distance: number }>();

    for (const seed of hessenSeeds) {
      const bbox = buildBbox(seed.centroid!, this.config.bboxRadiusMeters);
      const json = await this.fetchWfsFeatureCollection(bbox, Math.max(5, Math.min(limit * 2, 20)));
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
        description: "Parcel-grade map selection is supported inside the Hessen INSPIRE cadastral coverage area only.",
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

  async searchByBounds(
    bounds: {
      west: number;
      south: number;
      east: number;
      north: number;
    },
    limit = 120,
  ) {
    const json = await this.fetchWfsFeatureCollection(bounds, limit);

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
      const json = await this.fetchApiFeature(featureId);
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

  private buildApiItemUrl(featureId: string) {
    const baseUrl = this.config.apiBaseUrl.trim().replace(/\/+$/, "");
    const url = new URL(`${baseUrl}/collections/${this.config.collectionId}/items/${encodeURIComponent(featureId)}`);
    url.searchParams.set("f", "json");
    return url;
  }

  private buildWfsUrl(
    bounds: {
      west: number;
      south: number;
      east: number;
      north: number;
    },
    limit: number,
    outputFormat?: string | null,
  ) {
    const url = new URL(this.config.wfsBaseUrl);
    url.searchParams.set("service", "WFS");
    url.searchParams.set("version", "2.0.0");
    url.searchParams.set("request", "GetFeature");
    url.searchParams.set("typeNames", this.config.wfsTypeName);
    url.searchParams.set("count", String(Math.max(1, Math.min(limit, 200))));
    url.searchParams.set("bbox", [bounds.west, bounds.south, bounds.east, bounds.north, "EPSG:4326"].join(","));
    url.searchParams.set("srsName", "EPSG:4326");
    if (outputFormat) {
      url.searchParams.set("outputFormat", outputFormat);
    }
    return url;
  }

  private async fetchApiFeature(featureId: string) {
    const url = this.buildApiItemUrl(featureId);
    const payload = await this.fetchJson(url, "Hessen cadastral parcel lookup is currently unavailable.");
    if (!isFeature(payload)) {
      throw new SourceParcelProviderError(
        "SOURCE_PROVIDER_LOOKUP_FAILED",
        this.key,
        "Hessen cadastre provider returned an unexpected parcel lookup payload.",
      );
    }

    return payload;
  }

  private async fetchWfsFeatureCollection(
    bounds: {
      west: number;
      south: number;
      east: number;
      north: number;
    },
    limit: number,
  ) {
    const candidates = [
      {
        outputFormat: "application/json",
        accept: "application/json,application/geo+json",
      },
      {
        outputFormat: "application/geo+json",
        accept: "application/geo+json,application/json",
      },
      {
        outputFormat: null,
        accept: "application/json,application/geo+json,application/gml+xml;q=0.5",
      },
    ] as const;

    let lastError: SourceParcelProviderError | null = null;
    for (const candidate of candidates) {
      try {
        const payload = await this.fetchJson(
          this.buildWfsUrl(bounds, limit, candidate.outputFormat),
          "Hessen cadastral parcel preview is currently unavailable.",
          candidate.accept,
        );
        if (!isFeatureCollection(payload)) {
          throw new SourceParcelProviderError(
            "SOURCE_PROVIDER_LOOKUP_FAILED",
            this.key,
            "Hessen cadastre provider returned an unexpected parcel preview payload.",
          );
        }

        return payload;
      } catch (error) {
        if (!(error instanceof SourceParcelProviderError)) {
          throw error;
        }

        lastError = error;
      }
    }

    throw (
      lastError
      ?? new SourceParcelProviderError(
        "SOURCE_PROVIDER_UNAVAILABLE",
        this.key,
        "Hessen cadastral parcel preview is currently unavailable.",
      )
    );
  }

  private async fetchJson(url: URL, fallbackMessage: string, accept = "application/json,application/geo+json") {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: accept,
          "User-Agent": this.config.userAgent,
        },
        signal: controller.signal,
      });

      const rawBody = await response.text();
      if (!response.ok) {
        throw new SourceParcelProviderError(
          response.status === 404 ? "SOURCE_PROVIDER_LOOKUP_FAILED" : "SOURCE_PROVIDER_UNAVAILABLE",
          this.key,
          stripMarkup(rawBody) || `Hessen cadastre provider returned ${response.status} ${response.statusText}.`,
          response.status,
        );
      }

      try {
        return JSON.parse(rawBody);
      } catch {
        throw new SourceParcelProviderError(
          "SOURCE_PROVIDER_LOOKUP_FAILED",
          this.key,
          stripMarkup(rawBody) || "Hessen cadastre provider returned malformed JSON.",
          response.status,
        );
      }
    } catch (error) {
      if (error instanceof SourceParcelProviderError) {
        throw error;
      }

      throw new SourceParcelProviderError(
        "SOURCE_PROVIDER_UNAVAILABLE",
        this.key,
        fallbackMessage,
        undefined,
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapFeature(feature: GeoJsonFeature, searchSeed: NormalizedSourceParcelRecord | null) {
    const properties = isRecord(feature.properties) ? feature.properties : {};
    const featureId = getFeatureId(feature, properties);
    if (!featureId) {
      return null;
    }

    const geom = normalizeGeometry(feature.geometry);
    const stableReference = getStableParcelReference(properties, featureId);
    const cadastralLabel = getCadastralLabel(properties) ?? stableReference;
    const sourceAreaSqm = parseArea(properties);
    const resolvedAreaSqm = sourceAreaSqm ?? toNullableDecimalString(calculateMultiPolygonAreaSqm(geom));
    const municipalityName = getMunicipality(properties) ?? searchSeed?.municipalityName ?? searchSeed?.city ?? null;
    const districtName = getDistrict(properties) ?? searchSeed?.districtName ?? null;
    const addressLine1 = getAddressLine(properties) ?? searchSeed?.addressLine1 ?? null;
    const centroid = geom ? undefined : parsePositionPoint(properties) ?? searchSeed?.centroid ?? null;
    const confidenceScore = computeConfidenceScore({
      hasGeometry: Boolean(geom),
      hasLandArea: Boolean(resolvedAreaSqm),
      municipalityName,
      districtName,
      cadastralReference: stableReference,
    });

    return buildNormalizedSourceSearchResult({
      id: buildSourceId(featureId),
      providerName: "Hessen ALKIS Flurstueck",
      providerParcelId: stableReference,
      sourceAuthority: "CADASTRAL_GRADE",
      displayName: municipalityName && cadastralLabel ? `${municipalityName} ${cadastralLabel}` : cadastralLabel,
      cadastralId: cadastralLabel,
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
        sourceSystem: "hessen-inspire-cadastralparcel",
        providerKind: "REAL",
        sourceAuthority: "CADASTRAL_GRADE",
        providerFeatureId: featureId,
        providerCollection: this.config.collectionId,
        providerBaseUrl: this.config.apiBaseUrl,
        wfsBaseUrl: this.config.wfsBaseUrl,
        sourceAreaSqm,
        resolvedAreaSource: sourceAreaSqm ? "PROVIDER_AREA_FIELD" : resolvedAreaSqm ? "GEOMETRY_DERIVED" : null,
        geometryResolution: geom ? "CADASTRAL_FEATURE_GEOMETRY" : "GEOMETRY_NOT_RETURNED",
        geometryAuthority: geom ? "PARCEL_GRADE" : "NONE",
        inspireIdentifier: getScalarValue(properties, /identifier/i),
        localId: getScalarValue(properties, /localid/i),
        nationalCadastralReference: getScalarValue(properties, /nationalcadastralreference/i),
        label: getScalarValue(properties, /label/i),
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
      },
    });
  }
}
