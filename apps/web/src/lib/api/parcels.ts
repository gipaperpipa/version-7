import type {
  CreateSourceParcelIntakeRequestDto,
  ListParcelsResponseDto,
  ParcelGroupMemberDto,
  ParcelGroupSummaryDto,
  ParcelProvenanceDto,
  ParcelDto,
  SearchSourceParcelsResponseDto,
  SourceParcelIntakeResponseDto,
  SourceType,
} from "@repo/contracts";
import { apiFetch } from "./client";

function deriveLegacyParcelProvenance(parcel: Partial<ParcelDto>): ParcelProvenanceDto | null {
  const sourceType = parcel.sourceType;

  if (!sourceType) {
    return null;
  }

  const geometryDerived = Boolean(parcel.geom);
  const areaDerived = Boolean(parcel.landAreaSqm);
  const trustMode: ParcelProvenanceDto["trustMode"] =
    sourceType === "USER_INPUT" || sourceType === "MANUAL_OVERRIDE"
      ? "MANUAL_FALLBACK"
      : sourceType === "SYSTEM_DERIVED"
        ? "GROUP_DERIVED"
        : geometryDerived && areaDerived
          ? "SOURCE_PRIMARY"
          : "SOURCE_INCOMPLETE";

  return {
    providerName: parcel.sourceProviderName ?? null,
    providerParcelId: parcel.sourceProviderParcelId ?? null,
    trustMode,
    geometryDerived,
    areaDerived,
    rawMetadata: null,
  };
}

function normalizeGroupMember(member: Partial<ParcelGroupMemberDto>): ParcelGroupMemberDto {
  return {
    id: member.id ?? "",
    name: member.name ?? null,
    cadastralId: member.cadastralId ?? null,
    municipalityName: member.municipalityName ?? null,
    landAreaSqm: member.landAreaSqm ?? null,
    confidenceScore: member.confidenceScore ?? null,
    sourceProviderName: member.sourceProviderName ?? null,
    sourceProviderParcelId: member.sourceProviderParcelId ?? null,
    sourceReference: member.sourceReference ?? null,
  };
}

function normalizeParcel(parcel: Partial<ParcelDto>): ParcelDto {
  return {
    id: parcel.id ?? "",
    organizationId: parcel.organizationId ?? "",
    parcelGroupId: parcel.parcelGroupId ?? null,
    isGroupSite: Boolean(parcel.isGroupSite),
    name: parcel.name ?? null,
    cadastralId: parcel.cadastralId ?? null,
    addressLine1: parcel.addressLine1 ?? null,
    city: parcel.city ?? null,
    postalCode: parcel.postalCode ?? null,
    stateCode: parcel.stateCode ?? null,
    countryCode: parcel.countryCode ?? "DE",
    municipalityName: parcel.municipalityName ?? null,
    districtName: parcel.districtName ?? null,
    landAreaSqm: parcel.landAreaSqm ?? null,
    sourceType: (parcel.sourceType ?? "USER_INPUT") as SourceType,
    sourceReference: parcel.sourceReference ?? null,
    sourceProviderName: parcel.sourceProviderName ?? null,
    sourceProviderParcelId: parcel.sourceProviderParcelId ?? null,
    confidenceScore: parcel.confidenceScore ?? null,
    geom: parcel.geom ?? null,
    centroid: parcel.centroid ?? null,
    provenance: parcel.provenance ?? deriveLegacyParcelProvenance(parcel),
    parcelGroup: parcel.parcelGroup
      ? {
          id: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).id ?? "",
          name: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).name ?? "Grouped site",
          memberCount: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).memberCount ?? 0,
          combinedLandAreaSqm: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).combinedLandAreaSqm ?? null,
          siteParcelId: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).siteParcelId ?? null,
          sourceType: ((parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).sourceType ?? parcel.sourceType ?? "SYSTEM_DERIVED") as SourceType,
          sourceReference: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).sourceReference ?? null,
          confidenceScore: (parcel.parcelGroup as Partial<ParcelGroupSummaryDto>).confidenceScore ?? null,
        }
      : null,
    constituentParcels: Array.isArray(parcel.constituentParcels)
      ? parcel.constituentParcels.map((member) => normalizeGroupMember(member))
      : [],
    createdAt: parcel.createdAt ?? new Date(0).toISOString(),
    updatedAt: parcel.updatedAt ?? new Date(0).toISOString(),
  };
}

export async function getParcels(orgSlug: string) {
  const response = await apiFetch<ListParcelsResponseDto>(orgSlug, "/api/v1/parcels");
  return {
    ...response,
    items: Array.isArray(response.items) ? response.items.map((parcel) => normalizeParcel(parcel)) : [],
  };
}

export async function getParcel(orgSlug: string, parcelId: string) {
  const response = await apiFetch<ParcelDto>(orgSlug, `/api/v1/parcels/${parcelId}`);
  return normalizeParcel(response);
}

export function searchSourceParcels(
  orgSlug: string,
  params: {
    q?: string | null;
    municipality?: string | null;
    limit?: number;
  },
) {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.municipality?.trim()) search.set("municipality", params.municipality.trim());
  if (params.limit) search.set("limit", String(params.limit));

  const suffix = search.size ? `?${search.toString()}` : "";
  return apiFetch<SearchSourceParcelsResponseDto>(orgSlug, `/api/v1/parcels/source/search${suffix}`);
}

export function intakeSourceParcels(
  orgSlug: string,
  payload: CreateSourceParcelIntakeRequestDto,
) {
  return apiFetch<SourceParcelIntakeResponseDto>(orgSlug, "/api/v1/parcels/source/intake", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
