import { getParcels } from "@/lib/api/parcels";
import { getFundingPrograms, getScenario, getScenarioReadiness } from "@/lib/api/scenarios";
import { FundingStackForm } from "@/components/scenarios/funding-stack-form";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { ScenarioReadinessBanner } from "@/components/scenarios/scenario-readiness-banner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { replaceFundingStackAction, triggerFeasibilityRunAction, updateScenarioAction } from "../../actions";
import { Button } from "@/components/ui/button";

export default async function ScenarioBuilderPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; scenarioId: string };
  searchParams?: { error?: string };
}) {
  const [scenario, readiness, fundingPrograms, parcels] = await Promise.all([
    getScenario(params.orgSlug, params.scenarioId),
    getScenarioReadiness(params.orgSlug, params.scenarioId),
    getFundingPrograms(params.orgSlug),
    getParcels(params.orgSlug),
  ]);

  const updateAction = updateScenarioAction.bind(null, params.orgSlug, params.scenarioId);
  const fundingAction = replaceFundingStackAction.bind(null, params.orgSlug, params.scenarioId);
  const runAction = triggerFeasibilityRunAction.bind(null, params.orgSlug, params.scenarioId);

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">{scenario.name}</h1>
        <p className="text-sm text-slate-600">Thin executable builder flow for heuristic Sprint 1 feasibility.</p>
      </div>

      {searchParams?.error === "invalid-strategy-mix-json" ? (
        <Alert className="border-red-300 bg-red-50 text-red-950">
          <AlertTitle>Invalid mix configuration JSON</AlertTitle>
          <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix it and save the scenario again.</AlertDescription>
        </Alert>
      ) : null}

      <ScenarioReadinessBanner readiness={readiness} />

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ScenarioEditorForm
          action={updateAction}
          parcels={parcels.items}
          initialScenario={scenario}
          submitLabel="Save Scenario"
        />

        <div className="space-y-4">
          <FundingStackForm
            action={fundingAction}
            fundingPrograms={fundingPrograms.items}
            selectedItems={scenario.fundingVariants}
          />

          <Card>
            <CardHeader>
              <CardTitle>Run Heuristic Feasibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-600">
                This triggers the explicitly heuristic and replaceable v0 engine.
              </p>
              <form action={runAction}>
                <Button type="submit" disabled={!readiness.canRun}>Run Feasibility</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Readiness Issues</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {readiness.issues.length ? readiness.issues.map((issue) => (
                <div key={`${issue.code}-${issue.field ?? "global"}`} className="rounded-md border border-slate-200 p-3">
                  <div className="font-medium">{issue.severity}: {issue.code}</div>
                  <div className="text-slate-600">{issue.message}</div>
                </div>
              )) : (
                <div className="text-slate-600">No readiness issues.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
