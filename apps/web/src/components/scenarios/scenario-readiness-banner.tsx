import type { ScenarioReadinessDto } from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ScenarioReadinessBanner({ readiness }: { readiness: ScenarioReadinessDto }) {
  const variantClass =
    readiness.status === "BLOCKED"
      ? "border-red-300 bg-red-50 text-red-950"
      : readiness.status === "READY_WITH_WARNINGS"
        ? "border-amber-300 bg-amber-50 text-amber-950"
        : "border-emerald-300 bg-emerald-50 text-emerald-950";

  return (
    <Alert className={variantClass}>
      <AlertTitle>Scenario readiness: {readiness.status}</AlertTitle>
      <AlertDescription>
        {readiness.issues.length
          ? `${readiness.issues.length} readiness issue(s) detected before running heuristic v0 feasibility.`
          : "This scenario is ready for a heuristic v0 feasibility run."}
      </AlertDescription>
    </Alert>
  );
}
