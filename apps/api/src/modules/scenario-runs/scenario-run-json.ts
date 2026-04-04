import {
  ScenarioReadinessIssueSeverity,
} from "../../generated-contracts/enums";
import type { RunWarningDto } from "../../generated-contracts/common";
import type { ScenarioReadinessIssueDto } from "../../generated-contracts/readiness";
import type { ScenarioResultExplanationDto } from "../../generated-contracts/feasibility";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function decodeRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

export function decodeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function decodeRunWarnings(value: unknown): RunWarningDto[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (typeof item.code !== "string" || typeof item.message !== "string") return [];

    return [{
      code: item.code,
      message: item.message,
      field: typeof item.field === "string" ? item.field : undefined,
    }];
  });
}

export function decodeReadinessIssues(value: unknown): ScenarioReadinessIssueDto[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    if (!isRecord(item)) return [];
    if (typeof item.code !== "string" || typeof item.message !== "string") return [];
    if (
      item.severity !== ScenarioReadinessIssueSeverity.BLOCKING &&
      item.severity !== ScenarioReadinessIssueSeverity.WARNING
    ) {
      return [];
    }

    return [{
      code: item.code as ScenarioReadinessIssueDto["code"],
      message: item.message,
      field: typeof item.field === "string" ? item.field : undefined,
      severity: item.severity,
    }];
  });
}

export function decodeExplanation(value: unknown): ScenarioResultExplanationDto | null {
  if (!isRecord(value)) return null;

  const dominantDrivers = decodeStringArray(value.dominantDrivers);
  const fallbackAssumptions = decodeStringArray(value.fallbackAssumptions);
  const capitalStackNarrative = decodeStringArray(value.capitalStackNarrative);
  const weakestLinks = decodeStringArray(value.weakestLinks);
  const tradeoffs = decodeStringArray(value.tradeoffs);
  const nextActions = decodeStringArray(value.nextActions);
  const heuristicVersion =
    typeof value.heuristicVersion === "string" && value.heuristicVersion.trim()
      ? value.heuristicVersion.trim()
      : "heuristic-run";
  const summary =
    typeof value.summary === "string" && value.summary.trim()
      ? value.summary.trim()
      : dominantDrivers[0]
        ?? fallbackAssumptions[0]
        ?? "This run returned a partial explanation payload.";
  const objectiveNarrative =
    typeof value.objectiveNarrative === "string" && value.objectiveNarrative.trim()
      ? value.objectiveNarrative.trim()
      : "No explicit objective narrative was returned for this run.";

  return {
    heuristicVersion,
    summary,
    objectiveNarrative,
    dominantDrivers,
    fallbackAssumptions,
    capitalStackNarrative,
    weakestLinks,
    tradeoffs,
    nextActions,
  };
}
