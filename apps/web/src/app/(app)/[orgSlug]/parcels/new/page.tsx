import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NextStepPanel } from "@/components/ui/next-step-panel";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { isApiUnavailableError } from "@/lib/api/errors";
import { getParcels, searchSourceParcels } from "@/lib/api/parcels";
import { getConfidenceBand } from "@/lib/ui/provenance";
import { ingestSourceParcelsAction } from "../actions";

function getGeometryStateBadge(hasGeometry: boolean, hasLandArea: boolean) {
  if (hasGeometry && hasLandArea) {
    return <StatusBadge tone="success">Geometry + area ready</StatusBadge>;
  }

  if (hasGeometry || hasLandArea) {
    return <StatusBadge tone="warning">Source incomplete</StatusBadge>;
  }

  return <StatusBadge tone="danger">Source thin</StatusBadge>;
}

export default async function NewParcelPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ q?: string; municipality?: string; error?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q ?? "";
  const municipality = resolvedSearchParams?.municipality ?? "";

  try {
    const [existingParcels, sourceResults] = await Promise.all([
      getParcels(orgSlug),
      searchSourceParcels(orgSlug, {
        q: query,
        municipality,
        limit: 10,
      }),
    ]);
    const action = ingestSourceParcelsAction.bind(null, orgSlug);
    const sourceReadyCount = sourceResults.items.filter((item) => item.hasGeometry && item.hasLandArea).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Primary parcel intake"
          title="Select source-backed parcels"
          description="Search parcel IDs or place context, ingest sourced geometry and derived area, then continue straight into planning and scenarios."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{sourceResults.total} source candidates shown</span>
              <span className="meta-chip">{sourceReadyCount} geometry-ready</span>
              <span className="meta-chip">{existingParcels.total} parcels already in workspace</span>
            </div>
          )}
          actions={(
            <>
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                Manual fallback
              </Link>
              <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels`}>
                Back to parcels
              </Link>
            </>
          )}
        />

        {resolvedSearchParams?.error === "missing-source-selection" ? (
          <Alert tone="warning">
            <AlertTitle>Select at least one source parcel</AlertTitle>
            <AlertDescription>Choose one parcel for a direct intake or multiple parcels to create a grouped site foundation.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "source-intake-failed" ? (
          <Alert tone="danger">
            <AlertTitle>Source intake failed</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the source parcel intake request."}</AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="summary-band summary-band--workspace"
          eyebrow="Source-first workflow"
          title="Parcel identity comes from source"
          description="Search, select, ingest, then continue. Manual parcel authoring remains only fallback."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Source-selected</div>
              <div className="ops-summary-item__value">Primary</div>
              <div className="ops-summary-item__detail">Parcel geometry and area come from source-backed intake.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Derived geometry</div>
              <div className="ops-summary-item__value">Automatic</div>
              <div className="ops-summary-item__detail">No parcel drawing required.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Multi-parcel site</div>
              <div className="ops-summary-item__value">Supported</div>
              <div className="ops-summary-item__detail">Select multiple parcels to build a grouped site foundation.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Manual entry</div>
              <div className="ops-summary-item__value">Fallback</div>
              <div className="ops-summary-item__detail">Available for source gaps or testing only.</div>
            </div>
          </div>
        </SectionCard>

        <div className="detail-grid">
          <div className="content-stack">
            <SectionCard
              className="index-surface index-surface--workspace"
              eyebrow="Source search"
              title="Find parcels by parcel ID or place"
              description="Search source-backed parcel records, then ingest one parcel or an assembled site."
              size="compact"
            >
              <form className="content-stack" method="GET">
                <div className="field-grid field-grid--tri">
                  <div className="field-stack field-stack--span-full">
                    <label className="field-label" htmlFor="q">Search query</label>
                    <input
                      id="q"
                      name="q"
                      defaultValue={query}
                      className="ui-input"
                      placeholder="Parcel ID, address, district, or municipality"
                    />
                    <div className="field-help">Search against parcel IDs, cadastral references, addresses, municipalities, and districts.</div>
                  </div>
                  <div className="field-stack">
                    <label className="field-label" htmlFor="municipality">Municipality</label>
                    <input
                      id="municipality"
                      name="municipality"
                      defaultValue={municipality}
                      className="ui-input"
                      placeholder="Frankfurt am Main"
                    />
                  </div>
                </div>

                <div className="action-row">
                  <button className={buttonClasses()} type="submit">
                    Search source parcels
                  </button>
                  <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels/new`}>
                    Reset
                  </Link>
                </div>
              </form>
            </SectionCard>

            <SectionCard
              className="index-surface index-surface--ledger"
              eyebrow="Source candidates"
              title="Select parcels to ingest"
              description="Single selection creates a source parcel. Multi-selection creates a grouped site foundation with derived combined area."
              size="compact"
            >
              {sourceResults.items.length ? (
                <form action={action} className="content-stack">
                  <div className="field-grid field-grid--tri">
                    <div className="field-stack field-stack--span-full">
                      <label className="field-label" htmlFor="siteName">Optional site name</label>
                      <input
                        id="siteName"
                        name="siteName"
                        className="ui-input"
                        placeholder="Only needed if you want to override the default grouped-site name"
                      />
                      <div className="field-help">Leave blank to derive the site name from the selected source parcels.</div>
                    </div>
                  </div>

                  <div className="ops-table">
                    <div className="ops-table__header ops-table__header--parcels">
                      <div>Parcel</div>
                      <div>Area</div>
                      <div>Source</div>
                      <div>Geometry</div>
                      <div>Confidence</div>
                      <div>Select</div>
                    </div>
                    {sourceResults.items.map((item) => (
                      <div key={item.id} className="ops-table__row ops-table__row--parcels">
                        <div className="ops-table__cell">
                          <div className="list-row__body">
                            <div className="list-row__title">
                              <span className="list-row__title-text">{item.displayName}</span>
                              <StatusBadge tone="surface">{item.providerName}</StatusBadge>
                            </div>
                            <div className="inline-meta">
                              <span className="meta-chip">{item.providerParcelId}</span>
                              {item.cadastralId ? <span className="meta-chip">{item.cadastralId}</span> : null}
                              <span className="meta-chip">{item.municipalityName ?? item.city ?? "No municipality"}</span>
                            </div>
                            <div className="list-row__meta list-row__meta--clamped">{item.addressLine1 ?? "No address returned by source"}</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Area</div>
                            <div className="ops-scan__value">{item.landAreaSqm ?? "n/a"} sqm</div>
                            <div className="ops-scan__detail">{item.districtName ?? "District not returned"}</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Source</div>
                            <div className="action-row">
                              <StatusBadge tone="accent">Source-backed</StatusBadge>
                            </div>
                            <div className="ops-scan__detail">{item.sourceReference}</div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Geometry</div>
                            <div className="action-row">
                              {getGeometryStateBadge(item.hasGeometry, item.hasLandArea)}
                            </div>
                            <div className="ops-scan__detail">
                              {item.hasGeometry
                                ? "Geometry available from source"
                                : "Source record can still be ingested, but geometry is incomplete."}
                            </div>
                          </div>
                        </div>

                        <div className="ops-table__cell">
                          <div className="ops-cell-stack">
                            <div className="ops-scan__label">Confidence</div>
                            <div className="ops-scan__value">{getConfidenceBand(item.confidenceScore)}</div>
                            <div className="ops-scan__detail">{item.confidenceScore ?? "n/a"} source confidence</div>
                          </div>
                        </div>

                        <div className="ops-table__actions ops-table__actions--dense">
                          <label className="field-row">
                            <input type="checkbox" name="sourceParcelId" value={item.id} />
                            <span className="field-help">Select</span>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="action-row">
                    <button className={buttonClasses({ size: "lg" })} type="submit">
                      Create parcel or grouped site
                    </button>
                    <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                      Manual fallback
                    </Link>
                  </div>
                </form>
              ) : (
                <EmptyState
                  eyebrow="No source matches"
                  title="No source parcels matched the current search"
                  description="Try another parcel ID, address fragment, municipality, or district. Manual fallback is still available if source coverage is missing."
                  actions={(
                    <>
                      <Link className={buttonClasses()} href={`/${orgSlug}/parcels/new/manual`}>
                        Manual fallback
                      </Link>
                      <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels`}>
                        Back to parcels
                      </Link>
                    </>
                  )}
                />
              )}
            </SectionCard>
          </div>

          <div className="sidebar-stack">
            <NextStepPanel
              className="rail-panel rail-panel--action"
              title="Ingest parcels, then continue into planning"
              description="Source-backed parcel geometry and area should become the site anchor before planning interpretation and scenario setup begin."
              size="compact"
              actions={(
                <>
                  <Link className={buttonClasses()} href={`/${orgSlug}/parcels`}>
                    Review parcel board
                  </Link>
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/scenarios`}>
                    Scenario studio
                  </Link>
                </>
              )}
            />

            <SectionCard
              className="rail-panel"
              eyebrow="Grouping foundation"
              title="How multi-parcel intake works"
              description="Selecting multiple parcels creates a grouped site foundation with combined area and constituent provenance."
              size="compact"
            >
              <div className="helper-list">
                <div>Each selected parcel is stored with its source identifier and provenance.</div>
                <div>A grouped site parcel is derived automatically so planning and scenarios can continue without manual geometry authoring.</div>
                <div>The grouped site detail links back to the included constituent parcels.</div>
              </div>
            </SectionCard>

            <SectionCard
              className="rail-panel"
              eyebrow="Fallback only"
              title="Manual parcel creation"
              description="Use manual entry only when source selection is missing or intentionally bypassed for testing."
              tone="muted"
              size="compact"
            >
              <div className="action-row">
                <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                  Open manual fallback
                </Link>
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
          title="Parcel source intake unavailable"
          description="Source-backed parcel search could not load because the configured API is not reachable."
        />
      );
    }

    throw error;
  }
}
