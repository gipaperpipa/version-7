"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { SourceType, type CreateParcelRequestDto, type ParcelDto, type UpdateParcelRequestDto } from "@repo/contracts";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";
import { apiFetch } from "@/lib/api/client";
import { getParcels, intakeSourceParcels, searchSourceParcels } from "@/lib/api/parcels";

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

function getExistingSourceAuthority(formData: FormData) {
  const value = formData.get("existingSourceAuthority");
  if (value === "DEMO" || value === "SEARCH_GRADE" || value === "CADASTRAL_GRADE") {
    return value;
  }
  return null;
}

function extractApiErrorCode(error: unknown) {
  if (!isApiResponseError(error)) return null;
  if (typeof error.body !== "object" || error.body === null) return null;
  const code = (error.body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function getSourceRecordIdFromRawMetadata(parcel: ParcelDto) {
  const rawMetadata = parcel.provenance?.rawMetadata;
  if (!rawMetadata || typeof rawMetadata !== "object") return null;
  const sourceParcelId = "sourceParcelId" in rawMetadata ? rawMetadata.sourceParcelId : null;
  return typeof sourceParcelId === "string" && sourceParcelId.trim() ? sourceParcelId.trim() : null;
}

async function resolveSourceParcelIdForWorkspaceParcel(orgSlug: string, parcel: ParcelDto) {
  const fromMetadata = getSourceRecordIdFromRawMetadata(parcel);
  if (fromMetadata) {
    return fromMetadata;
  }

  const providerName = parcel.sourceProviderName ?? parcel.provenance?.providerName ?? null;
  const providerParcelId = parcel.sourceProviderParcelId ?? parcel.provenance?.providerParcelId ?? null;
  const rawMetadata = parcel.provenance?.rawMetadata;

  if (providerName === "OpenStreetMap Nominatim" && providerParcelId) {
    return `nominatim:${providerParcelId}`;
  }

  if (providerName === "Hessen ALKIS Flurstueck" && rawMetadata && typeof rawMetadata === "object") {
    const providerFeatureId = "providerFeatureId" in rawMetadata ? rawMetadata.providerFeatureId : null;
    if (typeof providerFeatureId === "string" && providerFeatureId.trim()) {
      return `hessen-alkis:${encodeURIComponent(providerFeatureId.trim())}`;
    }
  }

  const searchQuery = providerParcelId ?? parcel.cadastralId ?? parcel.name ?? parcel.addressLine1 ?? null;
  if (!searchQuery) {
    return null;
  }

  const results = await searchSourceParcels(orgSlug, {
    q: searchQuery,
    municipality: parcel.municipalityName ?? parcel.city ?? undefined,
    limit: 10,
  });
  const exactMatch = results.items.find((item) => (
    item.providerName === providerName
      && item.providerParcelId === providerParcelId
  ));
  return exactMatch?.id ?? null;
}

function buildParcelPayload(
  formData: FormData,
  mode: "create" | "update",
): CreateParcelRequestDto | UpdateParcelRequestDto {
  const existingSourceType = getExistingSourceType(formData);
  const existingSourceAuthority = getExistingSourceAuthority(formData);
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
      sourceAuthority: preservesSourceIdentity ? existingSourceAuthority : null,
      trustMode: "MANUAL_FALLBACK",
      geometryDerived: false,
      areaDerived: Boolean(landAreaSqm),
      rawMetadata: preservesSourceIdentity && existingSourceType
        ? {
            previousSourceType: existingSourceType,
            previousSourceAuthority: existingSourceAuthority,
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
      const errorCode = extractApiErrorCode(error);
      if (errorCode) search.set("errorCode", errorCode);
      redirect(`/${orgSlug}/parcels/new?${search.toString()}`);
    }

    throw error;
  }
}

export async function createGroupedSiteFromWorkspaceAction(orgSlug: string, formData: FormData) {
  const selectedParcelIds = Array.from(new Set(formData
    .getAll("workspaceParcelId")
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)));
  const siteName = optionalString(formData, "siteName");

  if (selectedParcelIds.length < 2) {
    redirect(`/${orgSlug}/parcels?error=grouped-site-selection-missing`);
  }

  const parcels = await getParcels(orgSlug);
  const selectedParcels = parcels.items.filter((parcel) => selectedParcelIds.includes(parcel.id));
  const invalidSelection = selectedParcels.some((parcel) => (
    parcel.isGroupSite
    || Boolean(parcel.parcelGroupId)
    || parcel.provenance?.trustMode === "MANUAL_FALLBACK"
    || !(parcel.sourceProviderName ?? parcel.provenance?.providerName)
    || !(parcel.sourceProviderParcelId ?? parcel.provenance?.providerParcelId)
  ));

  if (selectedParcels.length !== selectedParcelIds.length || invalidSelection) {
    redirect(`/${orgSlug}/parcels?error=grouped-site-invalid-selection`);
  }

  try {
    const sourceParcelIds: string[] = [];
    const seenSourceParcelIds = new Set<string>();
    for (const parcel of selectedParcels) {
      const sourceParcelId = await resolveSourceParcelIdForWorkspaceParcel(orgSlug, parcel);
      if (!sourceParcelId) {
        redirect(`/${orgSlug}/parcels?error=grouped-site-source-resolution-failed`);
      }
      if (seenSourceParcelIds.has(sourceParcelId)) {
        continue;
      }

      seenSourceParcelIds.add(sourceParcelId);
      sourceParcelIds.push(sourceParcelId);
    }

    const intake = await intakeSourceParcels(orgSlug, {
      sourceParcelIds,
      siteName,
    });

    revalidatePath(`/${orgSlug}/parcels`);
    redirect(`/${orgSlug}/parcels/${intake.primaryParcel.id}`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      const search = new URLSearchParams();
      search.set("error", "grouped-site-create-failed");
      search.set("message", error.message);
      const errorCode = extractApiErrorCode(error);
      if (errorCode) search.set("errorCode", errorCode);
      redirect(`/${orgSlug}/parcels?${search.toString()}`);
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
