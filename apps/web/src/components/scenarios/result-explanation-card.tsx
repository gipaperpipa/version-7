import type { ScenarioResultExplanationDto } from "@repo/contracts";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { normalizeScenarioResultExplanation } from "@/lib/scenarios/result-normalizers";

export function ResultExplanationCard({ explanation }: { explanation: ScenarioResultExplanationDto | null }) {
  const normalizedExplanation = normalizeScenarioResultExplanation(explanation);

  if (!normalizedExplanation) return null;

  return (
    <SectionCard
      className="index-surface"
      eyebrow="Engine notes"
      title="Readout"
      tone="accent"
      size="compact"
      actions={<StatusBadge tone="surface">{normalizedExplanation.heuristicVersion}</StatusBadge>}
    >
      <div className="content-stack">
        <div className="signal-row signal-row--contained">
          <div className="signal-row__badges">
            <StatusBadge tone="surface">Summary</StatusBadge>
          </div>
          <div className="signal-row__text">{normalizedExplanation.summary}</div>
        </div>

        <div className="signal-row signal-row--contained">
          <div className="signal-row__badges">
            <StatusBadge tone="accent">Objective</StatusBadge>
          </div>
          <div className="signal-row__text">{normalizedExplanation.objectiveNarrative}</div>
        </div>

        <div className="dual-grid">
          <DiagnosticGroup title="Drivers" emptyLabel="No dominant drivers were returned.">
            {normalizedExplanation.dominantDrivers.length ? (
              <div className="signal-list">
                {normalizedExplanation.dominantDrivers.map((item) => (
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

          <DiagnosticGroup title="Weakest links" emptyLabel="No weakest links were recorded.">
            {normalizedExplanation.weakestLinks.length ? (
              <div className="signal-list">
                {normalizedExplanation.weakestLinks.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="warning">Risk</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Fallbacks" emptyLabel="No fallback assumptions were recorded.">
            {normalizedExplanation.fallbackAssumptions.length ? (
              <div className="signal-list">
                {normalizedExplanation.fallbackAssumptions.map((item) => (
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

          <DiagnosticGroup title="Tradeoffs" emptyLabel="No tradeoff notes were returned.">
            {normalizedExplanation.tradeoffs.length ? (
              <div className="signal-list">
                {normalizedExplanation.tradeoffs.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="surface">Tradeoff</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Capital logic" emptyLabel="No capital stack narrative was returned.">
            {normalizedExplanation.capitalStackNarrative.length ? (
              <div className="signal-list">
                {normalizedExplanation.capitalStackNarrative.map((item) => (
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

          <DiagnosticGroup title="Next moves" emptyLabel="No next-step recommendations were returned.">
            {normalizedExplanation.nextActions.length ? (
              <div className="signal-list">
                {normalizedExplanation.nextActions.map((item) => (
                  <div key={item} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="accent">Next</StatusBadge>
                    </div>
                    <div className="signal-row__text">{item}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>
      </div>
    </SectionCard>
  );
}
