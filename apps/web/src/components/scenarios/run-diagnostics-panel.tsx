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
  const blockers = run.readinessIssues.filter((issue) => issue.severity === "BLOCKING");
  const readinessWarnings = run.readinessIssues.filter((issue) => issue.severity === "WARNING");
  const heuristicCaveats = run.warnings.filter((warning) => warning.code.startsWith("HEURISTIC_"));
  const otherWarnings = run.warnings.filter((warning) => !warning.code.startsWith("HEURISTIC_"));
  const combinedWarnings = Array.from(
    new Set([...readinessWarnings.map((warning) => warning.message), ...otherWarnings.map((warning) => warning.message)]),
  );

  return (
    <SectionCard
      eyebrow="Diagnostics"
      title="Risk and signal quality"
      description="Blockers, warnings, missing data, caveats, confidence."
      size="compact"
    >
      <div className="content-stack">
        <div className="action-row">
          <StatusBadge tone={getRunStatusTone(run.status)}>{humanizeTokenLabel(run.status)}</StatusBadge>
          <StatusBadge tone={getConfidenceTone(inputBand)}>Input {inputBand}</StatusBadge>
          <StatusBadge tone={getConfidenceTone(outputBand)}>Output {outputBand}</StatusBadge>
          {run.errorMessage ? <StatusBadge tone="danger">Failure surfaced</StatusBadge> : null}
        </div>

        <div className="metrics-grid">
          <StatBlock
            label="Blockers"
            value={blockers.length}
            caption={blockers.length ? "Readiness issues carried into the run" : "No blocking issues"}
            tone={blockers.length ? "danger" : "success"}
          />
          <StatBlock
            label="Warnings"
            value={combinedWarnings.length}
            caption={combinedWarnings.length ? "Non-blocking risk signals" : "No warning signals"}
            tone={combinedWarnings.length ? "warning" : "success"}
          />
          <StatBlock
            label="Missing data"
            value={run.missingDataFlags.length}
            caption={run.missingDataFlags.length ? "Fallback-dependent inputs" : "No missing-data flags"}
            tone={run.missingDataFlags.length ? "warning" : "success"}
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
            eyebrow="Failure"
            title="Run failure"
            description="Use the surfaced backend reason before retrying."
            tone="muted"
            size="compact"
          >
            <div className="insight-item">{run.errorMessage}</div>
          </SectionCard>
        ) : null}

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Blockers" emptyLabel="No blockers carried into this run.">
            {blockers.length ? (
              <div className="signal-list">
                {blockers.map((issue) => (
                  <div key={`${issue.code}-${issue.field ?? "global"}`} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="danger">{humanizeTokenLabel(issue.code)}</StatusBadge>
                      {issue.field ? <StatusBadge tone="info">{issue.field}</StatusBadge> : null}
                    </div>
                    <div className="signal-row__text">{issue.message}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>

          <DiagnosticGroup title="Warnings" emptyLabel="No warning signals surfaced.">
            {combinedWarnings.length ? (
              <div className="signal-list">
                {combinedWarnings.map((warning) => (
                  <div key={warning} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="warning">Warning</StatusBadge>
                    </div>
                    <div className="signal-row__text">{warning}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <div className="diagnostic-grid">
          <DiagnosticGroup title="Missing data" emptyLabel="No missing-data flags were raised.">
            {run.missingDataFlags.length ? (
              <div className="chip-row">
                {run.missingDataFlags.map((flag) => (
                  <StatusBadge key={flag} tone="warning">{humanizeTokenLabel(flag)}</StatusBadge>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>

          <DiagnosticGroup title="Heuristic caveats" emptyLabel="No heuristic caveats were returned.">
            {heuristicCaveats.length ? (
              <div className="signal-list">
                {heuristicCaveats.map((warning) => (
                  <div key={warning.code} className="signal-row">
                    <div className="signal-row__badges">
                      <StatusBadge tone="surface">{humanizeTokenLabel(warning.code)}</StatusBadge>
                    </div>
                    <div className="signal-row__text">{warning.message}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </DiagnosticGroup>
        </div>

        <DiagnosticGroup title="Confidence notes" emptyLabel="No confidence reasoning text was returned.">
          {run.confidence.reasons.length ? (
            <div className="signal-list">
              {run.confidence.reasons.map((reason) => (
                <div key={reason} className="signal-row">
                  <div className="signal-row__badges">
                    <StatusBadge tone="surface">Confidence</StatusBadge>
                  </div>
                  <div className="signal-row__text">{reason}</div>
                </div>
              ))}
            </div>
          ) : null}
        </DiagnosticGroup>
      </div>
    </SectionCard>
  );
}
