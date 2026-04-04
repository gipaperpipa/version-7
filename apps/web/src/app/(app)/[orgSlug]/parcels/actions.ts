"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SourceType, type CreateParcelRequestDto, type ParcelDto, type UpdateParcelRequestDto } from "@repo/contracts";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/client";
import { intakeSourceParcels } from "@/lib/api/parcels";

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalInteger(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function getExistingSourceType(formData: FormData) {
  const value = formData.get("existingSourceType");
  if (typeof value !== "string") return null;
  return Object.values(SourceType).includes(value as SourceType) ? (value as SourceType) : null;
}

function buildParcelPayload(
  formData: FormData,
  mode: "create" | "update",
): CreateParcelRequestDto | UpdateParcelRequestDto {
  const existingSourceType = getExistingSourceType(formData);
  const preservesSourceIdentity = mode === "update" && existingSourceType !== null &&
    existingSourceType !== SourceType.USER_INPUT &&
    existingSourceType !== SourceType.MANUAL_OVERRIDE;
  const landAreaSqm = optionalString(formData, "landAreaSqm") ?? undefined;

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
    landAreaSqm,
    sourceType: preservesSourceIdentity ? SourceType.MANUAL_OVERRIDE : SourceType.USER_INPUT,
    sourceReference: preservesSourceIdentity ? optionalString(formData, "existingSourceReference") ?? undefined : undefined,
    sourceProviderName: preservesSourceIdentity ? optionalString(formData, "existingSourceProviderName") ?? undefined : undefined,
    sourceProviderParcelId: preservesSourceIdentity ? optionalString(formData, "existingSourceProviderParcelId") ?? undefined : undefined,
    confidenceScore: preservesSourceIdentity ? optionalInteger(formData, "existingConfidenceScore") ?? undefined : undefined,
    provenance: {
      providerName: preservesSourceIdentity ? optionalString(formData, "existingSourceProviderName") : null,
      providerParcelId: preservesSourceIdentity ? optionalString(formData, "existingSourceProviderParcelId") : null,
      trustMode: "MANUAL_FALLBACK",
      geometryDerived: false,
      areaDerived: Boolean(landAreaSqm),
      rawMetadata: preservesSourceIdentity && existingSourceType
        ? {
            previousSourceType: existingSourceType,
            overrideMode: "MANUAL_OVERRIDE",
          }
        : null,
    },
  };
}

export async function createParcelAction(orgSlug: string, formData: FormData) {
  const payload = buildParcelPayload(formData, "create");
  const parcel = await apiFetch<ParcelDto>(orgSlug, "/api/v1/parcels", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  redirect(`/${orgSlug}/parcels/${parcel.id}`);
}

export async function ingestSourceParcelsAction(orgSlug: string, formData: FormData) {
  const sourceParcelIds = formData
    .getAll("sourceParcelId")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  const siteName = optionalString(formData, "siteName");

  if (!sourceParcelIds.length) {
    redirect(`/${orgSlug}/parcels/new?error=missing-source-selection`);
  }

  try {
    const intake = await intakeSourceParcels(orgSlug, {
      sourceParcelIds,
      siteName,
    });

    revalidatePath(`/${orgSlug}/parcels`);
    redirect(`/${orgSlug}/parcels/${intake.primaryParcel.id}`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      const search = new URLSearchParams();
      search.set("error", "source-intake-failed");
      search.set("message", error.message);
      redirect(`/${orgSlug}/parcels/new?${search.toString()}`);
    }

    throw error;
  }
}

export async function updateParcelAction(orgSlug: string, parcelId: string, formData: FormData) {
  const payload = buildParcelPayload(formData, "update") as UpdateParcelRequestDto;

  await apiFetch<ParcelDto>(orgSlug, `/api/v1/parcels/${parcelId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  revalidatePath(`/${orgSlug}/parcels`);
  revalidatePath(`/${orgSlug}/parcels/${parcelId}`);
  redirect(`/${orgSlug}/parcels/${parcelId}`);
}
