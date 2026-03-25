import type { ListParcelsResponseDto, ParcelDto } from "@repo/contracts";
import { apiFetch } from "./client";

export function getParcels(orgSlug: string) {
  return apiFetch<ListParcelsResponseDto>(orgSlug, "/api/v1/parcels");
}

export function getParcel(orgSlug: string, parcelId: string) {
  return apiFetch<ParcelDto>(orgSlug, `/api/v1/parcels/${parcelId}`);
}
