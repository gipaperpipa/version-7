import type { ScenarioReadinessDto, ScenarioRunDto } from "@repo/contracts";
import type { BadgeVariant } from "@/components/ui/badge";

export interface DecisionVerdict {
  title: string;
  summary: string;
  tone: BadgeVariant;
}

function hasPlanningCriticalMissingData(run: ScenarioRunDto) {
  return (run.missingDataFlags ?? []).some((flag) => ["BUILDABLE_WINDOW", "GRZ", "GFZ"].includes(flag));
}

export function getReadinessVerdict(readiness: ScenarioReadinessDto): DecisionVerdict {
  if (readiness.summary.executionBlockers > 0 || readiness.status === "BLOCKED") {
    return {
      title: "Blocked from execution",
      summary: "Execution blockers still prevent a directional run. Resolve the planning, parcel, or scenario-critical gaps first.",
      tone: "danger",
    };
  }

  if (readiness.summary.confidenceBlockers > 0 || readiness.status === "READY_WITH_WARNINGS") {
    return {
      title: "Runnable with confidence gaps",
      summary: "The engine can run, but confidence-critical gaps still weaken the decision signal and should be reviewed before relying on the output.",
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
    run.confidence?.outputConfidencePct == null ||
    run.confidence.outputConfidencePct < 60 ||
    (run.missingDataFlags ?? []).length >= 2
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
