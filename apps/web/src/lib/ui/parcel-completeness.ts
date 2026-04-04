import {
  CORE_PLANNING_KEY_SLUGS,
  type ParcelDto,
  type PlanningParameterDto,
  type ScenarioDto,
  type ScenarioReadinessDto,
} from "@repo/contracts";
import type { BadgeVariant } from "@/components/ui/badge";
import { getConfidenceBand, getSourceLabel } from "./provenance";

export type ParcelCompletenessTone = BadgeVariant;
export type ParcelNextBestActionKind =
  | "complete_parcel_context"
  | "capture_planning_inputs"
  | "create_scenario"
  | "resolve_scenario_blockers"
  | "run_feasibility"
  | "review_latest_result";

export interface ParcelCompletenessItem {
  label: string;
  detail: string;
  tone: ParcelCompletenessTone;
}

export interface ParcelNextBestAction {
  kind: ParcelNextBestActionKind;
  label: string;
  detail: string;
  tone: ParcelCompletenessTone;
}

export interface ParcelCompletenessSummary {
  sourceStatus: ParcelCompletenessItem;
  planningCompleteness: ParcelCompletenessItem;
  scenarioContinuity: ParcelCompletenessItem;
  nextBestAction: ParcelNextBestAction;
}

function getParcelTrustMode(parcel: ParcelDto) {
  return parcel.provenance?.trustMode ?? null;
}

function hasDerivedGeometry(parcel: ParcelDto) {
  return parcel.provenance?.geometryDerived ?? Boolean(parcel.geom);
}

function hasDerivedArea(parcel: ParcelDto) {
  return parcel.provenance?.areaDerived ?? Boolean(parcel.landAreaSqm);
}

function hasStoredPlanningValue(item: PlanningParameterDto) {
  return item.valueNumber !== null || item.valueBoolean !== null || item.valueJson !== null || item.geom !== null;
}

function isPlanningValuePresent(item: PlanningParameterDto | undefined) {
  return item ? hasStoredPlanningValue(item) : false;
}

function getPlanningValue(items: PlanningParameterDto[], keySlug: string) {
  return items.find((item) => item.keySlug === keySlug);
}

function getSourceStatus(parcel: ParcelDto): ParcelCompletenessItem {
  const sourceLabel = getSourceLabel(parcel.sourceType);
  const confidenceBand = getConfidenceBand(parcel.confidenceScore);
  const trustMode = getParcelTrustMode(parcel);
  const hasLandArea = hasDerivedArea(parcel);
  const hasGeometry = hasDerivedGeometry(parcel);

  if (trustMode === "SOURCE_PRIMARY") {
    return {
      label: "Source primary",
      detail: "Parcel identity, geometry, and area are coming from source-backed intake and can carry directly into planning work.",
      tone: "success",
    };
  }

  if (trustMode === "SOURCE_INCOMPLETE") {
    return {
      label: "Source incomplete",
      detail: hasGeometry || hasLandArea
        ? "This parcel came from source intake, but one part of the core site identity still needs confirmation."
        : "This parcel came from source intake, but geometry and area are still incomplete.",
      tone: "warning",
    };
  }

  if (trustMode === "GROUP_DERIVED" || parcel.isGroupSite) {
    return {
      label: "Grouped site",
      detail: parcel.constituentParcels.length
        ? `Combined site derived from ${parcel.constituentParcels.length} sourced parcel${parcel.constituentParcels.length === 1 ? "" : "s"}.`
        : "Combined site identity is derived from sourced parcel members.",
      tone: hasGeometry && hasLandArea ? "accent" : "warning",
    };
  }

  if (trustMode === "MANUAL_FALLBACK") {
    return {
      label: confidenceBand === "Low" ? "Low-trust manual fallback" : "Manual fallback",
      detail: hasLandArea
        ? "Manual parcel context is usable, but source-backed parcel identity remains the intended working model."
        : "Manual fallback intake is still incomplete and should be replaced with source-backed context when available.",
      tone: confidenceBand === "Low" ? "warning" : "surface",
    };
  }

  if (sourceLabel === "Source" && confidenceBand === "High" && hasLandArea) {
    return {
      label: "Source-aligned",
      detail: "Parcel context and area look source-backed and ready for downstream planning work.",
      tone: "success",
    };
  }

  if (sourceLabel === "Source" && confidenceBand !== "Low") {
    return {
      label: "Source-backed",
      detail: hasLandArea
        ? "This parcel is grounded in sourced context, though the signal is not yet top-confidence."
        : "This parcel is source-backed, but area or other core site context still needs confirmation.",
      tone: "accent",
    };
  }

  if (sourceLabel === "Derived") {
    return {
      label: "Derived context",
      detail: hasLandArea
        ? "This parcel includes system-derived context that can support planning interpretation."
        : "Derived parcel context exists, but core site information is still incomplete.",
      tone: "info",
    };
  }

  if (sourceLabel === "Manual") {
    return {
      label: confidenceBand === "Low" ? "Low-trust manual fallback" : "Manual fallback",
      detail: hasLandArea
        ? "This parcel is usable for Sprint 1, but manual intake is a fallback rather than the intended long-term model."
        : "Manual intake is still incomplete. Real product direction expects sourced parcel context.",
      tone: confidenceBand === "Low" ? "warning" : "surface",
    };
  }

  return {
    label: "Context still thin",
    detail: "Parcel context is still sparse, so trust and downstream continuity are limited.",
    tone: "warning",
  };
}

function getPlanningCompleteness(parcel: ParcelDto, planningItems: PlanningParameterDto[]): ParcelCompletenessItem {
  const hasAnyPlanning = planningItems.some(hasStoredPlanningValue);
  const hasLandArea = hasDerivedArea(parcel);
  const hasFootprintInput =
    isPlanningValuePresent(getPlanningValue(planningItems, CORE_PLANNING_KEY_SLUGS.BUILDABLE_WINDOW)) ||
    isPlanningValuePresent(getPlanningValue(planningItems, CORE_PLANNING_KEY_SLUGS.GRZ));
  const hasVolumeInput =
    isPlanningValuePresent(getPlanningValue(planningItems, CORE_PLANNING_KEY_SLUGS.GFZ)) ||
    isPlanningValuePresent(getPlanningValue(planningItems, CORE_PLANNING_KEY_SLUGS.MAX_BGF_SQM)) ||
    isPlanningValuePresent(getPlanningValue(planningItems, CORE_PLANNING_KEY_SLUGS.MAX_HEIGHT_M)) ||
    isPlanningValuePresent(getPlanningValue(planningItems, CORE_PLANNING_KEY_SLUGS.MAX_FLOORS));

  if (!hasAnyPlanning) {
    return {
      label: "Planning not started",
      detail: "No planning parameters are recorded yet. Buildability context still needs to be captured.",
      tone: "warning",
    };
  }

  if (hasLandArea && hasFootprintInput && hasVolumeInput) {
    return {
      label: "Planning materially complete",
      detail: "The parcel has enough buildability context to support scenario setup and readiness checks.",
      tone: "success",
    };
  }

  return {
    label: "Planning in progress",
    detail: "Some planning inputs exist, but buildability context is still incomplete for a stronger decision signal.",
    tone: "accent",
  };
}

export function selectPrimaryLinkedScenario(linkedScenarios: ScenarioDto[]) {
  return [...linkedScenarios].sort((left, right) => {
    const leftSignal = left.latestRunAt ?? left.updatedAt;
    const rightSignal = right.latestRunAt ?? right.updatedAt;
    return new Date(rightSignal).getTime() - new Date(leftSignal).getTime();
  })[0];
}

function getScenarioContinuity(
  linkedScenarios: ScenarioDto[],
  primaryReadiness?: ScenarioReadinessDto | null,
): ParcelCompletenessItem {
  if (!linkedScenarios.length) {
    return {
      label: "Ready for scenario",
      detail: "No linked scenario exists yet. The next structured step is to frame one decision case for this site.",
      tone: "accent",
    };
  }

  const primaryScenario = selectPrimaryLinkedScenario(linkedScenarios);

  if (primaryScenario?.latestRunAt) {
    return {
      label: "Scenario has run history",
      detail: "At least one linked scenario has already been run, so this parcel is connected to result review.",
      tone: "success",
    };
  }

  if (primaryReadiness) {
    if (primaryReadiness.status === "BLOCKED") {
      return {
        label: "Scenario blocked",
        detail: "A linked scenario exists, but readiness still has blocking issues before a run can proceed.",
        tone: "danger",
      };
    }

    if (primaryReadiness.status === "READY_WITH_WARNINGS") {
      return {
        label: "Scenario ready with warnings",
        detail: "A linked scenario can run, but the current signal still carries important caveats.",
        tone: "warning",
      };
    }

    return {
      label: "Scenario runnable",
      detail: "A linked scenario is ready to move into a heuristic run.",
      tone: "success",
    };
  }

  return {
    label: "Scenario drafted",
    detail: "A linked scenario exists, but it has not yet moved into run-ready continuity.",
    tone: "info",
  };
}

function getNextBestAction(
  parcel: ParcelDto,
  planningItems: PlanningParameterDto[],
  linkedScenarios: ScenarioDto[],
  primaryReadiness?: ScenarioReadinessDto | null,
): ParcelNextBestAction {
  const trustMode = getParcelTrustMode(parcel);
  const hasLandArea = hasDerivedArea(parcel);
  const hasGeometry = hasDerivedGeometry(parcel);
  const planningCompleteness = getPlanningCompleteness(parcel, planningItems);
  const primaryScenario = linkedScenarios.length ? selectPrimaryLinkedScenario(linkedScenarios) : null;

  if (!hasLandArea || (!hasGeometry && trustMode !== "MANUAL_FALLBACK")) {
    return {
      kind: "complete_parcel_context",
      label: trustMode === "SOURCE_INCOMPLETE" || trustMode === "GROUP_DERIVED"
        ? "Resolve source parcel gaps"
        : "Complete parcel context",
      detail: trustMode === "SOURCE_INCOMPLETE" || trustMode === "GROUP_DERIVED"
        ? "Confirm the missing sourced geometry or area before relying on this site in downstream planning and scenario work."
        : "Add the missing parcel basics so the site can support planning interpretation.",
      tone: "warning",
    };
  }

  if (planningCompleteness.label !== "Planning materially complete") {
    return {
      kind: "capture_planning_inputs",
      label: "Capture planning inputs",
      detail: "Add the buildability context needed to carry this parcel into a confident scenario workflow.",
      tone: "accent",
    };
  }

  if (!linkedScenarios.length) {
    return {
      kind: "create_scenario",
      label: "Create scenario",
      detail: "The parcel is ready to move into strategy setup and feasibility framing.",
      tone: "accent",
    };
  }

  if (primaryScenario?.latestRunAt) {
    return {
      kind: "review_latest_result",
      label: "Review latest result",
      detail: "Return to the most recent scenario output and decide whether assumptions need refinement.",
      tone: "success",
    };
  }

  if (primaryReadiness?.status === "BLOCKED") {
    return {
      kind: "resolve_scenario_blockers",
      label: "Resolve scenario blockers",
      detail: "Use the linked scenario builder to clear readiness blockers before running feasibility.",
      tone: "danger",
    };
  }

  if (primaryReadiness?.canRun) {
    return {
      kind: "run_feasibility",
      label: "Run feasibility",
      detail: "The linked scenario is ready to move into a heuristic run.",
      tone: "success",
    };
  }

  return {
    kind: "create_scenario",
    label: "Create scenario",
    detail: "Use a scenario to convert this parcel and its planning context into a decision case.",
    tone: "accent",
  };
}

export function buildParcelCompletenessSummary(input: {
  parcel: ParcelDto;
  planningItems: PlanningParameterDto[];
  linkedScenarios: ScenarioDto[];
  primaryReadiness?: ScenarioReadinessDto | null;
}): ParcelCompletenessSummary {
  const { parcel, planningItems, linkedScenarios, primaryReadiness } = input;

  return {
    sourceStatus: getSourceStatus(parcel),
    planningCompleteness: getPlanningCompleteness(parcel, planningItems),
    scenarioContinuity: getScenarioContinuity(linkedScenarios, primaryReadiness),
    nextBestAction: getNextBestAction(parcel, planningItems, linkedScenarios, primaryReadiness),
  };
}
