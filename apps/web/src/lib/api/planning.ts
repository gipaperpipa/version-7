import type {
  ListPlanningParametersResponseDto,
  PlanningParameterDto,
  UpsertPlanningParameterRequestDto,
} from "@repo/contracts";
import { apiFetch } from "./client";

export function getPlanningParameters(orgSlug: string, parcelId: string) {
  return apiFetch<ListPlanningParametersResponseDto>(orgSlug, `/api/v1/parcels/${parcelId}/planning-parameters`);
}

export function createPlanningParameter(
  orgSlug: string,
  parcelId: string,
  payload: UpsertPlanningParameterRequestDto,
) {
  return apiFetch<PlanningParameterDto>(orgSlug, `/api/v1/parcels/${parcelId}/planning-parameters`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updatePlanningParameter(
  orgSlug: string,
  parcelId: string,
  planningParameterId: string,
  payload: UpsertPlanningParameterRequestDto,
) {
  return apiFetch<PlanningParameterDto>(
    orgSlug,
    `/api/v1/parcels/${parcelId}/planning-parameters/${planningParameterId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
  );
}
