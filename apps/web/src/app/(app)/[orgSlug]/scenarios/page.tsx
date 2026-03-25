import Link from "next/link";
import { getScenarios } from "@/lib/api/scenarios";
import { optimizationTargetLabels, strategyTypeLabels } from "@/lib/ui/enum-labels";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ScenariosPage({ params }: { params: { orgSlug: string } }) {
  const scenarios = await getScenarios(params.orgSlug);

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scenarios</h1>
          <p className="text-sm text-slate-600">Thin Sprint 1 scenario list wired to the org-scoped REST surface.</p>
        </div>
        <Link className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white" href={`/${params.orgSlug}/scenarios/new`}>
          New Scenario
        </Link>
      </div>

      <div className="grid gap-4">
        {scenarios.items.map((scenario) => (
          <Card key={scenario.id}>
            <CardHeader>
              <CardTitle>{scenario.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <div className="space-y-1 text-sm text-slate-600">
                <div>Status: {scenario.status}</div>
                <div>Strategy: {strategyTypeLabels[scenario.strategyType]}</div>
                <div>Optimization: {optimizationTargetLabels[scenario.optimizationTarget]}</div>
              </div>
              <Link className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm" href={`/${params.orgSlug}/scenarios/${scenario.id}/builder`}>
                Open Builder
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
