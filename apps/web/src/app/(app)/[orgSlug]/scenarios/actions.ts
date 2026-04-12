"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  AcquisitionType,
  AssumptionProfileKey,
  FinancingSourceType,
  OptimizationTarget,
  ScenarioGovernanceStatus,
  StrategyType,
  type CreateScenarioRequestDto,
  type ScenarioAssumptionSetDto,
  type ScenarioDto,
  type ScenarioRunDto,
  type UpdateScenarioRequestDto,
  type UpsertScenarioFundingStackRequestDto,
} from "@repo/contracts";
import { apiFetch } from "@/lib/api/client";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";

function optionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalInteger(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function isChecked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getGovernanceStatus(formData: FormData) {
  const value = formData.get("governanceStatus");
  if (value === ScenarioGovernanceStatus.DRAFT
    || value === ScenarioGovernanceStatus.ACTIVE_CANDIDATE
    || value === ScenarioGovernanceStatus.ARCHIVED) {
    return value;
  }

  return ScenarioGovernanceStatus.DRAFT;
}

function humanizeToken(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function generateScenarioName(formData: FormData) {
  const selectedProjectLabel = optionalString(formData, "selectedProjectLabel");
  const selectedParcelLabel = optionalString(formData, "selectedParcelLabel");
  const siteLabel = selectedProjectLabel ?? selectedParcelLabel?.split(" / ")[0] ?? "Selected site";
  const strategyLabel = humanizeToken(String(formData.get("strategyType") ?? StrategyType.FREE_MARKET_RENTAL));
  const templateLabel = optionalString(formData, "assumptionTemplateName")
    ?? humanizeToken(String(formData.get("assumptionProfileKey") ?? AssumptionProfileKey.BASELINE));

  return `${siteLabel} / ${strategyLabel} / ${templateLabel}`;
}

function buildAssumptionSet(formData: FormData): ScenarioAssumptionSetDto | null {
  const profileValue = String(formData.get("assumptionProfileKey") ?? AssumptionProfileKey.BASELINE);
  const profileKey = Object.values(AssumptionProfileKey).includes(profileValue as typeof AssumptionProfileKey[keyof typeof AssumptionProfileKey])
    ? (profileValue as ScenarioAssumptionSetDto["profileKey"])
    : AssumptionProfileKey.BASELINE;
  const templateKey = optionalString(formData, "assumptionTemplateKey");
  const templateName = optionalString(formData, "assumptionTemplateName");
  const overrides: ScenarioAssumptionSetDto["overrides"] = {
    planningBufferPct: optionalString(formData, "assumptionPlanningBufferPct"),
    efficiencyFactorPct: optionalString(formData, "assumptionEfficiencyFactorPct"),
    vacancyPct: optionalString(formData, "assumptionVacancyPct"),
    operatingCostPerNlaSqmYear: optionalString(formData, "assumptionOperatingCostPerNlaSqmYear"),
    acquisitionClosingCostPct: optionalString(formData, "assumptionAcquisitionClosingCostPct"),
    contingencyPct: optionalString(formData, "assumptionContingencyPct"),
    developerFeePct: optionalString(formData, "assumptionDeveloperFeePct"),
    targetProfitPct: optionalString(formData, "assumptionTargetProfitPct"),
    exitCapRatePct: optionalString(formData, "assumptionExitCapRatePct"),
    salesClosingCostPct: optionalString(formData, "assumptionSalesClosingCostPct"),
    salesAbsorptionMonths: optionalInteger(formData, "assumptionSalesAbsorptionMonths"),
    parkingRevenuePerSpaceMonth: optionalString(formData, "assumptionParkingRevenuePerSpaceMonth"),
    parkingSalePricePerSpace: optionalString(formData, "assumptionParkingSalePricePerSpace"),
  };
  const hasOverride = Object.values(overrides).some((value) => value !== null);
  const notes = optionalString(formData, "assumptionNotes");

  if (profileKey === AssumptionProfileKey.BASELINE && !templateKey && !hasOverride && !notes) {
    return null;
  }

  return {
    profileKey,
    templateKey,
    templateName,
    notes,
    overrides,
  };
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
  const generatedName = generateScenarioName(formData);
  return {
    projectId: optionalString(formData, "projectId"),
    parcelId: optionalString(formData, "parcelId"),
    parcelGroupId: optionalString(formData, "parcelGroupId"),
    name: optionalString(formData, "name") ?? generatedName,
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
    governanceStatus: getGovernanceStatus(formData),
    isCurrentBest: isChecked(formData, "isCurrentBest"),
    assumptionSet: buildAssumptionSet(formData),
  };
}

async function maybeUpdateWorkspaceDefaultTemplate(orgSlug: string, formData: FormData) {
  if (!isChecked(formData, "applyWorkspaceDefaultTemplate")) {
    return;
  }

  const templateKey = optionalString(formData, "assumptionTemplateKey");
  await apiFetch(orgSlug, "/api/v1/scenarios/assumption-templates/workspace-default", {
    method: "PATCH",
    body: JSON.stringify({ defaultTemplateKey: templateKey }),
  });
}

function buildErrorRedirect(pathname: string, code: string, message?: string, extraParams?: Record<string, string | null | undefined>) {
  const [basePath, existingQuery] = pathname.split("?", 2);
  const search = new URLSearchParams(existingQuery ?? "");
  search.set("error", code);
  if (message) search.set("message", message.slice(0, 220));

  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) search.set(key, value);
  }

  return `${basePath}?${search.toString()}`;
}

export async function createScenarioAction(orgSlug: string, formData: FormData) {
  const parsedMix = safeParseOptionalJsonField(formData, "strategyMixJson");
  const parcelId = optionalString(formData, "parcelId");
  const projectId = optionalString(formData, "projectId");

  if (!parsedMix.ok) {
    redirect(`/${orgSlug}/scenarios/new?error=invalid-strategy-mix-json${projectId ? `&projectId=${projectId}` : parcelId ? `&parcelId=${parcelId}` : ""}`);
  }

  try {
    const scenario = await apiFetch<ScenarioDto>(orgSlug, "/api/v1/scenarios", {
      method: "POST",
      body: JSON.stringify(buildScenarioPayload(formData, parsedMix.value)),
    });
    await maybeUpdateWorkspaceDefaultTemplate(orgSlug, formData);

    redirect(`/${orgSlug}/scenarios/${scenario.id}/builder`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(`/${orgSlug}/scenarios/new`, "create-request-failed", error.message, { parcelId, projectId }));
    }

    throw error;
  }
}

export async function updateScenarioAction(orgSlug: string, scenarioId: string, formData: FormData) {
  const parsedMix = safeParseOptionalJsonField(formData, "strategyMixJson");
  if (!parsedMix.ok) {
    redirect(`/${orgSlug}/scenarios/${scenarioId}/builder?error=invalid-strategy-mix-json`);
  }

  const payload: UpdateScenarioRequestDto = buildScenarioPayload(formData, parsedMix.value);
  try {
    await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    await maybeUpdateWorkspaceDefaultTemplate(orgSlug, formData);

    revalidatePath(`/${orgSlug}/scenarios/${scenarioId}/builder`);
    redirect(`/${orgSlug}/scenarios/${scenarioId}/builder`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(`/${orgSlug}/scenarios/${scenarioId}/builder`, "save-request-failed", error.message));
    }

    throw error;
  }
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

  try {
    await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}/funding-stack`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });

    revalidatePath(`/${orgSlug}/scenarios/${scenarioId}/builder`);
    redirect(`/${orgSlug}/scenarios/${scenarioId}/builder`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(`/${orgSlug}/scenarios/${scenarioId}/builder`, "funding-request-failed", error.message));
    }

    throw error;
  }
}

export async function triggerFeasibilityRunAction(orgSlug: string, scenarioId: string) {
  try {
    const run = await apiFetch<ScenarioRunDto>(orgSlug, `/api/v1/scenarios/${scenarioId}/feasibility-runs`, {
      method: "POST",
    });

    redirect(`/${orgSlug}/scenarios/${scenarioId}/results/${run.id}`);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(`/${orgSlug}/scenarios/${scenarioId}/builder`, "run-request-failed", error.message));
    }

    throw error;
  }
}

export async function setScenarioGovernanceAction(
  orgSlug: string,
  scenarioId: string,
  nextGovernanceStatus: ScenarioGovernanceStatus,
  returnTo: string,
) {
  try {
    const payload: UpdateScenarioRequestDto = nextGovernanceStatus === ScenarioGovernanceStatus.ACTIVE_CANDIDATE
      ? { governanceStatus: nextGovernanceStatus }
      : { governanceStatus: nextGovernanceStatus, isCurrentBest: false };

    await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });

    revalidatePath(`/${orgSlug}/scenarios`);
    revalidatePath(`/${orgSlug}/scenarios/${scenarioId}/builder`);
    redirect(returnTo);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(returnTo, "status-request-failed", error.message));
    }

    throw error;
  }
}

export async function setScenarioCurrentBestAction(
  orgSlug: string,
  scenarioId: string,
  returnTo: string,
) {
  try {
    await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`, {
      method: "PATCH",
      body: JSON.stringify({
        governanceStatus: ScenarioGovernanceStatus.ACTIVE_CANDIDATE,
        isCurrentBest: true,
      }),
    });

    revalidatePath(`/${orgSlug}/scenarios`);
    revalidatePath(`/${orgSlug}/scenarios/${scenarioId}/builder`);
    redirect(returnTo);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(returnTo, "status-request-failed", error.message));
    }

    throw error;
  }
}

export async function archiveScenarioVariantsAction(
  orgSlug: string,
  returnTo: string,
  formData: FormData,
) {
  const scenarioIds = Array.from(new Set(
    formData
      .getAll("scenarioId")
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0),
  ));

  if (!scenarioIds.length) {
    redirect(returnTo);
  }

  try {
    await Promise.all(
      scenarioIds.map((scenarioId) => apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`, {
        method: "PATCH",
        body: JSON.stringify({
          governanceStatus: ScenarioGovernanceStatus.ARCHIVED,
          isCurrentBest: false,
        }),
      })),
    );

    revalidatePath(`/${orgSlug}/scenarios`);
    redirect(returnTo);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(returnTo, "status-request-failed", error.message));
    }

    throw error;
  }
}

export async function resolveScenarioFamilyAction(
  orgSlug: string,
  returnTo: string,
  formData: FormData,
) {
  const leadScenarioId = optionalString(formData, "leadScenarioId");
  const archiveScenarioIds = Array.from(new Set(
    formData
      .getAll("archiveScenarioId")
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .filter((scenarioId) => scenarioId !== leadScenarioId),
  ));

  if (!leadScenarioId) {
    redirect(returnTo);
  }

  try {
    await apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${leadScenarioId}`, {
      method: "PATCH",
      body: JSON.stringify({
        governanceStatus: ScenarioGovernanceStatus.ACTIVE_CANDIDATE,
        isCurrentBest: true,
      }),
    });

    if (archiveScenarioIds.length) {
      await Promise.all(
        archiveScenarioIds.map((scenarioId) => apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`, {
          method: "PATCH",
          body: JSON.stringify({
            governanceStatus: ScenarioGovernanceStatus.ARCHIVED,
            isCurrentBest: false,
          }),
        })),
      );
    }

    revalidatePath(`/${orgSlug}/scenarios`);
    revalidatePath(`/${orgSlug}/scenarios/${leadScenarioId}/builder`);
    redirect(returnTo);
  } catch (error) {
    if (isApiResponseError(error) || isApiUnavailableError(error)) {
      redirect(buildErrorRedirect(returnTo, "status-request-failed", error.message));
    }

    throw error;
  }
}
