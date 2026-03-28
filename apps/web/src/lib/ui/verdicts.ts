import type { ScenarioReadinessDto, ScenarioRunDto } from "@repo/contracts";
import type { BadgeVariant } from "@/components/ui/badge";

export interface DecisionVerdict {
  title: string;
  summary: string;
  tone: BadgeVariant;
}

function hasPlanningCriticalMissingData(run: ScenarioRunDto) {
  return run.missingDataFlags.some((flag) => ["BUILDABLE_WINDOW", "GRZ", "GFZ"].includes(flag));
}

export function getReadinessVerdict(readiness: ScenarioReadinessDto): DecisionVerdict {
  if (readiness.status === "BLOCKED") {
    return {
      title: "Blocked by missing data",
      summary: "Key parcel, planning, or scenario inputs still block a reliable run.",
      tone: "danger",
    };
  }

  if (readiness.status === "READY_WITH_WARNINGS") {
    return {
      title: "Not ready for decision",
      summary: "The scenario can run, but the current signal still needs review before it supports a strong decision.",
      tone: "warning",
    };
  }

  return {
    title: "Ready for directional decision",
    summary: "The current inputs are sufficient to launch a directional heuristic run.",
    tone: "success",
  };
}

export function getRunVerdict(run: ScenarioRunDto): DecisionVerdict {
  if (run.status === "FAILED") {
    return {
      title: "Run failed",
      summary: "The workflow executed, but no valid result could be produced from the current run.",
      tone: "danger",
    };
  }

  if (run.status === "QUEUED" || run.status === "RUNNING") {
    return {
      title: "Run in progress",
      summary: "The scenario is still moving through the heuristic engine and does not yet support a decision.",
      tone: "accent",
    };
  }

  if (!run.financialResult) {
    return {
      title: "Not ready for decision",
      summary: "No result payload is available yet, so the scenario cannot support a directional decision.",
      tone: "warning",
    };
  }

  if (hasPlanningCriticalMissingData(run)) {
    return {
      title: "Needs planning refinement",
      summary: "Planning-critical buildability inputs are still missing or heuristic, so the result needs upstream refinement.",
      tone: "warning",
    };
  }

  if (
    run.confidence.outputConfidencePct == null ||
    run.confidence.outputConfidencePct < 60 ||
    run.missingDataFlags.length >= 2
  ) {
    return {
      title: "Not ready for decision",
      summary: "The result is usable for orientation, but missing-data fallbacks still weaken the decision signal.",
      tone: "warning",
    };
  }

  return {
    title: "Ready for directional decision",
    summary: "The current result is still heuristic, but it is coherent enough to guide the next investment discussion.",
    tone: "success",
  };
}
