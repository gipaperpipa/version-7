import Link from "next/link";
import type { ScenarioDto } from "@repo/contracts";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ParcelEditorForm } from "@/components/parcels/parcel-editor-form";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { ParcelCompletenessSummary } from "@/components/ui/parcel-completeness-summary";
import { ProvenanceConfidence } from "@/components/ui/provenance-confidence";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcel } from "@/lib/api/parcels";
import { getPlanningParameters } from "@/lib/api/planning";
import { getScenarioReadiness, getScenarios } from "@/lib/api/scenarios";
import { buildParcelCompletenessSummary, selectPrimaryLinkedScenario } from "@/lib/ui/parcel-completeness";
import { getSourceAuthorityDetail, getSourceAuthorityLabel, getTrustModeLabel } from "@/lib/ui/provenance";
import { updateParcelAction } from "../actions";

function renderParcelMode(parcelType: string | null, isGroupSite: boolean) {
  if (isGroupSite) return "Grouped site";
  return parcelType ?? "Parcel";
}

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
    const planningValueCount = planningParameters.items.filter((item) => item.valueNumber !== null || item.valueBoolean !== null || item.geom !== null).length;
    const memberCount = parcel.parcelGroup?.memberCount ?? parcel.constituentParcels.length;
    const trustModeLabel = getTrustModeLabel(parcel.provenance?.trustMode);
    const authorityLabel = getSourceAuthorityLabel(parcel.provenance?.sourceAuthority ?? parcel.sourceAuthority);
    const authorityDetail = getSourceAuthorityDetail(parcel.provenance?.sourceAuthority ?? parcel.sourceAuthority);
    const mixedAuthority = Boolean(parcel.provenance?.rawMetadata && "mixedAuthority" in parcel.provenance.rawMetadata && parcel.provenance.rawMetadata.mixedAuthority);
    const action = updateParcelAction.bind(null, orgSlug, parcelId);
    const siteAnchorId = parcel.parcelGroup?.siteParcelId ?? (parcel.isGroupSite ? parcel.id : null);
    const isGroupedMember = Boolean(parcel.parcelGroupId && !parcel.isGroupSite && siteAnchorId);
    const planningHref = isGroupedMember ? `/${orgSlug}/parcels/${siteAnchorId}/planning` : `/${orgSlug}/parcels/${parcelId}/planning`;
    const scenarioHref = isGroupedMember ? `/${orgSlug}/scenarios/new?parcelId=${siteAnchorId}` : `/${orgSlug}/scenarios/new?parcelId=${parcelId}`;
    const overrideTitle = parcel.provenance?.trustMode === "MANUAL_FALLBACK"
      ? "Manual parcel edit"
      : "Fallback override";
    const overrideDescription = parcel.provenance?.trustMode === "MANUAL_FALLBACK"
      ? "Use this to correct or enrich fallback parcel context."
      : "Use manual override only when source-backed parcel context is missing something critical. Source identity remains primary.";

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Parcel workspace"
          title={parcel.name ?? parcel.cadastralId ?? "Parcel"}
          description="Review sourced identity, planning continuity, trust posture, and the next move."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{summary.sourceStatus.label}</span>
              <span className="meta-chip">{parcel.landAreaSqm ?? "n/a"} sqm</span>
              <span className="meta-chip">{planningValueCount} planning values</span>
              <span className="meta-chip">{linkedScenarios.length} linked scenarios</span>
              {parcel.isGroupSite ? <span className="meta-chip">{memberCount} parcel site</span> : null}
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={planningHref}>
                Planning inputs
              </Link>
              <Link className={buttonClasses()} href={scenarioHref}>
                New scenario
              </Link>
            </>
          )}
        />

        {isGroupedMember ? (
          <Alert tone="warning">
            <AlertTitle>Grouped-site member parcel</AlertTitle>
            <AlertDescription>
              This parcel remains inspectable for provenance, but new planning and scenario work now anchors to the grouped site
              {parcel.parcelGroup?.name ? ` ${parcel.parcelGroup.name}` : ""}.
            </AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="summary-band summary-band--workspace"
          eyebrow="Operating summary"
          title="Site identity scan"
          description="Source mode, site basis, planning momentum, continuity."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Site mode</div>
              <div className="ops-summary-item__value">{renderParcelMode(trustModeLabel, parcel.isGroupSite)}</div>
              <div className="ops-summary-item__detail">{summary.sourceStatus.detail}</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Source basis</div>
              <div className="ops-summary-item__value">{authorityLabel ?? parcel.sourceProviderName ?? parcel.provenance?.providerName ?? "Manual"}</div>
              <div className="ops-summary-item__detail">
                {authorityDetail ?? parcel.sourceProviderParcelId ?? parcel.cadastralId ?? "No provider reference"}
              </div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Planning values</div>
              <div className="ops-summary-item__value">{planningValueCount}</div>
              <div className="ops-summary-item__detail">Saved against this site identity.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Scenario continuity</div>
              <div className="ops-summary-item__value">{linkedScenarios.length}</div>
              <div className="ops-summary-item__detail">Scenario cases attached to this site.</div>
            </div>
          </div>
        </SectionCard>

        <div className="detail-grid detail-grid--decision">
          <ParcelCompletenessSummary
            summary={summary}
            primaryActionHref={planningHref}
            primaryActionLabel="Review planning"
            secondaryActionHref={scenarioHref}
            secondaryActionLabel="Create scenario"
          />

          <NextStepPanel
            className="rail-panel rail-panel--action"
            title={summary.nextBestAction.label}
            description={summary.nextBestAction.detail}
            tone="accent"
            size="compact"
            actions={(
              <>
                  <Link className={buttonClasses()} href={planningHref}>
                    Open planning
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={scenarioHref}>
                    Create scenario
                  </Link>
              </>
            )}
          />
        </div>

        <div className="detail-grid">
          <div className="content-stack">
            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Overview"
              title="Site context"
              size="compact"
            >
              <div className="key-value-grid">
                <div className="key-value-card">
                  <div className="key-value-card__label">Address</div>
                  <div className="key-value-card__value">{parcel.addressLine1 ?? "Not set"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Municipality</div>
                  <div className="key-value-card__value">{parcel.municipalityName ?? "Not set"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">District</div>
                  <div className="key-value-card__value">{parcel.districtName ?? "Not set"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Land area</div>
                  <div className="key-value-card__value">{parcel.landAreaSqm ?? "n/a"} sqm</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Source parcel ID</div>
                  <div className="key-value-card__value">{parcel.sourceProviderParcelId ?? parcel.cadastralId ?? "Not set"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Source authority</div>
                  <div className="key-value-card__value">{authorityLabel ?? "Not source-backed"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Authority mix</div>
                  <div className="key-value-card__value">{mixedAuthority ? "Mixed member authority" : "Uniform authority basis"}</div>
                </div>
                <div className="key-value-card">
                  <div className="key-value-card__label">Parcel type</div>
                  <div className="key-value-card__value">{renderParcelMode(trustModeLabel, parcel.isGroupSite)}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Trust and provenance"
              title="Source-backed identity"
              description="Source-derived parcel identity remains primary, even when fallback override is available."
              size="compact"
            >
              <div className="content-stack">
                <ProvenanceConfidence
                  sourceType={parcel.sourceType}
                  confidenceScore={parcel.confidenceScore}
                  sourceReference={parcel.sourceReference}
                  provenance={parcel.provenance}
                  providerName={parcel.sourceProviderName}
                  providerParcelId={parcel.sourceProviderParcelId}
                  showDerivedFlags
                />

                <div className="action-row">
                  {parcel.provenance?.geometryDerived ? <StatusBadge tone="success">Geometry derived</StatusBadge> : <StatusBadge tone="warning">Geometry incomplete</StatusBadge>}
                  {parcel.provenance?.areaDerived ? <StatusBadge tone="success">Area derived</StatusBadge> : <StatusBadge tone="warning">Area incomplete</StatusBadge>}
                  {authorityLabel ? <StatusBadge tone={parcel.provenance?.sourceAuthority === "CADASTRAL_GRADE" ? "success" : parcel.provenance?.sourceAuthority === "SEARCH_GRADE" ? "warning" : "surface"}>{authorityLabel}</StatusBadge> : null}
                  {mixedAuthority ? <StatusBadge tone="warning">Mixed authority</StatusBadge> : null}
                  {parcel.isGroupSite ? <StatusBadge tone="accent">{memberCount} parcel group</StatusBadge> : null}
                </div>
              </div>
            </SectionCard>

            {parcel.constituentParcels.length ? (
              <SectionCard
                className="index-surface index-surface--ledger"
                eyebrow="Grouped site members"
                title="Constituent parcels"
                description="These sourced parcel records make up the current grouped site identity."
                size="compact"
              >
                <div className="ops-table">
                  <div className="ops-table__header ops-table__header--parcels">
                    <div>Parcel</div>
                    <div>Area</div>
                    <div>Authority</div>
                    <div>Provider</div>
                    <div>Reference</div>
                    <div>Open</div>
                  </div>
                  {parcel.constituentParcels.map((member) => (
                    <div key={member.id} className="ops-table__row ops-table__row--parcels">
                      <div className="ops-table__cell">
                        <div className="list-row__body">
                          <div className="list-row__title">
                            <span className="list-row__title-text">{member.name ?? member.cadastralId ?? "Source parcel"}</span>
                          </div>
                          <div className="inline-meta">
                            <span className="meta-chip">{member.municipalityName ?? "Municipality not set"}</span>
                            {member.cadastralId ? <span className="meta-chip">{member.cadastralId}</span> : null}
                          </div>
                        </div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__value">{member.landAreaSqm ?? "n/a"} sqm</div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__value">{getSourceAuthorityLabel(member.sourceAuthority) ?? "n/a"}</div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__value">{member.sourceProviderName ?? "Source"}</div>
                      </div>
                      <div className="ops-table__cell">
                        <div className="ops-scan__detail">{member.sourceProviderParcelId ?? member.sourceReference ?? "No source reference"}</div>
                      </div>
                      <div className="ops-table__actions ops-table__actions--dense">
                        <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={`/${orgSlug}/parcels/${member.id}`}>
                          Open
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}
          </div>

          <div className="sidebar-stack cockpit-rail">
            <SectionCard
              className="rail-panel"
              eyebrow="Fallback only"
              title={overrideTitle}
              description={overrideDescription}
              tone="muted"
              size="compact"
            >
              <details className="compact-disclosure compact-disclosure--framed">
                <summary className="compact-disclosure__summary">
                  {parcel.provenance?.trustMode === "MANUAL_FALLBACK" ? "Open fallback parcel edit" : "Open fallback override"}
                </summary>
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
