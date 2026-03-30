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
  if (
    typeof value.heuristicVersion !== "string" ||
    typeof value.summary !== "string" ||
    typeof value.objectiveNarrative !== "string"
  ) {
    return null;
  }

  return {
    heuristicVersion: value.heuristicVersion,
    summary: value.summary,
    objectiveNarrative: value.objectiveNarrative,
    dominantDrivers: decodeStringArray(value.dominantDrivers),
    fallbackAssumptions: decodeStringArray(value.fallbackAssumptions),
    capitalStackNarrative: decodeStringArray(value.capitalStackNarrative),
    weakestLinks: decodeStringArray(value.weakestLinks),
    tradeoffs: decodeStringArray(value.tradeoffs),
    nextActions: decodeStringArray(value.nextActions),
  };
}
