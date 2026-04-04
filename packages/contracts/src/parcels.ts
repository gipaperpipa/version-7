import type {
  DecimalString,
  Id,
  IsoDateTime,
  MultiPolygonDto,
  PagedResponseDto,
  PointDto,
  PolygonalGeometryDto,
} from "./common";
import type { SourceType } from "./enums";

export interface ParcelProvenanceDto {
  providerName: string | null;
  providerParcelId: string | null;
  trustMode: "SOURCE_PRIMARY" | "SOURCE_INCOMPLETE" | "GROUP_DERIVED" | "MANUAL_FALLBACK";
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
  geom: MultiPolygonDto | null;
  centroid: PointDto | null;
  sourceReference: string;
  hasGeometry: boolean;
  hasLandArea: boolean;
  workspaceState: "NEW" | "STANDALONE_PARCEL" | "GROUPED_SITE_MEMBER";
  existingParcelId: Id | null;
  existingSiteParcelId: Id | null;
  existingSiteName: string | null;
  rawMetadata: Record<string, unknown> | null;
}

export type SearchSourceParcelsResponseDto = PagedResponseDto<SourceParcelSearchResultDto>;

export interface CreateSourceParcelIntakeRequestDto {
  sourceParcelIds: Id[];
  siteName?: string | null;
}

export interface SourceParcelIntakeResponseDto {
  primaryParcel: ParcelDto;
  createdParcels: ParcelDto[];
  parcelGroup: ParcelGroupSummaryDto | null;
}
