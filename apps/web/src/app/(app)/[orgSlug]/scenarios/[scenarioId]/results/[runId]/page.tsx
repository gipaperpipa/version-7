import { getScenarioRun } from "@/lib/api/scenarios";
import { ResultExplanationCard } from "@/components/scenarios/result-explanation-card";
import { RunDiagnosticsPanel } from "@/components/scenarios/run-diagnostics-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function MetricCard({ title, value }: { title: string; value: string | number | null | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value ?? "n/a"}</CardContent>
    </Card>
  );
}

export default async function ScenarioResultPage({
  params,
}: {
  params: { orgSlug: string; scenarioId: string; runId: string };
}) {
  const run = await getScenarioRun(params.orgSlug, params.runId);
  const result = run.financialResult;

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Feasibility Result</h1>
        <p className="text-sm text-slate-600">Scenario {params.scenarioId} · Run {params.runId}</p>
      </div>

      <RunDiagnosticsPanel run={run} />
      <ResultExplanationCard explanation={result?.explanation ?? null} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Buildable BGF" value={result?.buildableBgfSqm} />
        <MetricCard title="Required Equity" value={result?.requiredEquity} />
        <MetricCard title="Break-even Rent" value={result?.breakEvenRentEurSqm} />
        <MetricCard title="Subsidy-adjusted Rent" value={result?.subsidyAdjustedBreakEvenRentEurSqm} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Heuristic Engine Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>Engine version: {run.engineVersion ?? "n/a"}</p>
          <p>Status: {run.status}</p>
          <p>Readiness status: {run.readinessStatus ?? "n/a"}</p>
          <p>This result remains explicitly heuristic and replaceable.</p>
        </CardContent>
      </Card>
    </div>
  );
}
