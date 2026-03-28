import type { ScenarioRunDto } from "@repo/contracts";
import { DiagnosticGroup } from "@/components/ui/diagnostic-group";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { StatusBadge, getConfidenceTone, getRunStatusTone } from "@/components/ui/status-badge";
import { humanizeTokenLabel } from "@/lib/ui/enum-labels";
import { getConfidenceBand } from "@/lib/ui/provenance";

function getConfidenceStatTone(band: string) {
  if (band === "High") return "success";
  if (band === "Medium") return "warning";
  if (band === "Low") return "danger";
  return "neutral";
}

export function RunDiagnosticsPanel({ run }: { run: ScenarioRunDto }) {
  const inputBand = getConfidenceBand(run.confidence.inputConfidencePct);
  const outputBand = getConfidenceBand(run.confidence.outputConfidencePct);
  const heuristicCaveats = run.warnings.filter((warning) => warning.code.startsWith("HEURISTIC_"));
  const otherWarnings = run.warnings.filter((warning) => !warning.code.startsWith("HEURISTIC_"));

  return (
    <SectionCard
      eyebrow="Diagnostics"
      title="Run quality and caveats"
      description="Keep the heuristics explicit: confidence, caveats, missing-data flags, and failure reasons stay visible next to the result."
    >
      <div className="content-stack">
        <div className="action-row">
          <StatusBadge tone={getRunStatusTone(run.status)}>{humanizeTokenLabel(run.status)}</StatusBadge>
          <StatusBadge tone={getConfidenceTone(inputBand)}>Input {inputBand}</StatusBadge>
          <StatusBadge tone={getConfidenceTone(outputBand)}>Output {outputBand}</StatusBadge>
          {run.errorMessage ? <StatusBadge tone="danger">Failure surfaced</StatusBadge> : null}
        </div>

        <div className="metrics-grid metrics-grid--compact">
          <StatBlock
            label="Input confidence"
            value={inputBand}
            caption={run.confidence.inputConfidencePct != null ? `Score ${run.confidence.inputConfidencePct}` : "No numeric score returned"}
            tone={getConfidenceStatTone(inputBand)}
          />
          <StatBlock
            label="Output confidence"
            value={outputBand}
            caption={run.confidence.outputConfidencePct != null ? `Score ${run.confidence.outputConfidencePct}` : "No numeric score returned"}
            tone={getConfidenceStatTone(outputBand)}
          />
        </div>

        {run.errorMessage ? (
          <SectionCard
            eyebrow="Failure reason"
            title="The run did not complete cleanly"
            description="Use the surfaced backend reason below before you decide whether to retry or return to the builder."
            tone="muted"
          >
            <div className="insight-item">{run.errorMessage}</div>
          </SectionCard>
        ) : null}

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Heuristic caveats" emptyLabel="No explicit heuristic caveats were returned for this run.">
            {heuristicCaveats.map((warning) => (
              <div key={warning.code} className="insight-item">
                {warning.message}
              </div>
            ))}
          </DiagnosticGroup>

          <DiagnosticGroup title="Missing data flags" emptyLabel="No missing-data flags were raised.">
            {run.missingDataFlags.length ? (
              <div className="chip-row">
                {run.missingDataFlags.map((flag) => (
                  <StatusBadge key={flag} tone="warning">{humanizeTokenLabel(flag)}</StatusBadge>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Additional warnings" emptyLabel="No non-heuristic warnings were returned.">
            {otherWarnings.map((warning) => (
              <div key={warning.code} className="insight-item">
                {warning.message}
              </div>
            ))}
          </DiagnosticGroup>

          <DiagnosticGroup title="Confidence reasoning" emptyLabel="No confidence reasoning text was returned.">
            {run.confidence.reasons.map((reason) => (
              <div key={reason} className="insight-item">
                {reason}
              </div>
            ))}
          </DiagnosticGroup>
        </div>
      </div>
    </SectionCard>
  );
}
