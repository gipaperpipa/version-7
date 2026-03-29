import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PlanningParameterForm } from "@/components/planning/planning-parameter-form";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcel } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { sprint1PlanningFieldDefinitions } from "@/lib/ui/planning-field-definitions";
import { savePlanningParametersAction } from "./actions";

export default async function ParcelPlanningPage({
  params,
}: {
  params: Promise<{ orgSlug: string; parcelId: string }>;
}) {
  const { orgSlug, parcelId } = await params;

  try {
    const [parcel, planningParameters] = await Promise.all([
      getParcel(orgSlug, parcelId),
      getPlanningParameters(orgSlug, parcelId),
    ]);

    const action = savePlanningParametersAction.bind(null, orgSlug, parcelId);
    const filledCount = planningParameters.items.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length;
    const readinessCount = planningParameters.items.filter((item) => {
      const definition = sprint1PlanningFieldDefinitions.find((candidate) => candidate.keySlug === item.keySlug);
      return Boolean(definition?.affectsReadiness && (item.valueNumber !== null || item.valueBoolean !== null || item.geom));
    }).length;
    const derivedCount = planningParameters.items.filter((item) => item.keySlug === "BUILDABLE_WINDOW").length;
    const continueHref = `/${orgSlug}/scenarios/new?parcelId=${parcelId}`;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Parcel / Planning"
          title="Planning inputs"
          description={`Interpret ${parcel.name ?? parcel.cadastralId ?? parcel.id} as a real site. These inputs drive readiness and the current heuristic engine.`}
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${parcelId}`}>
                Back to parcel
              </Link>
              <Link className={buttonClasses()} href={continueHref}>
                Continue to scenario
              </Link>
            </>
          )}
        />

        <div className="stat-grid">
          <StatBlock label="Saved inputs" value={filledCount} caption="Current non-empty values" tone="accent" />
          <StatBlock label="Readiness inputs" value={readinessCount} caption="Fields already helping checks" />
          <StatBlock label="Derived values" value={derivedCount} caption="Source-backed and read-only" tone="accent" />
          <StatBlock label="Parcel context" value={parcel.landAreaSqm ?? "n/a"} caption="Land area carried in" />
        </div>

        <Alert tone="info">
          <AlertTitle>Focused Sprint 1 planning coverage</AlertTitle>
          <AlertDescription>
            This page keeps only the planning keys that matter most for Sprint 1 readiness and feasibility.
            Geometry-backed inputs stay source-derived and read-only.
          </AlertDescription>
        </Alert>

        <div className="detail-grid">
          <PlanningParameterForm
            action={action}
            definitions={sprint1PlanningFieldDefinitions}
            items={planningParameters.items}
            continueHref={continueHref}
          />

          <div className="sidebar-stack">
            <NextStepPanel
              title="Move from site interpretation into scenario design"
              description="Use planning to make the parcel decision-ready enough for scenario framing, not to recreate a full planning document."
              actions={(
                <>
                  <Link className={buttonClasses()} href={continueHref}>
                    Continue to scenario
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${parcelId}`}>
                    Back to parcel
                  </Link>
                </>
              )}
            />

            <SectionCard
              eyebrow="Form legend"
              title="Field state"
              description="Keep empty, saved, cleared, and derived values distinct."
              size="compact"
            >
              <div className="action-row">
                <span className="meta-chip">Empty</span>
                <span className="meta-chip">Filled</span>
                <span className="meta-chip">Cleared</span>
                <span className="meta-chip">Derived / Read-only</span>
              </div>
              <div className="helper-list">
                <div>Readiness-relevant fields are marked inline.</div>
                <div>Buildable Window stays source-backed and read-only.</div>
                <div>Save first, then carry the parcel into scenario design.</div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Workflow"
              title="Current path"
              tone="muted"
              size="compact"
            >
              <WorkflowSteps
                activeStep={2}
                steps={[
                  { label: "Parcel", description: "Establish site context." },
                  { label: "Planning", description: "Interpret buildability." },
                  { label: "Scenario", description: "Frame the decision case." },
                ]}
              />
            </SectionCard>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Planning inputs unavailable"
          description="Planning data could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
