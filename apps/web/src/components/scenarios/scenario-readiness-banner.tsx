import type { ScenarioReadinessDto } from "@repo/contracts";
import { getReadinessVerdict } from "@/lib/ui/verdicts";
import { StatusBadge } from "@/components/ui/status-badge";
import { VerdictPanel } from "@/components/ui/verdict-panel";

export function ScenarioReadinessBanner({ readiness }: { readiness: ScenarioReadinessDto }) {
  const verdict = getReadinessVerdict(readiness);
  const blockerCount = readiness.issues.filter((issue) => issue.severity === "BLOCKING").length;
  const warningCount = readiness.issues.filter((issue) => issue.severity === "WARNING").length;
  const validatedLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(readiness.validatedAt));

  return (
    <VerdictPanel
      eyebrow="Readiness verdict"
      title={verdict.title}
      summary={verdict.summary}
      tone={verdict.tone}
      size="compact"
      context={(
        <div className="action-row">
          <StatusBadge tone={blockerCount ? "danger" : "success"}>
            {blockerCount} blocker{blockerCount === 1 ? "" : "s"}
          </StatusBadge>
          <StatusBadge tone={warningCount ? "warning" : "success"}>
            {warningCount} warning{warningCount === 1 ? "" : "s"}
          </StatusBadge>
          <StatusBadge tone="surface">Checked {validatedLabel}</StatusBadge>
        </div>
      )}
    />
  );
}
