import Link from "next/link";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { PlanningParameterForm } from "@/components/planning/planning-parameter-form";
import { SectionCard } from "@/components/ui/section-card";
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
          description={`Interpret ${parcel.name ?? parcel.cadastralId ?? parcel.id} as a real site.`}
          meta={(
            <div className="action-row">
              <span className="meta-chip">{filledCount} saved</span>
              <span className="meta-chip">{readinessCount} readiness fields</span>
              <span className="meta-chip">{derivedCount} derived</span>
              <span className="meta-chip">{parcel.landAreaSqm ?? "n/a"} sqm parcel context</span>
            </div>
          )}
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

        <SectionCard
          className="summary-band summary-band--workspace"
          eyebrow="Planning summary"
          title="Current planning state"
          description="Read readiness-relevant coverage first."
          tone="accent"
          size="compact"
        >
          <div className="content-stack">
            <div className="ops-summary-grid ops-summary-grid--planning">
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Saved inputs</div>
                <div className="ops-summary-item__value">{filledCount}</div>
                <div className="ops-summary-item__detail">Current non-empty values.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Readiness inputs</div>
                <div className="ops-summary-item__value">{readinessCount}</div>
                <div className="ops-summary-item__detail">Already contributing to checks.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Derived values</div>
                <div className="ops-summary-item__value">{derivedCount}</div>
                <div className="ops-summary-item__detail">Source-backed and read-only.</div>
              </div>
              <div className="ops-summary-item">
                <div className="ops-summary-item__label">Parcel context</div>
                <div className="ops-summary-item__value">{parcel.landAreaSqm ?? "n/a"}</div>
                <div className="ops-summary-item__detail">Land area carried in from parcel.</div>
              </div>
            </div>

            <div className="action-row">
              <span className="meta-chip">Focused Sprint 1 planning coverage</span>
              <span className="meta-chip">Buildable Window stays source-derived</span>
            </div>
          </div>
        </SectionCard>

        <div className="detail-grid">
          <PlanningParameterForm
            action={action}
            definitions={sprint1PlanningFieldDefinitions}
            items={planningParameters.items}
            continueHref={continueHref}
          />

          <div className="sidebar-stack cockpit-rail">
            <NextStepPanel
              className="rail-panel rail-panel--action"
              title="Move from site interpretation into scenario design"
              description="Use planning to make the parcel decision-ready enough for scenario framing, not to recreate a full planning document."
              size="compact"
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
              className="rail-panel"
              eyebrow="Form legend"
              title="Field state"
              description="Keep empty, saved, cleared, and derived values distinct."
              size="compact"
            >
              <div className="content-stack">
                <div className="action-row">
                  <span className="meta-chip">Empty</span>
                  <span className="meta-chip">Filled</span>
                  <span className="meta-chip">Cleared</span>
                  <span className="meta-chip">Derived / Read-only</span>
                </div>
                <div className="field-help">Readiness-relevant fields are marked inline. Buildable Window stays source-backed and read-only.</div>
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
          title="Planning inputs unavailable"
          description="Planning data could not be loaded because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
