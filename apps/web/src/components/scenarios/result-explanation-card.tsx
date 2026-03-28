import type { ScenarioResultExplanationDto } from "@repo/contracts";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { SectionCard } from "@/components/ui/section-card";

export function ResultExplanationCard({ explanation }: { explanation: ScenarioResultExplanationDto | null }) {
  if (!explanation) return null;

  return (
    <SectionCard
      eyebrow="Result explanation"
      title="Why the engine landed here"
      description={`Heuristic version ${explanation.heuristicVersion}`}
      tone="accent"
    >
      <div className="content-stack">
        <div className="insight-item">{explanation.summary}</div>

        <div className="dual-grid">
          <DiagnosticGroup title="Dominant drivers" emptyLabel="No dominant drivers were returned.">
            {explanation.dominantDrivers.map((item) => (
              <div key={item} className="insight-item">{item}</div>
            ))}
          </DiagnosticGroup>

          <DiagnosticGroup title="Fallback assumptions" emptyLabel="No fallback assumptions were recorded.">
            {explanation.fallbackAssumptions.map((item) => (
              <div key={item} className="insight-item">{item}</div>
            ))}
          </DiagnosticGroup>
        </div>

        <DiagnosticGroup title="Capital stack narrative" emptyLabel="No capital stack narrative was returned.">
          {explanation.capitalStackNarrative.map((item) => (
            <div key={item} className="insight-item">{item}</div>
          ))}
        </DiagnosticGroup>
      </div>
    </SectionCard>
  );
}
