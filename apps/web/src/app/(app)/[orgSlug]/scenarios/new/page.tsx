import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ScenarioEditorForm } from "@/components/scenarios/scenario-editor-form";
import { SectionCard } from "@/components/ui/section-card";
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
    const selectedParcelLabel = selectedParcel?.name ?? selectedParcel?.cadastralId ?? "Select in form";

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Scenario studio"
          title="Create a scenario"
          description="Create a parcel-linked case and move straight into funding, readiness, and run."
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
            description="Create a parcel first so the case stays site-linked. Source-selected parcels remain the intended model; manual entry is fallback."
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
            <SectionCard
              eyebrow="Quick setup"
              title="Create the case"
              description="Keep setup short: anchor the parcel, choose strategy, save, then continue in the builder."
              tone="accent"
              size="compact"
            >
              <div className="ops-summary-grid ops-summary-grid--planning">
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Parcel context</div>
                  <div className="ops-summary-item__value">{selectedParcelLabel}</div>
                  <div className="ops-summary-item__detail">{selectedParcel ? "Carried from the parcel workspace." : "Choose the site in the form."}</div>
                </div>
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Available parcels</div>
                  <div className="ops-summary-item__value">{parcels.total}</div>
                  <div className="ops-summary-item__detail">Current site records ready for scenario setup.</div>
                </div>
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Core now</div>
                  <div className="ops-summary-item__value">Parcel, strategy, key assumptions</div>
                  <div className="ops-summary-item__detail">Funding and readiness come after save.</div>
                </div>
                <div className="ops-summary-item">
                  <div className="ops-summary-item__label">Posture</div>
                  <div className="ops-summary-item__value">Directional</div>
                  <div className="ops-summary-item__detail">Use this to guide the next decision, not replace full underwriting.</div>
                </div>
              </div>
            </SectionCard>

            <div className="detail-grid">
              <ScenarioEditorForm
                action={action}
                parcels={parcels.items}
                initialParcelId={resolvedSearchParams?.parcelId ?? null}
                submitLabel="Create scenario"
                mode="create"
              />

              <div className="sidebar-stack">
                <NextStepPanel
                  title={selectedParcel ? "Start from the selected parcel" : "Create a parcel-linked case"}
                  description={selectedParcel
                    ? `${selectedParcel.name ?? selectedParcel.cadastralId ?? "This parcel"} will carry straight into funding, readiness, and run review.`
                    : "Choose the parcel that best represents the site you want to test, then save and continue in the builder."}
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

                <SectionCard
                  eyebrow="Parcel mode"
                  title="Source-first, fallback-capable"
                  description="Manual parcel intake stays usable, but sourced parcel selection remains the intended model."
                  tone="muted"
                  size="compact"
                >
                  <div className="content-stack">
                    <div className="action-row">
                      <span className="meta-chip">Parcel-linked</span>
                      <span className="meta-chip">Manual fallback</span>
                      <span className="meta-chip">Builder next</span>
                    </div>
                    <div className="field-help">
                      Use manual parcel records when needed, but read them as fallback rather than the flagship workflow.
                    </div>
                  </div>
                </SectionCard>
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
