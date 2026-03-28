import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels } from "@/lib/api/parcels";
import { createScenarioAction } from "../actions";

export default async function NewScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ error?: string; parcelId?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const parcels = await getParcels(orgSlug);
    const action = createScenarioAction.bind(null, orgSlug);
    const selectedParcel = resolvedSearchParams?.parcelId
      ? parcels.items.find((parcel) => parcel.id === resolvedSearchParams.parcelId) ?? null
      : null;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario studio"
          title="Create a scenario"
          description="Set up a decision case that can move directly into funding selection, readiness review, and a heuristic run."
          actions={(
            <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
              Back to scenarios
            </Link>
          )}
          meta={(
            <WorkflowSteps
              activeStep={3}
              steps={[
                { label: "Parcel", description: "Stay grounded in a site context." },
                { label: "Planning", description: "Carry forward narrow buildability interpretation." },
                { label: "Scenario", description: "Define strategy, revenue, and costs." },
                { label: "Readiness and run", description: "Select funding, clear blockers, and run." },
              ]}
            />
          )}
        />

        {resolvedSearchParams?.error === "invalid-strategy-mix-json" ? (
          <Alert tone="danger">
            <AlertTitle>Invalid mix configuration JSON</AlertTitle>
            <AlertDescription>The temporary mixed-strategy JSON could not be parsed. Please fix the JSON and try again.</AlertDescription>
          </Alert>
        ) : null}

        {!parcels.items.length ? (
          <EmptyState
            eyebrow="Parcel dependency"
            title="A scenario needs a parcel first"
            description="Create a parcel so the scenario can stay grounded in a site. The long-term product expects sourced parcel selection, but the current alpha still uses manual parcel fallback where needed."
            actions={(
              <>
                <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                  Create parcel
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                  Review parcels
                </Link>
              </>
            )}
          />
        ) : null}

        <div className="stat-grid">
          <StatBlock label="Available parcels" value={parcels.total} caption="Site records ready for scenario framing" tone="accent" />
          <StatBlock label="Preselected parcel" value={selectedParcel ? "Yes" : "No"} caption={selectedParcel ? (selectedParcel.name ?? selectedParcel.cadastralId ?? "Linked from parcel workspace") : "You can choose one in the form"} />
          <StatBlock label="Current step" value="Scenario setup" caption="Funding and readiness come next" />
          <StatBlock label="Product posture" value="Directional" caption="Use this case to guide the next decision, not replace full underwriting" />
        </div>

        <div className="detail-grid">
          <ScenarioEditorForm
            action={action}
            parcels={parcels.items}
            initialParcelId={resolvedSearchParams?.parcelId ?? null}
            submitLabel="Create scenario"
          />

          <div className="sidebar-stack">
            <NextStepPanel
              title={selectedParcel ? "Start from the selected parcel context" : "Create a parcel-linked decision case"}
              description={selectedParcel
                ? `This scenario will start from ${selectedParcel.name ?? selectedParcel.cadastralId ?? "the selected parcel"} and continue into funding, readiness, and result review.`
                : "Choose the parcel that best represents the site you want to test, then save the scenario and continue into the builder rail."}
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                    Review parcels
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Scenario list
                  </Link>
                </>
              )}
            />

            <SectionCard
              eyebrow="What comes next"
              title="Builder rail"
              description="After save, the builder handles funding selection, readiness review, and the run trigger."
              tone="muted"
            >
              <div className="helper-list">
                <div>Revenue assumptions should match the selected strategy.</div>
                <div>Land cost and hard cost are the strongest cost-side requirements for a useful run.</div>
                <div>Funding stays intentionally simple in Sprint 1 and is selected in the builder.</div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Future parcel model"
              title="Parcel selection stays source-first"
              description="Manual parcel records remain usable in the alpha, but the intended product direction is source-selected parcels with derived geometry and area."
              tone="muted"
            >
              <div className="field-help">
                Keep the scenario anchored in a parcel either way, but do not read manual parcel entry as the long-term flagship workflow.
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Scenario creation unavailable"
          description="The parcel list for new scenarios could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
