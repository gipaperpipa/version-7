import type {
  DecimalString,
  Id,
  IsoDateTime,
  MultiPolygonDto,
  PagedResponseDto,
  PointDto,
  PolygonalGeometryDto,
} from "./common";
import type { ScenarioStatus, SourceAuthorityLevel, SourceType } from "./enums";

export type ParcelConfidenceBand = "HIGH" | "MEDIUM" | "LOW" | "UNSCORED";
export type ParcelTrustMode = "SOURCE_PRIMARY" | "SOURCE_INCOMPLETE" | "GROUP_DERIVED" | "MANUAL_FALLBACK";
export type SourceParcelWorkspaceState =
  | "NEW"
  | "EXISTING_STANDALONE_REUSABLE"
  | "EXISTING_STANDALONE_LOCKED"
  | "GROUPED_SITE_MEMBER";
export type SourceParcelWorkspaceLockReason =
  | "NONE"
  | "DOWNSTREAM_WORK_PRESENT"
  | "GROUP_SITE_MEMBERSHIP_STABLE";
export type SourceParcelIntakeOutcome =
  | "CREATED_STANDALONE_SOURCE_PARCEL"
  | "REUSED_STANDALONE_SOURCE_PARCEL"
  | "CREATED_GROUPED_SITE"
  | "REUSED_GROUPED_SITE"
  | "CREATED_GROUPED_SITE_WITH_SAFE_MIGRATION";
export type SourceParcelIntakeConflictCode =
  | "EMPTY_SOURCE_SELECTION"
  | "SOURCE_PROVIDER_UNAVAILABLE"
  | "SOURCE_RECORD_UNAVAILABLE"
  | "GROUP_MEMBER_ALREADY_ASSIGNED"
  | "DOWNSTREAM_RECONCILIATION_REQUIRED"
  | "SOURCE_CONTEXT_INCOMPLETE_FOR_GROUP";

export interface ParcelProvenanceDto {
  providerName: string | null;
  providerParcelId: string | null;
  sourceAuthority: SourceAuthorityLevel | null;
  trustMode: ParcelTrustMode;
  geometryDerived: boolean;
  areaDerived: boolean;
  rawMetadata: Record<string, unknown> | null;
}

export interface ParcelGroupMemberDto {
  id: Id;
  name: string | null;
  cadastralId: string | null;
  municipalityName: string | null;
  landAreaSqm: DecimalString | null;
  confidenceScore: number | null;
  confidenceBand: ParcelConfidenceBand;
  sourceAuthority: SourceAuthorityLevel | null;
  sourceProviderName: string | null;
  sourceProviderParcelId: string | null;
  sourceReference: string | null;
}

export interface ParcelGroupSummaryDto {
  id: Id;
  name: string;
  memberCount: number;
  combinedLandAreaSqm: DecimalString | null;
  siteParcelId: Id | null;
  sourceType: SourceType;
  sourceReference: string | null;
  confidenceScore: number | null;
  confidenceBand: ParcelConfidenceBand;
  sourceAuthority: SourceAuthorityLevel | null;
}

export interface ParcelDto {
  id: Id;
  organizationId: Id;
  parcelGroupId: Id | null;
  isGroupSite: boolean;
  name: string | null;
  cadastralId: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  stateCode: string | null;
  countryCode: string | null;
  municipalityName: string | null;
  districtName: string | null;
  landAreaSqm: DecimalString | null;
  sourceType: SourceType;
  sourceReference: string | null;
  sourceProviderName: string | null;
  sourceProviderParcelId: string | null;
  confidenceScore: number | null;
  confidenceBand: ParcelConfidenceBand;
  sourceAuthority: SourceAuthorityLevel | null;
  geom: MultiPolygonDto | null;
  centroid: PointDto | null;
  provenance: ParcelProvenanceDto | null;
  parcelGroup: ParcelGroupSummaryDto | null;
  constituentParcels: ParcelGroupMemberDto[];
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface CreateParcelRequestDto {
  name?: string;
  cadastralId?: string;
  addressLine1?: string;
  city?: string;
  postalCode?: string;
  stateCode?: string;
  countryCode?: string;
  municipalityName?: string;
  districtName?: string;
  landAreaSqm?: DecimalString;
  sourceType: SourceType;
  sourceReference?: string;
  sourceProviderName?: string;
  sourceProviderParcelId?: string;
  confidenceScore?: number;
  geom?: PolygonalGeometryDto;
  provenance?: ParcelProvenanceDto | null;
}

export interface UpdateParcelRequestDto extends Omit<Partial<CreateParcelRequestDto>, "landAreaSqm" | "sourceReference" | "sourceProviderName" | "sourceProviderParcelId" | "confidenceScore" | "geom" | "provenance"> {
  landAreaSqm?: DecimalString | null;
  sourceReference?: string | null;
  sourceProviderName?: string | null;
  sourceProviderParcelId?: string | null;
  confidenceScore?: number | null;
  geom?: PolygonalGeometryDto | null;
  provenance?: ParcelProvenanceDto | null;
}

export type ListParcelsResponseDto = PagedResponseDto<ParcelDto>;

export interface SourceParcelExistingSiteSummaryDto {
  id: Id;
  name: string;
  siteParcelId: Id | null;
}

export interface SourceParcelScenarioSummaryDto {
  id: Id;
  name: string;
  status: ScenarioStatus;
  latestRunAt: IsoDateTime | null;
}

export interface SourceParcelDownstreamWorkSummaryDto {
  planningValueCount: number;
  scenarioCount: number;
  scenarios: SourceParcelScenarioSummaryDto[];
}

export interface SourceParcelSearchResultDto {
  id: Id;
  providerName: string;
  providerParcelId: string;
  displayName: string;
  cadastralId: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  stateCode: string | null;
  countryCode: string | null;
  municipalityName: string | null;
  districtName: string | null;
  landAreaSqm: DecimalString | null;
  confidenceScore: number | null;
  confidenceBand: ParcelConfidenceBand;
  sourceAuthority: SourceAuthorityLevel;
  geom: MultiPolygonDto | null;
  centroid: PointDto | null;
  sourceReference: string;
  hasGeometry: boolean;
  hasLandArea: boolean;
  workspaceState: SourceParcelWorkspaceState;
  regroupingEligible: boolean;
  lockReason: SourceParcelWorkspaceLockReason;
  existingParcelId: Id | null;
  existingSite: SourceParcelExistingSiteSummaryDto | null;
  downstreamWork: SourceParcelDownstreamWorkSummaryDto;
  rawMetadata: Record<string, unknown> | null;
}

export type SearchSourceParcelsResponseDto = PagedResponseDto<SourceParcelSearchResultDto>;

export interface SourceParcelMapBoundsDto {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface SourceParcelMapSupportedRegionDto {
  id: string;
  name: string;
  providerName: string | null;
  description: string;
  sourceAuthority: SourceAuthorityLevel;
  bounds: SourceParcelMapBoundsDto;
}

export type SourceParcelMapCoverageState =
  | "PARCEL_SELECTION_AVAILABLE"
  | "ZOOM_IN_REQUIRED"
  | "SEARCH_GUIDANCE_ONLY";

export interface SourceParcelMapConfigDto {
  defaultCenter: PointDto;
  defaultZoom: number;
  minParcelSelectionZoom: number;
  parcelSelectionAvailable: boolean;
  supportedRegions: SourceParcelMapSupportedRegionDto[];
}

export interface SourceParcelMapPreviewsResponseDto extends PagedResponseDto<SourceParcelSearchResultDto> {
  bounds: SourceParcelMapBoundsDto;
  zoom: number;
  minParcelSelectionZoom: number;
  coverageState: SourceParcelMapCoverageState;
  activeRegion: SourceParcelMapSupportedRegionDto | null;
}

export interface CreateSourceParcelIntakeRequestDto {
  sourceParcelIds: Id[];
  siteName?: string | null;
}

export interface SourceParcelIntakeConflictDto {
  code: SourceParcelIntakeConflictCode;
  message: string;
  parcelIds?: Id[];
  existingSite?: SourceParcelExistingSiteSummaryDto | null;
}

export interface SourceParcelIntakeResponseDto {
  outcome: SourceParcelIntakeOutcome;
  primaryParcel: ParcelDto;
  createdParcels: ParcelDto[];
  parcelGroup: ParcelGroupSummaryDto | null;
}
