import type {
  ListFundingProgramsResponseDto,
  ListScenariosResponseDto,
  ScenarioDto,
  ScenarioReadinessDto,
  ScenarioRunDto,
} from "@repo/contracts";
import { apiFetch } from "./client";

export function getScenarios(orgSlug: string) {
  return apiFetch<ListScenariosResponseDto>(orgSlug, "/api/v1/scenarios");
}

export function getScenario(orgSlug: string, scenarioId: string) {
  return apiFetch<ScenarioDto>(orgSlug, `/api/v1/scenarios/${scenarioId}`);
}

export function getScenarioReadiness(orgSlug: string, scenarioId: string) {
  return apiFetch<ScenarioReadinessDto>(orgSlug, `/api/v1/scenarios/${scenarioId}/readiness`);
}

export function getScenarioRun(orgSlug: string, runId: string) {
  return apiFetch<ScenarioRunDto>(orgSlug, `/api/v1/scenario-runs/${runId}`);
}

export function getFundingPrograms(orgSlug: string) {
  return apiFetch<ListFundingProgramsResponseDto>(orgSlug, "/api/v1/funding-programs");
}
