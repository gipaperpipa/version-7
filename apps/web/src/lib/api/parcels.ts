import type {
  CreateSourceParcelIntakeRequestDto,
  ListParcelsResponseDto,
  ParcelDto,
  SearchSourceParcelsResponseDto,
  SourceParcelIntakeResponseDto,
} from "@repo/contracts";
import { apiFetch } from "./client";

export function getParcels(orgSlug: string) {
  return apiFetch<ListParcelsResponseDto>(orgSlug, "/api/v1/parcels");
}

export function getParcel(orgSlug: string, parcelId: string) {
  return apiFetch<ParcelDto>(orgSlug, `/api/v1/parcels/${parcelId}`);
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
