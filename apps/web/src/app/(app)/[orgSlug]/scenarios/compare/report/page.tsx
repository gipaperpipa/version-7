import Link from "next/link";
import { OptimizationTarget } from "@repo/contracts";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ScenarioComparisonReportView } from "@/components/reports/scenario-comparison-report-view";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { getScenarioComparison, getScenarios } from "@/lib/api/scenarios";
import { getLeadFirstComparisonDefaults } from "@/lib/scenarios/family-governance";

function toScenarioIdArray(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

export default async function ScenarioCompareReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ scenarioId?: string | string[]; rankingTarget?: OptimizationTarget }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedScenarioIds = toScenarioIdArray(resolvedSearchParams?.scenarioId);
  let scenarioIds = requestedScenarioIds;
  let defaultSelectionSource: "CURRENT_LEADS" | "FAMILY_LEADS" | null = null;

  if (scenarioIds.length < 2) {
    const [scenarios, parcels] = await Promise.all([
      getScenarios(orgSlug),
      getParcels(orgSlug),
    ]);
    const parcelById = new Map(parcels.items.map((parcel) => [parcel.id, parcel]));
    const defaults = getLeadFirstComparisonDefaults(scenarios.items, parcelById);

    if (defaults.scenarioIds.length >= 2) {
      scenarioIds = defaults.scenarioIds;
      defaultSelectionSource = defaults.source;
    } else {
      return (
        <div className="workspace-page content-stack">
          <EmptyState
            eyebrow="Comparison report"
            title="Select at least two scenarios"
            description="Use the scenario board to choose multiple cases, then open the comparison report."
            actions={(
              <Link className={buttonClasses()} href={`/${orgSlug}/scenarios`}>
                Back to scenarios
              </Link>
            )}
          />
        </div>
      );
    }
  }

  try {
    const comparison = await getScenarioComparison(orgSlug, scenarioIds, resolvedSearchParams?.rankingTarget);

    return (
      <ScenarioComparisonReportView
        orgSlug={orgSlug}
        comparison={comparison}
        scenarioIds={scenarioIds}
        defaultSelectionSource={defaultSelectionSource}
      />
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Comparison report unavailable"
          description="The report view could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
