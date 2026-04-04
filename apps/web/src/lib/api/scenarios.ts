import type {
  ListFundingProgramsResponseDto,
  OptimizationTarget,
  ScenarioComparisonResponseDto,
  ListScenariosResponseDto,
  ScenarioDto,
  ScenarioReadinessDto,
  ScenarioRunDto,
} from "@repo/contracts";
import { apiFetch } from "./client";
import { normalizeScenarioComparisonResponse, normalizeScenarioRunDto } from "@/lib/scenarios/result-normalizers";

export function getScenarios(orgSlug: string) {
  return apiFetch<ListScenariosResponseDto>(orgSlug, "/api/v1/scenarios");
}

export function getScenarioComparison(
  orgSlug: string,
  scenarioIds: string[],
  rankingTarget?: OptimizationTarget,
) {
  const search = new URLSearchParams();
  scenarioIds.forEach((scenarioId) => search.append("scenarioId", scenarioId));
  if (rankingTarget) search.set("rankingTarget", rankingTarget);

  return apiFetch<ScenarioComparisonResponseDto>(orgSlug, `/api/v1/scenarios/compare?${search.toString()}`)
    .then(normalizeScenarioComparisonResponse);
}

export function getScenario(orgSlug: string, scenarioId: string) {
  return apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`);
}

export function getScenarioReadiness(orgSlug: string, scenarioId: string) {
  return apiFetch<ScenarioReadinessDto>(orgSlug, `/api/v1/scenarios/${scenarioId}/readiness`);
}

export function getScenarioRun(orgSlug: string, runId: string) {
  return apiFetch<ScenarioRunDto>(orgSlug, `/api/v1/scenario-runs/${runId}`).then(normalizeScenarioRunDto);
}

export function getFundingPrograms(orgSlug: string) {
  return apiFetch<ListFundingProgramsResponseDto>(orgSlug, "/api/v1/funding-programs");
}
