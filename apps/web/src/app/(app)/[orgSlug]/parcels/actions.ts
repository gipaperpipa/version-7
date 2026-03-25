"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SourceType, type CreateParcelRequestDto, type ParcelDto, type UpdateParcelRequestDto } from "@repo/contracts";
import { apiFetch } from "@/lib/api/client";

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildParcelPayload(formData: FormData): CreateParcelRequestDto {
  return {
    name: optionalString(formData, "name") ?? undefined,
    cadastralId: optionalString(formData, "cadastralId") ?? undefined,
    addressLine1: optionalString(formData, "addressLine1") ?? undefined,
    city: optionalString(formData, "city") ?? undefined,
    postalCode: optionalString(formData, "postalCode") ?? undefined,
    stateCode: optionalString(formData, "stateCode") ?? undefined,
    countryCode: optionalString(formData, "countryCode") ?? "DE",
    municipalityName: optionalString(formData, "municipalityName") ?? undefined,
    districtName: optionalString(formData, "districtName") ?? undefined,
    landAreaSqm: optionalString(formData, "landAreaSqm") ?? undefined,
    sourceType: SourceType.USER_INPUT,
  };
}

export async function createParcelAction(orgSlug: string, formData: FormData) {
  const payload = buildParcelPayload(formData);
  const parcel = await apiFetch<ParcelDto>(orgSlug, "/api/v1/parcels", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  redirect(`/${orgSlug}/parcels/${parcel.id}`);
}

export async function updateParcelAction(orgSlug: string, parcelId: string, formData: FormData) {
  const payload: UpdateParcelRequestDto = buildParcelPayload(formData);

  await apiFetch<ParcelDto>(orgSlug, `/api/v1/parcels/${parcelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  revalidatePath(`/${orgSlug}/parcels`);
  revalidatePath(`/${orgSlug}/parcels/${parcelId}`);
  redirect(`/${orgSlug}/parcels/${parcelId}`);
}
