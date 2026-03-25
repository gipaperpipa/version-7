"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PlanningParameterType, SourceType, type PlanningParameterDto, type UpsertPlanningParameterRequestDto } from "@repo/contracts";
import { createPlanningParameter, getPlanningParameters, updatePlanningParameter } from "@/lib/api/planning";
import { sprint1PlanningFieldDefinitions } from "@/lib/ui/planning-field-definitions";

function buildPayload(
  definition: typeof sprint1PlanningFieldDefinitions[number],
  value: string | null,
  sourceType: SourceType,
): UpsertPlanningParameterRequestDto {
  return {
    parameterKey: definition.keySlug,
    parameterType: definition.parameterType ?? PlanningParameterType.NUMBER,
    label: definition.label,
    unit: definition.unit,
    sourceType,
    valueNumber: definition.storageKind === "valueNumber" ? value : undefined,
    valueBoolean:
      definition.storageKind === "valueBoolean"
        ? value === "true"
          ? true
          : value === "false"
            ? false
            : null
        : undefined,
  };
}

function getNormalizedInputValue(formData: FormData, keySlug: string, storageKind: string) {
  const raw = formData.get(keySlug);
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (storageKind === "valueBoolean" && trimmed === "unspecified") return null;
  return trimmed;
}

function getCurrentFieldValue(item: PlanningParameterDto | undefined, storageKind: string) {
  if (!item) return null;
  if (storageKind === "valueBoolean") {
    if (item.valueBoolean === true) return "true";
    if (item.valueBoolean === false) return "false";
    return null;
  }
  if (storageKind === "valueNumber") {
    return item.valueNumber ?? null;
  }
  return null;
}

export async function savePlanningParametersAction(orgSlug: string, parcelId: string, _formData: FormData) {
  const current = await getPlanningParameters(orgSlug, parcelId);

  for (const definition of sprint1PlanningFieldDefinitions) {
    const existing = current.items.find((item) => item.keySlug === definition.keySlug);
    if (definition.storageKind === "readonlyValueNumber") {
      continue;
    }

    const nextValue = getNormalizedInputValue(_formData, definition.keySlug, definition.storageKind);
    const currentValue = getCurrentFieldValue(existing, definition.storageKind);
    const isChanged = currentValue !== nextValue;

    if (!existing && nextValue === null) {
      continue;
    }

    if (!existing && nextValue !== null) {
      await createPlanningParameter(
        orgSlug,
        parcelId,
        buildPayload(definition, nextValue, SourceType.USER_INPUT),
      );
      continue;
    }

    if (existing && !isChanged) {
      continue;
    }

    if (existing) {
      await updatePlanningParameter(
        orgSlug,
        parcelId,
        existing.id,
        buildPayload(definition, nextValue, SourceType.MANUAL_OVERRIDE),
      );
    }
  }

  revalidatePath(`/${orgSlug}/parcels/${parcelId}`);
  revalidatePath(`/${orgSlug}/parcels/${parcelId}/planning`);
  redirect(`/${orgSlug}/parcels/${parcelId}/planning`);
}
