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
import { getScenarioAssumptionTemplates } from "@/lib/api/scenarios";
import { createScenarioAction } from "../actions";

export default async function NewScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ error?: string; parcelId?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  try {
    const [parcels, assumptionTemplates] = await Promise.all([
      getParcels(orgSlug),
      getScenarioAssumptionTemplates(orgSlug),
    ]);
    const action = createScenarioAction.bind(null, orgSlug);
    const requestedParcel = resolvedSearchParams?.parcelId
      ? parcels.items.find((parcel) => parcel.id === resolvedSearchParams.parcelId) ?? null
      : null;
    const selectedParcel = requestedParcel?.parcelGroupId && !requestedParcel.isGroupSite
      ? parcels.items.find((parcel) => parcel.id === requestedParcel.parcelGroup?.siteParcelId) ?? requestedParcel
      : requestedParcel;
    const sourceBackedCount = parcels.items.filter((parcel) => {
      return parcel.provenance?.trustMode === "SOURCE_PRIMARY" || parcel.provenance?.trustMode === "SOURCE_INCOMPLETE";
    }).length;
    const groupedSiteCount = parcels.items.filter((parcel) => parcel.isGroupSite || parcel.provenance?.trustMode === "GROUP_DERIVED").length;
    const manualFallbackCount = parcels.items.filter((parcel) => parcel.provenance?.trustMode === "MANUAL_FALLBACK").length;
    const selectedParcelMessage = selectedParcel
      ? selectedParcel.isGroupSite
        ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This grouped site"} already aggregates ${selectedParcel.parcelGroup?.memberCount ?? selectedParcel.constituentParcels.length} sourced parcels and is ready to carry into case setup.`
        : selectedParcel.provenance?.trustMode === "MANUAL_FALLBACK"
          ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} remains usable for scenario work, but source-backed parcel identity should stay the default path when available.`
          : `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} will carry straight into funding, readiness, and run.`
      : "Choose the parcel or grouped site you want to test, save the case, then continue in the builder.";

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario studio"
          title="Create a scenario"
          description="Open a parcel-linked case from a sourced parcel or grouped site, then continue in the builder."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{parcels.total} parcel option{parcels.total === 1 ? "" : "s"}</span>
              <span className="meta-chip">{sourceBackedCount} source-backed</span>
              <span className="meta-chip">{groupedSiteCount} grouped sites</span>
              <span className="meta-chip">{manualFallbackCount} fallback manual</span>
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

        {resolvedSearchParams?.error === "create-request-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Scenario creation failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the new scenario request. Review the setup inputs and try again."}</AlertDescription>
          </Alert>
        ) : null}

        {!parcels.items.length ? (
          <EmptyState
            eyebrow="Parcel dependency"
            title="A scenario needs source-backed parcel intake first"
            description="Search and ingest a source-backed parcel or grouped site first so geometry, area, and provenance stay attached to the case. Manual parcel creation remains fallback."
            actions={(
              <>
                <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new`}>
                  Source intake
                </Link>
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                  Manual fallback
                </Link>
              </>
            )}
          />
        ) : null}

        {parcels.items.length ? (
          <div className="detail-grid detail-grid--setup setup-grid">
            <ScenarioEditorForm
              action={action}
              parcels={parcels.items}
              templates={assumptionTemplates.items}
              initialParcelId={resolvedSearchParams?.parcelId ?? null}
              submitLabel="Create scenario"
              mode="create"
            />

            <div className="sidebar-stack">
              <NextStepPanel
                className="rail-panel rail-panel--action"
                title={selectedParcel ? "Start from the selected site" : "Create a parcel-linked case"}
                description={selectedParcelMessage}
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
