import type { ScenarioResultExplanationDto } from "@repo/contracts";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

export function ResultExplanationCard({ explanation }: { explanation: ScenarioResultExplanationDto | null }) {
  if (!explanation) return null;

  return (
    <SectionCard
      eyebrow="Result explanation"
      title="Engine readout"
      tone="accent"
      size="compact"
      actions={<StatusBadge tone="surface">{explanation.heuristicVersion}</StatusBadge>}
    >
      <div className="content-stack">
        <div className="insight-item">{explanation.summary}</div>

        <div className="dual-grid">
          <DiagnosticGroup title="Drivers" emptyLabel="No dominant drivers were returned.">
            {explanation.dominantDrivers.map((item) => (
              <div key={item} className="insight-item">{item}</div>
            ))}
          </DiagnosticGroup>

          <DiagnosticGroup title="Fallbacks" emptyLabel="No fallback assumptions were recorded.">
            {explanation.fallbackAssumptions.map((item) => (
              <div key={item} className="insight-item">{item}</div>
            ))}
          </DiagnosticGroup>
        </div>

        <DiagnosticGroup title="Capital logic" emptyLabel="No capital stack narrative was returned.">
          {explanation.capitalStackNarrative.map((item) => (
            <div key={item} className="insight-item">{item}</div>
          ))}
        </DiagnosticGroup>
      </div>
    </SectionCard>
  );
}
