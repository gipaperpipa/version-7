import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  SourceParcelMapBoundsDto,
} from "../../generated-contracts/parcels";
import { isLocalDevAuthFallbackEnabled } from "../../common/auth/local-dev-auth";
import {
  getSourceAuthorityRank,
  type NormalizedSourceParcelRecord,
} from "./source-parcel-model";
import { SourceParcelDemoProvider } from "./source-parcel-catalog";
import { SourceParcelHessenCadastreProvider } from "./source-parcel-hessen-cadastre.provider";
import { SourceParcelNominatimProvider } from "./source-parcel-nominatim.provider";
import {
  SourceParcelProviderError,
  type SourceParcelProvider,
  type SourceParcelProviderMode,
} from "./source-parcel-provider";

function normalizeProviderMode(value: string | undefined): SourceParcelProviderMode {
  switch ((value ?? "").trim().toUpperCase()) {
    case "DEMO_ONLY":
      return "DEMO_ONLY";
    case "REAL_WITH_DEMO_FALLBACK":
      return "REAL_WITH_DEMO_FALLBACK";
    case "REAL_ONLY":
      return "REAL_ONLY";
    default:
      return isLocalDevAuthFallbackEnabled() ? "REAL_WITH_DEMO_FALLBACK" : "REAL_ONLY";
  }
}

function toPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function toNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function boundsIntersect(left: SourceParcelMapBoundsDto, right: SourceParcelMapBoundsDto) {
  return !(
    left.east < right.west
    || left.west > right.east
    || left.north < right.south
    || left.south > right.north
  );
}

@Injectable()
export class SourceParcelProviderRegistryService {
  private readonly mode: SourceParcelProviderMode;
  private readonly demoProvider = new SourceParcelDemoProvider();
  private readonly searchGradeProvider: SourceParcelProvider;
  private readonly cadastralProvider: SourceParcelProvider;
  private readonly realProviders: SourceParcelProvider[];

  constructor(private readonly configService: ConfigService) {
    this.mode = normalizeProviderMode(this.configService.get<string>("SOURCE_PARCEL_PROVIDER_MODE"));
    const apiPublicUrl = this.configService.get<string>("API_PUBLIC_URL") ?? "https://feasibility-os.local";
    this.searchGradeProvider = new SourceParcelNominatimProvider({
      baseUrl: this.configService.get<string>("SOURCE_PARCEL_NOMINATIM_BASE_URL") ?? "https://nominatim.openstreetmap.org",
      userAgent: this.configService.get<string>("SOURCE_PARCEL_NOMINATIM_USER_AGENT") ?? `FeasibilityOS/1.0 (+${apiPublicUrl})`,
      email: this.configService.get<string>("SOURCE_PARCEL_NOMINATIM_EMAIL") ?? null,
      countryCodes: this.configService.get<string>("SOURCE_PARCEL_NOMINATIM_COUNTRY_CODES") ?? "de",
      acceptLanguage: this.configService.get<string>("SOURCE_PARCEL_NOMINATIM_ACCEPT_LANGUAGE") ?? "de,en",
      timeoutMs: toPositiveInt(this.configService.get<string>("SOURCE_PARCEL_REQUEST_TIMEOUT_MS"), 8000),
    });
    this.cadastralProvider = new SourceParcelHessenCadastreProvider({
      apiBaseUrl: this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_BASE_URL") ?? "https://www.geoportal.hessen.de/spatial-objects/710",
      collectionId: this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_COLLECTION") ?? "cp:CadastralParcel",
      wfsBaseUrl: this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_WFS_BASE_URL") ?? "https://inspire-hessen.de/ows/services/org.2.d66ec21e-39e7-45c4-bf68-438e8baea882_wfs",
      wfsTypeName: this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_WFS_TYPENAME") ?? "cp:CadastralParcel",
      userAgent: this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_USER_AGENT") ?? `FeasibilityOS/1.0 (+${apiPublicUrl})`,
      timeoutMs: toPositiveInt(this.configService.get<string>("SOURCE_PARCEL_REQUEST_TIMEOUT_MS"), 8000),
      bboxRadiusMeters: toPositiveInt(this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_BBOX_RADIUS_METERS"), 80),
      bboxWest: toNumber(this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_BBOX_WEST"), 7.772467),
      bboxSouth: toNumber(this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_BBOX_SOUTH"), 49.395272),
      bboxEast: toNumber(this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_BBOX_EAST"), 10.236414),
      bboxNorth: toNumber(this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_BBOX_NORTH"), 51.657789),
      maxSeedCount: toPositiveInt(this.configService.get<string>("SOURCE_PARCEL_HESSEN_CADASTRE_MAX_SEED_COUNT"), 4),
    }, this.searchGradeProvider);
    this.realProviders = [this.cadastralProvider, this.searchGradeProvider];
  }

  async search(query?: string | null, municipality?: string | null, limit = 12) {
    if (this.mode === "DEMO_ONLY") {
      return this.demoProvider.search(query, municipality, limit);
    }

    const wantsBlankSearch = !(query?.trim() || municipality?.trim());
    if (wantsBlankSearch && this.mode === "REAL_WITH_DEMO_FALLBACK") {
      return this.demoProvider.search(query, municipality, limit);
    }

    const resultsById = new Map<string, NormalizedSourceParcelRecord>();
    let lastProviderError: SourceParcelProviderError | null = null;

    for (const provider of this.realProviders) {
      try {
        const records = await provider.search(query, municipality, limit);
        for (const record of records) {
          const existing = resultsById.get(record.id);
          if (!existing) {
            resultsById.set(record.id, record);
            continue;
          }

          const authorityDiff = getSourceAuthorityRank(record.sourceAuthority) - getSourceAuthorityRank(existing.sourceAuthority);
          if (authorityDiff > 0 || (authorityDiff === 0 && (record.confidenceScore ?? 0) > (existing.confidenceScore ?? 0))) {
            resultsById.set(record.id, record);
          }
        }
      } catch (error) {
        lastProviderError = error instanceof SourceParcelProviderError
          ? error
          : new SourceParcelProviderError(
              "SOURCE_PROVIDER_UNAVAILABLE",
              provider.key,
              "Real source parcel provider is currently unavailable.",
              error,
            );
      }
    }

    const results = Array.from(resultsById.values())
      .sort((left, right) => {
        const authorityDiff = getSourceAuthorityRank(right.sourceAuthority) - getSourceAuthorityRank(left.sourceAuthority);
        if (authorityDiff !== 0) return authorityDiff;
        return (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0);
      })
      .slice(0, Math.max(1, Math.min(limit, 25)));

    if (results.length) {
      return results;
    }

    if (this.mode === "REAL_WITH_DEMO_FALLBACK") {
      return this.demoProvider.search(query, municipality, limit);
    }

    if (lastProviderError) {
      throw lastProviderError;
    }

    throw new SourceParcelProviderError(
      "SOURCE_PROVIDER_UNAVAILABLE",
      this.cadastralProvider.key,
      "No real source parcel provider is currently available.",
    );
  }

  async getByIds(sourceParcelIds: string[]) {
    const trimmedIds = Array.from(new Set(sourceParcelIds.map((item) => item.trim()).filter(Boolean)));
    if (!trimmedIds.length) {
      return [];
    }

    const demoIds = trimmedIds.filter((item) => this.demoProvider.canHandleSourceParcelId(item));
    const records: NormalizedSourceParcelRecord[] = [];

    if (demoIds.length) {
      records.push(...(await this.demoProvider.getByIds(demoIds)));
    }

    for (const provider of this.realProviders) {
      const providerIds = trimmedIds.filter((item) => provider.canHandleSourceParcelId(item));
      if (!providerIds.length) {
        continue;
      }

      if (this.mode === "DEMO_ONLY") {
        throw new SourceParcelProviderError(
          "SOURCE_PROVIDER_LOOKUP_FAILED",
          this.demoProvider.key,
          "The selected source parcels require the real provider, but the current deployment is running in demo-only mode.",
        );
      }

      records.push(...(await provider.getByIds(providerIds)));
    }

    return records;
  }

  getSupportedRegions() {
    if (this.mode === "DEMO_ONLY") {
      return [];
    }

    return this.realProviders.flatMap((provider) => provider.getSupportedRegions?.() ?? []);
  }

  async searchByBounds(bounds: SourceParcelMapBoundsDto, limit = 120) {
    if (this.mode === "DEMO_ONLY") {
      return [];
    }

    const supportedRegions = this.getSupportedRegions();
    const relevantProviders = this.realProviders.filter((provider) => {
      const providerRegions = provider.getSupportedRegions?.() ?? [];
      return providerRegions.some((region) => boundsIntersect(region.bounds, bounds));
    });

    if (!relevantProviders.length || !supportedRegions.some((region) => boundsIntersect(region.bounds, bounds))) {
      return [];
    }

    const resultsById = new Map<string, NormalizedSourceParcelRecord>();
    let lastProviderError: SourceParcelProviderError | null = null;

    for (const provider of relevantProviders) {
      if (!provider.searchByBounds) {
        continue;
      }

      try {
        const records = await provider.searchByBounds(bounds, limit);
        for (const record of records) {
          const existing = resultsById.get(record.id);
          if (!existing) {
            resultsById.set(record.id, record);
            continue;
          }

          const authorityDiff = getSourceAuthorityRank(record.sourceAuthority) - getSourceAuthorityRank(existing.sourceAuthority);
          if (authorityDiff > 0 || (authorityDiff === 0 && (record.confidenceScore ?? 0) > (existing.confidenceScore ?? 0))) {
            resultsById.set(record.id, record);
          }
        }
      } catch (error) {
        lastProviderError = error instanceof SourceParcelProviderError
          ? error
          : new SourceParcelProviderError(
              "SOURCE_PROVIDER_UNAVAILABLE",
              provider.key,
              "Real source parcel provider is currently unavailable for map previews.",
              error,
            );
      }
    }

    const results = Array.from(resultsById.values())
      .sort((left, right) => {
        const authorityDiff = getSourceAuthorityRank(right.sourceAuthority) - getSourceAuthorityRank(left.sourceAuthority);
        if (authorityDiff !== 0) return authorityDiff;
        return (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0);
      })
      .slice(0, Math.max(1, Math.min(limit, 200)));

    if (results.length) {
      return results;
    }

    if (lastProviderError) {
      throw lastProviderError;
    }

    return [];
  }
}
