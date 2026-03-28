import type { ScenarioReadinessDto } from "@repo/contracts";
import { getReadinessVerdict } from "@/lib/ui/verdicts";
import { VerdictPanel } from "@/components/ui/verdict-panel";

export function ScenarioReadinessBanner({ readiness }: { readiness: ScenarioReadinessDto }) {
  const verdict = getReadinessVerdict(readiness);

  return (
    <VerdictPanel
      eyebrow="Readiness verdict"
      title={verdict.title}
      summary={verdict.summary}
      tone={verdict.tone}
      context={`${readiness.issues.length} readiness issue(s) currently shape this scenario.`}
    />
  );
}
