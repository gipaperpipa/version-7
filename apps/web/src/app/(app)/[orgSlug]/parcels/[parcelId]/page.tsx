import Link from "next/link";
import type { ScenarioDto } from "@repo/contracts";
import { ParcelEditorForm } from "@/components/parcels/parcel-editor-form";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ParcelCompletenessSummary } from "@/components/ui/parcel-completeness-summary";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatBlock } from "@/components/ui/stat-block";
import { WorkflowSteps } from "@/components/ui/workflow-steps";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcel } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { getScenarioReadiness, getScenarios } from "@/lib/api/scenarios";
import { buildParcelCompletenessSummary, selectPrimaryLinkedScenario } from "@/lib/ui/parcel-completeness";
import { updateParcelAction } from "../actions";

export default async function ParcelDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; parcelId: string }>;
}) {
  const { orgSlug, parcelId } = await params;

  try {
    const [parcel, planningParameters, scenarios] = await Promise.all([
      getParcel(orgSlug, parcelId),
      getPlanningParameters(orgSlug, parcelId),
      getScenarios(orgSlug),
    ]);

    const linkedScenarios = scenarios.items.filter((scenario) => scenario.parcelId === parcelId);
    const primaryScenario: ScenarioDto | undefined = linkedScenarios.length
      ? selectPrimaryLinkedScenario(linkedScenarios)
      : undefined;
    const primaryReadiness = primaryScenario
      ? await getScenarioReadiness(orgSlug, primaryScenario.id)
      : null;
    const summary = buildParcelCompletenessSummary({
      parcel,
      planningItems: planningParameters.items,
      linkedScenarios,
      primaryReadiness,
    });
    const action = updateParcelAction.bind(null, orgSlug, parcelId);

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Parcel workspace"
          title={parcel.name ?? parcel.cadastralId ?? "Parcel"}
          description="Use parcel detail to judge source trust, planning completeness, and the cleanest next move into scenario work."
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${parcelId}/planning`}>
                Planning inputs
              </Link>
              <Link className={buttonClasses()} href={`/${orgSlug}/scenarios/new?parcelId=${parcelId}`}>
                New scenario
              </Link>
            </>
          )}
        />

        <div className="stat-grid">
          <StatBlock label="Land area" value={parcel.landAreaSqm ?? "n/a"} caption="Square meters" tone="accent" />
          <StatBlock label="Planning values" value={planningParameters.items.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length} caption="Saved planning inputs on this site" />
          <StatBlock label="Linked scenarios" value={linkedScenarios.length} caption="Decision cases already attached to this parcel" tone={linkedScenarios.length ? "success" : "neutral"} />
          <StatBlock label="Source mode" value={summary.sourceStatus.label} caption="Trust posture for this parcel record" tone={summary.sourceStatus.tone === "surface" ? "warning" : summary.sourceStatus.tone === "info" ? "accent" : summary.sourceStatus.tone === "success" ? "success" : "neutral"} />
        </div>

        <div className="detail-grid">
          <div className="content-stack">
            <SectionCard
              eyebrow="Overview"
              title="Site context"
              description="This parcel should read like a working site brief rather than a raw database record."
            >
              <div className="key-value-grid">
                <div className="key-value-card">
                  <div className="key-value-card__label">Address</div>
                  <div className="key-value-card__value">{parcel.addressLine1 ?? "Not set"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Postal / country</div>
                  <div className="key-value-card__value">{parcel.postalCode ?? "n/a"} / {parcel.countryCode ?? "DE"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Municipality</div>
                  <div className="key-value-card__value">{parcel.municipalityName ?? "Not set"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Cadastral reference</div>
                  <div className="key-value-card__value">{parcel.cadastralId ?? "Not set"}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Trust and provenance"
              title="How this parcel should be read"
              description="Trust stays visible so the user can separate sourced context from fallback manual entry."
            >
              <div className="content-stack">
                <ProvenanceConfidence
                  sourceType={parcel.sourceType}
                  confidenceScore={parcel.confidenceScore}
                  sourceReference={parcel.sourceReference}
                />
                <div className="helper-list">
                  <div>
                    The real product direction is sourced parcel selection with geometry-backed area and shape, not
                    manual parcel authoring.
                  </div>
                  <div>
                    This parcel can still be used for Sprint 1 even when entered manually, but it should be treated as
                    a fallback record rather than the intended flagship intake model.
                  </div>
                </div>
              </div>
            </SectionCard>

            <NextStepPanel
              title={summary.nextBestAction.label}
              description={summary.nextBestAction.detail}
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels/${parcelId}/planning`}>
                    Open planning
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios/new?parcelId=${parcelId}`}>
                    Create scenario
                  </Link>
                </>
              )}
            />
          </div>

          <div className="sidebar-stack">
            <ParcelCompletenessSummary
              summary={summary}
              primaryActionHref={`/${orgSlug}/parcels/${parcelId}/planning`}
              primaryActionLabel="Review planning"
              secondaryActionHref={`/${orgSlug}/scenarios/new?parcelId=${parcelId}`}
              secondaryActionLabel="Create scenario"
            />

            <SectionCard
              eyebrow="Manual fallback"
              title="Fallback parcel intake"
              description="Keep the parcel editable for Sprint 1, but do not treat manual site entry as the intended product-center experience."
              tone="muted"
            >
              <ParcelEditorForm action={action} initialParcel={parcel} submitLabel="Save parcel" />
            </SectionCard>

            <SectionCard
              eyebrow="Workflow"
              title="Parcel in the broader path"
              description="Keep the current site anchored inside the parcel-to-result journey."
              tone="muted"
            >
              <WorkflowSteps
                activeStep={1}
                steps={[
                  { label: "Parcel intake", description: "Keep the site context legible and usable." },
                  { label: "Planning inputs", description: "Record buildability and policy interpretation." },
                  { label: "Scenario setup", description: "Carry the parcel into a real decision case." },
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
          title="Parcel detail unavailable"
          description="The parcel workspace could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
