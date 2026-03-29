import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
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
          description="Open a parcel-linked case, then continue in the builder."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{parcels.total} parcel option{parcels.total === 1 ? "" : "s"}</span>
              {selectedParcel ? <span className="meta-chip">{selectedParcel.name ?? selectedParcel.cadastralId ?? "Selected parcel"}</span> : <span className="meta-chip">Select parcel first</span>}
            </div>
          )}
          actions={(
            <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
              Back to scenarios
            </Link>
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
            description="Create a parcel first so the case stays site-linked. Source selection remains the intended model; manual entry is fallback."
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

        {parcels.items.length ? (
          <>
            <div className="detail-grid detail-grid--setup">
              <ScenarioEditorForm
                action={action}
                parcels={parcels.items}
                initialParcelId={resolvedSearchParams?.parcelId ?? null}
                submitLabel="Create scenario"
                mode="create"
              />

              <div className="sidebar-stack">
                <NextStepPanel
                  className="rail-panel rail-panel--action"
                  title={selectedParcel ? "Start from the selected parcel" : "Create a parcel-linked case"}
                  description={selectedParcel
                    ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} will carry straight into funding, readiness, and run.`
                    : "Choose the parcel you want to test, save the case, then continue in the builder."}
                  size="compact"
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
              </div>
            </div>
          </>
        ) : null}
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
