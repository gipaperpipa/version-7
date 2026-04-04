import type {
  FinancialResultDto,
  ScenarioComparisonEntryDto,
  ScenarioComparisonResponseDto,
  ScenarioResultExplanationDto,
  ScenarioRunDto,
} from "@repo/contracts";

function toStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function toTrimmedString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function normalizeScenarioResultExplanation(explanation: unknown): ScenarioResultExplanationDto | null {
  if (!explanation || typeof explanation !== "object" || Array.isArray(explanation)) {
    return null;
  }

  const record = explanation as Record<string, unknown>;
  const dominantDrivers = toStringArray(record.dominantDrivers);
  const fallbackAssumptions = toStringArray(record.fallbackAssumptions);
  const capitalStackNarrative = toStringArray(record.capitalStackNarrative);
  const weakestLinks = toStringArray(record.weakestLinks);
  const tradeoffs = toStringArray(record.tradeoffs);
  const nextActions = toStringArray(record.nextActions);
  const heuristicVersion = toTrimmedString(record.heuristicVersion) ?? "heuristic-run";
  const summary =
    toTrimmedString(record.summary)
    ?? dominantDrivers[0]
    ?? fallbackAssumptions[0]
    ?? "This run returned a partial explanation payload.";
  const objectiveNarrative =
    toTrimmedString(record.objectiveNarrative)
    ?? "No explicit objective narrative was returned for this run.";

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

function normalizeFinancialResult(result: FinancialResultDto | null): FinancialResultDto | null {
  if (!result) {
    return null;
  }

  return {
    ...result,
    explanation: normalizeScenarioResultExplanation(result.explanation),
  };
}

export function normalizeScenarioRunDto(run: ScenarioRunDto): ScenarioRunDto {
  return {
    ...run,
    financialResult: normalizeFinancialResult(run.financialResult),
  };
}

function normalizeComparisonEntry(entry: ScenarioComparisonEntryDto): ScenarioComparisonEntryDto {
  return {
    ...entry,
    latestRun: entry.latestRun ? normalizeScenarioRunDto(entry.latestRun) : null,
    topDrivers: toStringArray(entry.topDrivers),
  };
}

export function normalizeScenarioComparisonResponse(
  comparison: ScenarioComparisonResponseDto,
): ScenarioComparisonResponseDto {
  return {
    ...comparison,
    entries: comparison.entries.map(normalizeComparisonEntry),
  };
}
