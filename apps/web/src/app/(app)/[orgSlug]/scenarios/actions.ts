"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AcquisitionType,
  FinancingSourceType,
  OptimizationTarget,
  StrategyType,
  type CreateScenarioRequestDto,
  type ScenarioDto,
  type ScenarioRunDto,
  type UpdateScenarioRequestDto,
  type UpsertScenarioFundingStackRequestDto,
} from "@repo/contracts";
import { apiFetch } from "@/lib/api/client";

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function safeParseOptionalJsonField(formData: FormData, key: string) {
  const raw = optionalString(formData, key);
  if (!raw) return { ok: true as const, value: null };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ok: false as const };
    }
    return { ok: true as const, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false as const };
  }
}

function buildScenarioPayload(formData: FormData, strategyMixJson: Record<string, unknown> | null): CreateScenarioRequestDto {
  return {
    parcelId: optionalString(formData, "parcelId"),
    name: String(formData.get("name") ?? ""),
    description: optionalString(formData, "description"),
    strategyType: String(formData.get("strategyType")) as StrategyType,
    acquisitionType: String(formData.get("acquisitionType")) as AcquisitionType,
    optimizationTarget: String(formData.get("optimizationTarget")) as OptimizationTarget,
    strategyMixJson,
    avgUnitSizeSqm: optionalString(formData, "avgUnitSizeSqm"),
    targetMarketRentEurSqm: optionalString(formData, "targetMarketRentEurSqm"),
    targetSubsidizedRentEurSqm: optionalString(formData, "targetSubsidizedRentEurSqm"),
    targetSalesPriceEurSqm: optionalString(formData, "targetSalesPriceEurSqm"),
    subsidizedSharePct: optionalString(formData, "subsidizedSharePct"),
    hardCostPerBgfSqm: optionalString(formData, "hardCostPerBgfSqm"),
    softCostPct: optionalString(formData, "softCostPct"),
    parkingCostPerSpace: optionalString(formData, "parkingCostPerSpace"),
    landCost: optionalString(formData, "landCost"),
    equityTargetPct: optionalString(formData, "equityTargetPct"),
  };
}

export async function createScenarioAction(orgSlug: string, formData: FormData) {
  const parsedMix = safeParseOptionalJsonField(formData, "strategyMixJson");
  const parcelId = optionalString(formData, "parcelId");

  if (!parsedMix.ok) {
    redirect(`/${orgSlug}/scenarios/new?error=invalid-strategy-mix-json${parcelId ? `&parcelId=${parcelId}` : ""}`);
  }

  const scenario = await apiFetch<ScenarioDto>(orgSlug, "/api/v1/scenarios", {
    method: "POST",
    body: JSON.stringify(buildScenarioPayload(formData, parsedMix.value)),
  });

  redirect(`/${orgSlug}/scenarios/${scenario.id}/builder`);
}

export async function updateScenarioAction(orgSlug: string, scenarioId: string, formData: FormData) {
  const parsedMix = safeParseOptionalJsonField(formData, "strategyMixJson");
  if (!parsedMix.ok) {
    redirect(`/${orgSlug}/scenarios/${scenarioId}/builder?error=invalid-strategy-mix-json`);
  }

  const payload: UpdateScenarioRequestDto = buildScenarioPayload(formData, parsedMix.value);
  await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });

  revalidatePath(`/${orgSlug}/scenarios/${scenarioId}/builder`);
  redirect(`/${orgSlug}/scenarios/${scenarioId}/builder`);
}

export async function replaceFundingStackAction(orgSlug: string, scenarioId: string, formData: FormData) {
  // Sprint 1 temporary behavior:
  // replace the entire funding stack in one request rather than patching individual line items.
  const items: UpsertScenarioFundingStackRequestDto["items"] = [];
  const stateVariantId = optionalString(formData, "stateSubsidyVariantId");
  const kfwVariantId = optionalString(formData, "kfwVariantId");
  const freeVariantId = optionalString(formData, "freeFinancingVariantId");

  if (formData.get("stateSubsidyEnabled") === "on" && stateVariantId) {
    items.push({
      label: "State subsidy",
      financingSourceType: FinancingSourceType.STATE_SUBSIDY,
      fundingProgramVariantId: stateVariantId,
      stackOrder: 1,
      isEnabled: true,
    });
  }

  if (formData.get("kfwEnabled") === "on" && kfwVariantId) {
    items.push({
      label: "KfW",
      financingSourceType: FinancingSourceType.KFW,
      fundingProgramVariantId: kfwVariantId,
      stackOrder: 2,
      isEnabled: true,
    });
  }

  if (formData.get("freeFinancingEnabled") === "on" && freeVariantId) {
    items.push({
      label: "Free financing",
      financingSourceType: FinancingSourceType.FREE_FINANCING,
      fundingProgramVariantId: freeVariantId,
      stackOrder: 3,
      isEnabled: true,
    });
  }

  await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}/funding-stack`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });

  revalidatePath(`/${orgSlug}/scenarios/${scenarioId}/builder`);
  redirect(`/${orgSlug}/scenarios/${scenarioId}/builder`);
}

export async function triggerFeasibilityRunAction(orgSlug: string, scenarioId: string) {
  const run = await apiFetch<ScenarioRunDto>(orgSlug, `/api/v1/scenarios/${scenarioId}/feasibility-runs`, {
    method: "POST",
  });

  redirect(`/${orgSlug}/scenarios/${scenarioId}/results/${run.id}`);
}
