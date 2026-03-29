import type { ScenarioResultExplanationDto } from "@repo/contracts";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";

export function ResultExplanationCard({ explanation }: { explanation: ScenarioResultExplanationDto | null }) {
  if (!explanation) return null;

  return (
    <SectionCard
      className="index-surface"
      eyebrow="Engine notes"
      title="Readout"
      tone="accent"
      size="compact"
      actions={<StatusBadge tone="surface">{explanation.heuristicVersion}</StatusBadge>}
    >
      <div className="content-stack">
        <div className="signal-row signal-row--contained">
          <div className="signal-row__badges">
            <StatusBadge tone="surface">Summary</StatusBadge>
          </div>
          <div className="signal-row__text">{explanation.summary}</div>
        </div>

        <div className="dual-grid">
          <DiagnosticGroup title="Drivers" emptyLabel="No dominant drivers were returned.">
            {explanation.dominantDrivers.length ? (
              <div className="signal-list">
                {explanation.dominantDrivers.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="accent">Driver</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>

          <DiagnosticGroup title="Fallbacks" emptyLabel="No fallback assumptions were recorded.">
            {explanation.fallbackAssumptions.length ? (
              <div className="signal-list">
                {explanation.fallbackAssumptions.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="warning">Fallback</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <DiagnosticGroup title="Capital logic" emptyLabel="No capital stack narrative was returned.">
          {explanation.capitalStackNarrative.length ? (
            <div className="signal-list">
              {explanation.capitalStackNarrative.map((item) => (
                <div key={item} className="signal-row">
                  <div className="signal-row__badges">
                    <StatusBadge tone="surface">Capital</StatusBadge>
                  </div>
                  <div className="signal-row__text">{item}</div>
                </div>
              ))}
            </div>
          ) : null}
        </DiagnosticGroup>
      </div>
    </SectionCard>
  );
}
