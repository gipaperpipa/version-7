import type {
  SourceParcelMapBoundsDto,
  SourceParcelMapSupportedRegionDto,
} from "../../generated-contracts/parcels";
import type { NormalizedSourceParcelRecord } from "./source-parcel-model";

export type SourceParcelProviderMode = "REAL_ONLY" | "REAL_WITH_DEMO_FALLBACK" | "DEMO_ONLY";
export type SourceParcelProviderErrorCode =
  | "SOURCE_PROVIDER_UNAVAILABLE"
  | "SOURCE_PROVIDER_LOOKUP_FAILED";

export interface SourceParcelProvider {
  key: string;
  kind: "REAL" | "DEMO";
  canHandleSourceParcelId(sourceParcelId: string): boolean;
  search(query?: string | null, municipality?: string | null, limit?: number): Promise<NormalizedSourceParcelRecord[]>;
  getByIds(sourceParcelIds: string[]): Promise<NormalizedSourceParcelRecord[]>;
  searchByBounds?(bounds: SourceParcelMapBoundsDto, limit?: number): Promise<NormalizedSourceParcelRecord[]>;
  getSupportedRegions?(): SourceParcelMapSupportedRegionDto[];
}

export class SourceParcelProviderError extends Error {
  constructor(
    public readonly code: SourceParcelProviderErrorCode,
    public readonly providerKey: string,
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SourceParcelProviderError";
  }
}
