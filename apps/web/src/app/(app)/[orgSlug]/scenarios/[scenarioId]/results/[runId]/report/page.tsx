import Link from "next/link";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScenarioReportView } from "@/components/reports/scenario-report-view";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcel } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { getScenario, getScenarioRun } from "@/lib/api/scenarios";

export default async function ScenarioResultReportPage({
  params,
}: {
  params: Promise<{ orgSlug: string; scenarioId: string; runId: string }>;
}) {
  const { orgSlug, scenarioId, runId } = await params;

  try {
    const [run, scenario] = await Promise.all([
      getScenarioRun(orgSlug, runId),
      getScenario(orgSlug, scenarioId),
    ]);

    const [parcel, planningParameters] = scenario.parcelId
      ? await Promise.all([
          getParcel(orgSlug, scenario.parcelId),
          getPlanningParameters(orgSlug, scenario.parcelId),
        ])
      : [null, { items: [] }];

    if (!run.financialResult) {
      return (
        <div className="workspace-page content-stack">
          <EmptyState
            eyebrow="Scenario report"
            title="A report needs a completed financial result"
            description="This run does not have a result payload yet, so the report view cannot assemble a scenario memo."
            actions={(
              <>
                <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/${scenarioId}/results/${runId}`}>
                  Back to result
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios/${scenarioId}/builder`}>
                  Open builder
                </Link>
              </>
            )}
          />
        </div>
      );
    }

    return (
      <ScenarioReportView
        orgSlug={orgSlug}
        scenario={scenario}
        run={run}
        parcel={parcel}
        planningParameters={planningParameters.items}
      />
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenario report unavailable"
          description="The report view could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
