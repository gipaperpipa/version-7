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

type NominatimResult = {
  osm_type?: string;
  osm_id?: number | string;
  display_name?: string;
  name?: string;
  category?: string;
  type?: string;
  importance?: number | string;
  place_rank?: number | string;
  address?: Record<string, string>;
  geojson?: PolygonalGeometryDto | null;
  extratags?: Record<string, string>;
  lat?: string;
  lon?: string;
};

export type NominatimSourceParcelProviderConfig = {
  baseUrl: string;
  userAgent: string;
  email: string | null;
  countryCodes: string | null;
  acceptLanguage: string;
  timeoutMs: number;
};

function normalizeOsmType(osmType: string | undefined) {
  switch ((osmType ?? "").toLowerCase()) {
    case "node":
    case "n":
      return "N";
    case "way":
    case "w":
      return "W";
    case "relation":
    case "r":
      return "R";
    default:
      return null;
  }
}

function buildProviderParcelId(result: NominatimResult) {
  const normalizedType = normalizeOsmType(result.osm_type);
  const osmId = result.osm_id != null ? String(result.osm_id) : null;
  if (!normalizedType || !osmId) return null;
  return `${normalizedType}${osmId}`;
}

function normalizeGeometry(geojson: PolygonalGeometryDto | null | undefined) {
  const normalized = normalizePolygonGeometryToMultiPolygon(geojson ?? null);
  return normalized?.type === "MultiPolygon" ? normalized : null;
}

function getAddressLine1(address: Record<string, string> | undefined) {
  if (!address) return null;
  const road = address.road ?? address.pedestrian ?? address.residential ?? address.footway ?? address.cycleway ?? null;
  const houseNumber = address.house_number ?? null;
  if (road && houseNumber) return `${road} ${houseNumber}`;
  return road ?? address.amenity ?? address.building ?? null;
}

function getMunicipality(address: Record<string, string> | undefined) {
  if (!address) return null;
  return address.city ?? address.town ?? address.village ?? address.municipality ?? address.county ?? null;
}

function getDistrict(address: Record<string, string> | undefined) {
  if (!address) return null;
  return address.suburb ?? address.city_district ?? address.borough ?? address.quarter ?? address.neighbourhood ?? address.county ?? null;
}

function getGermanStateCode(address: Record<string, string> | undefined) {
  const state = (address?.state ?? "").trim().toLowerCase();
  switch (state) {
    case "hessen":
      return "HE";
    case "berlin":
      return "BE";
    case "hamburg":
      return "HH";
    case "bayern":
      return "BY";
    case "baden-württemberg":
      return "BW";
    case "nordrhein-westfalen":
      return "NW";
    case "niedersachsen":
      return "NI";
    case "rheinland-pfalz":
      return "RP";
    case "saarland":
      return "SL";
    case "schleswig-holstein":
      return "SH";
    case "brandenburg":
      return "BB";
    case "mecklenburg-vorpommern":
      return "MV";
    case "sachsen":
      return "SN";
    case "sachsen-anhalt":
      return "ST";
    case "thüringen":
      return "TH";
    case "bremen":
      return "HB";
    default:
      return null;
  }
}

function getLatLonCentroid(result: NominatimResult): PointDto | null {
  const lat = Number(result.lat);
  const lon = Number(result.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return null;
  }

  return { type: "Point", coordinates: [lon, lat] };
}

function computeConfidenceScore(result: NominatimResult, geomAvailable: boolean, areaAvailable: boolean) {
  const providerParcelId = buildProviderParcelId(result);
  const normalizedImportance = Number(result.importance ?? 0);
  const placeRank = Number(result.place_rank ?? 0);
  const category = (result.category ?? "").toLowerCase();
  const type = (result.type ?? "").toLowerCase();
  const address = result.address ?? {};
  let score = geomAvailable ? 64 : 42;

  if (providerParcelId?.startsWith("R") || providerParcelId?.startsWith("W")) {
    score += 6;
  } else if (providerParcelId?.startsWith("N")) {
    score -= 4;
  }

  if (areaAvailable) score += 8;
  if (address.road || address.house_number) score += 5;
  if (getMunicipality(address)) score += 4;
  if (["building", "landuse", "boundary", "place"].includes(category)) score += 4;
  if (["house", "residential", "industrial", "commercial", "administrative"].includes(type)) score += 3;
  if (placeRank >= 26) score += 3;
  if (Number.isFinite(normalizedImportance)) score += Math.min(6, Math.round(normalizedImportance * 10));

  return Math.max(28, Math.min(82, normalizeConfidenceScore(score) ?? 28));
}

function isRecordArray(value: unknown): value is NominatimResult[] {
  return Array.isArray(value);
}

export class SourceParcelNominatimProvider implements SourceParcelProvider {
  readonly key = "nominatim";
  readonly kind = "REAL" as const;

  constructor(private readonly config: NominatimSourceParcelProviderConfig) {}

  canHandleSourceParcelId(sourceParcelId: string) {
    return sourceParcelId.startsWith("nominatim:");
  }

  async search(query?: string | null, municipality?: string | null, limit = 12) {
    const trimmedQuery = query?.trim() ?? "";
    const trimmedMunicipality = municipality?.trim() ?? "";

    if (!trimmedQuery && !trimmedMunicipality) {
      return [];
    }

    const q = [trimmedQuery, trimmedMunicipality].filter(Boolean).join(", ");
    const url = new URL("/search", this.config.baseUrl.endsWith("/") ? this.config.baseUrl : `${this.config.baseUrl}/`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", q);
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("polygon_geojson", "1");
    url.searchParams.set("dedupe", "1");
    url.searchParams.set("limit", String(Math.max(1, Math.min(limit, 25))));
    if (this.config.countryCodes) url.searchParams.set("countrycodes", this.config.countryCodes);
    if (this.config.acceptLanguage) url.searchParams.set("accept-language", this.config.acceptLanguage);
    if (this.config.email) url.searchParams.set("email", this.config.email);

    const results = await this.fetchNominatim(url);
    return results
      .map((result) => this.mapResult(result, "search"))
      .filter((item): item is NormalizedSourceParcelRecord => Boolean(item))
      .sort((left, right) => (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0))
      .slice(0, Math.max(1, Math.min(limit, 25)));
  }

  async getByIds(sourceParcelIds: string[]) {
    const providerIds = sourceParcelIds
      .map((item) => item.trim())
      .filter((item) => this.canHandleSourceParcelId(item))
      .map((item) => item.replace(/^nominatim:/, ""))
      .filter(Boolean);

    if (!providerIds.length) {
      return [];
    }

    const url = new URL("/lookup", this.config.baseUrl.endsWith("/") ? this.config.baseUrl : `${this.config.baseUrl}/`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("osm_ids", providerIds.join(","));
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("polygon_geojson", "1");
    if (this.config.acceptLanguage) url.searchParams.set("accept-language", this.config.acceptLanguage);
    if (this.config.email) url.searchParams.set("email", this.config.email);

    const results = await this.fetchNominatim(url);
    const mapped = results
      .map((result) => this.mapResult(result, "lookup"))
      .filter((item): item is NormalizedSourceParcelRecord => Boolean(item));
    const byId = new Map(mapped.map((item) => [item.id, item]));

    return sourceParcelIds
      .filter((item) => this.canHandleSourceParcelId(item))
      .map((item) => byId.get(item) ?? null)
      .filter((item): item is NormalizedSourceParcelRecord => Boolean(item));
  }

  private async fetchNominatim(url: URL) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": this.config.userAgent,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new SourceParcelProviderError(
          "SOURCE_PROVIDER_UNAVAILABLE",
          this.key,
          `Source provider returned ${response.status} ${response.statusText}.`,
        );
      }

      const json = await response.json();
      if (!isRecordArray(json)) {
        throw new SourceParcelProviderError(
          "SOURCE_PROVIDER_LOOKUP_FAILED",
          this.key,
          "Source provider returned an unexpected response payload.",
        );
      }

      return json;
    } catch (error) {
      if (error instanceof SourceParcelProviderError) {
        throw error;
      }

      throw new SourceParcelProviderError(
        "SOURCE_PROVIDER_UNAVAILABLE",
        this.key,
        "Real source parcel provider is currently unavailable.",
        error,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapResult(result: NominatimResult, intakeMode: "search" | "lookup") {
    const providerParcelId = buildProviderParcelId(result);
    if (!providerParcelId) {
      return null;
    }

    const geom = normalizeGeometry(result.geojson);
    const resolvedAreaSqm = toNullableDecimalString(calculateMultiPolygonAreaSqm(geom));
    const address = result.address ?? {};
    const addressLine1 = getAddressLine1(address);
    const municipalityName = getMunicipality(address);
    const districtName = getDistrict(address);
    const confidenceScore = computeConfidenceScore(result, Boolean(geom), Boolean(resolvedAreaSqm));

    return buildNormalizedSourceSearchResult({
      id: `nominatim:${providerParcelId}`,
      providerName: "OpenStreetMap Nominatim",
      providerParcelId,
      sourceAuthority: "SEARCH_GRADE",
      displayName: result.name ?? addressLine1 ?? result.display_name?.split(",")[0] ?? providerParcelId,
      cadastralId: null,
      addressLine1,
      city: municipalityName,
      postalCode: address.postcode ?? null,
      stateCode: getGermanStateCode(address),
      countryCode: address.country_code?.toUpperCase() ?? "DE",
      municipalityName,
      districtName,
      landAreaSqm: resolvedAreaSqm,
      confidenceScore,
      geom,
      centroid: geom ? undefined : getLatLonCentroid(result),
      rawMetadata: {
        sourceSystem: "openstreetmap-nominatim",
        intakeMode,
        providerKind: "REAL",
        sourceAuthority: "SEARCH_GRADE",
        sourceAreaSqm: null,
        resolvedAreaSource: resolvedAreaSqm ? "GEOMETRY_DERIVED" : null,
        osmType: normalizeOsmType(result.osm_type),
        osmId: result.osm_id != null ? String(result.osm_id) : null,
        category: result.category ?? null,
        type: result.type ?? null,
        importance: Number.isFinite(Number(result.importance ?? NaN)) ? Number(result.importance) : null,
        placeRank: Number.isFinite(Number(result.place_rank ?? NaN)) ? Number(result.place_rank) : null,
        providerDisplayName: result.display_name ?? null,
        providerCentroid: result.lat && result.lon ? { lat: Number(result.lat), lon: Number(result.lon) } : null,
        geometryResolution: geom
          ? "PROVIDER_POLYGON_GEOMETRY"
          : result.geojson
            ? "NON_POLYGON_GEOMETRY_REJECTED"
            : "GEOMETRY_NOT_RETURNED",
        geometryAuthority: geom ? "SEARCH_GRADE_APPROXIMATE" : "NONE",
        providerBaseUrl: this.config.baseUrl,
      },
    });
  }
}
