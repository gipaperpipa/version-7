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
          description="Review parcel trust, planning coverage, and the cleanest next move."
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

        <SectionCard
          eyebrow="Operating summary"
          title="Parcel scan"
          description="Trust, planning, and continuity signals in one row."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Land area</div>
              <div className="ops-summary-item__value">{parcel.landAreaSqm ?? "n/a"}</div>
              <div className="ops-summary-item__detail">sqm carried from parcel context.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Planning values</div>
              <div className="ops-summary-item__value">
                {planningParameters.items.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length}
              </div>
              <div className="ops-summary-item__detail">Saved on this site.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Linked scenarios</div>
              <div className="ops-summary-item__value">{linkedScenarios.length}</div>
              <div className="ops-summary-item__detail">Active cases attached here.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Source mode</div>
              <div className="ops-summary-item__value">{summary.sourceStatus.label}</div>
              <div className="ops-summary-item__detail">Current trust posture.</div>
            </div>
          </div>
        </SectionCard>

        <div className="detail-grid detail-grid--decision">
          <ParcelCompletenessSummary
            summary={summary}
            primaryActionHref={`/${orgSlug}/parcels/${parcelId}/planning`}
            primaryActionLabel="Review planning"
            secondaryActionHref={`/${orgSlug}/scenarios/new?parcelId=${parcelId}`}
            secondaryActionLabel="Create scenario"
          />

          <NextStepPanel
            title={summary.nextBestAction.label}
            description={summary.nextBestAction.detail}
            tone="accent"
            size="compact"
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

        <div className="detail-grid">
          <div className="content-stack">
            <SectionCard
              eyebrow="Overview"
              title="Site brief"
              size="compact"
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
              title="Trust signal"
              description="Keep source-led context distinct from fallback manual entry."
              size="compact"
            >
              <div className="content-stack">
                <ProvenanceConfidence
                  sourceType={parcel.sourceType}
                  confidenceScore={parcel.confidenceScore}
                  sourceReference={parcel.sourceReference}
                />
                <div className="action-row">
                  <span className="meta-chip">Source-first target</span>
                  <span className="meta-chip">Manual fallback</span>
                  <span className="meta-chip">Continuity preserved</span>
                </div>
                <div className="field-help">
                  Keep manual edits usable, but read them as fallback rather than the flagship parcel workflow.
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="sidebar-stack">
            <SectionCard
              eyebrow="Manual fallback"
              title="Manual fallback edit"
              description="Usable in Sprint 1. Source-led parcel selection remains the intended model."
              tone="muted"
              size="compact"
            >
              <details className="compact-disclosure compact-disclosure--framed">
                <summary className="compact-disclosure__summary">Open fallback parcel edit</summary>
                <div className="compact-disclosure__body">
                  <ParcelEditorForm action={action} initialParcel={parcel} submitLabel="Save parcel" />
                </div>
              </details>
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
