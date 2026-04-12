import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ApiUnreachableState } from "@/components/ui/api-unreachable-state";
import { buttonClasses } from "@/components/ui/button";
import { ParcelMapWorkspaceShell } from "@/components/parcels/parcel-map-workspace-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { isApiResponseError, isApiUnavailableError } from "@/lib/api/errors";
import { getParcels, getSourceParcelMapConfig, searchSourceParcels } from "@/lib/api/parcels";
import { ingestSourceParcelsAction } from "../actions";

function getSourceIntakeErrorTitle(errorCode: string | null | undefined) {
  switch (errorCode) {
    case "SOURCE_PROVIDER_UNAVAILABLE":
      return "Source provider unavailable";
    case "GROUP_MEMBER_ALREADY_ASSIGNED":
      return "Selected parcels already belong to another site";
    case "DOWNSTREAM_RECONCILIATION_REQUIRED":
      return "Selected parcels already have conflicting downstream work";
    default:
      return "Source intake failed";
  }
}

export default async function NewParcelPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ q?: string; municipality?: string; error?: string; errorCode?: string; message?: string }>;
}) {
  const { orgSlug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = resolvedSearchParams?.q ?? "";
  const municipality = resolvedSearchParams?.municipality ?? "";

  try {
    const [existingParcels, mapConfig] = await Promise.all([
      getParcels(orgSlug),
      getSourceParcelMapConfig(orgSlug),
    ]);

    let searchResults: Awaited<ReturnType<typeof searchSourceParcels>>["items"] = [];
    let searchTotal = 0;
    let searchErrorMessage: string | null = null;

    if (query || municipality) {
      try {
        const response = await searchSourceParcels(orgSlug, {
          q: query,
          municipality,
          limit: 10,
        });
        searchResults = response.items;
        searchTotal = response.total;
      } catch (error) {
        if (isApiUnavailableError(error) || isApiResponseError(error)) {
          searchErrorMessage = error.message;
        } else {
          throw error;
        }
      }
    }

    const action = ingestSourceParcelsAction.bind(null, orgSlug);
    const groupedSiteCount = existingParcels.items.filter((parcel) => parcel.isGroupSite).length;
    const manualFallbackCount = existingParcels.items.filter((parcel) => parcel.provenance?.trustMode === "MANUAL_FALLBACK").length;
    const sourceBackedCount = existingParcels.items.filter((parcel) => (
      parcel.provenance?.trustMode === "SOURCE_PRIMARY"
      || parcel.provenance?.trustMode === "SOURCE_INCOMPLETE"
      || parcel.provenance?.trustMode === "GROUP_DERIVED"
    )).length;

    return (
      <div className="workspace-page content-stack">
        <PageHeader
          eyebrow="Primary parcel intake"
          title="Select parcels directly from the map"
          description="Search to an area, inspect real source-backed parcel geometry in supported Hessen coverage, then add one parcel or create a grouped site without typing geometry or area manually."
          meta={(
            <div className="action-row">
              <span className="meta-chip">{mapConfig.supportedRegions.length} parcel-grade region{mapConfig.supportedRegions.length === 1 ? "" : "s"} active</span>
              <span className="meta-chip">{sourceBackedCount} source-backed parcel/site record{sourceBackedCount === 1 ? "" : "s"} in workspace</span>
              <span className="meta-chip">{groupedSiteCount} grouped site{groupedSiteCount === 1 ? "" : "s"} in workspace</span>
              <span className="meta-chip">{manualFallbackCount} manual fallback parcel{manualFallbackCount === 1 ? "" : "s"}</span>
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
            <AlertTitle>Select at least one parcel</AlertTitle>
            <AlertDescription>Choose one parcel for direct intake or multiple parcels to create a grouped site from the map.</AlertDescription>
          </Alert>
        ) : null}

        {resolvedSearchParams?.error === "source-intake-failed" ? (
          <Alert tone="danger">
            <AlertTitle>{getSourceIntakeErrorTitle(resolvedSearchParams.errorCode)}</AlertTitle>
            <AlertDescription>{resolvedSearchParams.message ?? "The API rejected the source parcel intake request."}</AlertDescription>
          </Alert>
        ) : null}

        <SectionCard
          className="summary-band summary-band--workspace"
          eyebrow="Map-first source workflow"
          title="Search to area, verify on map, then ingest"
          description="The map is now the primary intake surface. Parcel geometry, area, authority, and completeness come from the source/provider layer, while grouped-site creation still reuses the existing grouped-site rules."
          tone="accent"
          size="compact"
        >
          <div className="ops-summary-grid ops-summary-grid--planning">
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Parcel-grade click selection</div>
              <div className="ops-summary-item__value">Hessen only</div>
              <div className="ops-summary-item__detail">Supported cadastral geometry appears only where the provider can actually serve it.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Zoom threshold</div>
              <div className="ops-summary-item__value">{mapConfig.minParcelSelectionZoom.toFixed(0)}+</div>
              <div className="ops-summary-item__detail">If the map looks empty inside Hessen, zoom to parcel level before expecting clickable polygons.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Elsewhere in Germany</div>
              <div className="ops-summary-item__value">Search-guided</div>
              <div className="ops-summary-item__detail">Search can move the map anywhere, but parcel-grade click selection is not implied outside supported coverage.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">Downstream continuity</div>
              <div className="ops-summary-item__value">Unchanged</div>
              <div className="ops-summary-item__detail">Single parcel reuse, grouped-site reuse, safe migration, and grouped-site anchor rules all stay intact.</div>
            </div>
            <div className="ops-summary-item">
              <div className="ops-summary-item__label">First parcel load</div>
              <div className="ops-summary-item__value">May be slower</div>
              <div className="ops-summary-item__detail">The first request in a new supported area can take longer while the source and cache warm up. Repeat views should feel faster.</div>
            </div>
          </div>
        </SectionCard>

        <ParcelMapWorkspaceShell
          orgSlug={orgSlug}
          action={action}
          mapConfig={mapConfig}
          searchQuery={query}
          municipalityQuery={municipality}
          searchResults={searchResults}
          searchTotal={searchTotal}
          searchErrorMessage={searchErrorMessage}
        />
      </div>
    );
  } catch (error) {
    if (isApiUnavailableError(error)) {
      return (
        <ApiUnreachableState
          title="Source-backed parcel intake is unavailable"
          description="The parcel map workspace could not reach the API. Restore the API first, then reload this page to continue with source-backed parcel selection."
        />
      );
    }

    if (isApiResponseError(error)) {
      const message = error.status === 404
        ? "The current API deployment does not expose the parcel map routes yet. Redeploy the API or use manual fallback for now."
        : error.message;

      return (
        <div className="workspace-page content-stack">
          <PageHeader
            eyebrow="Primary parcel intake"
            title="Source parcel map unavailable"
            description="Source-backed parcel selection is the intended intake path, but the current API deployment cannot serve the map-backed parcel routes yet."
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
          <Alert tone="warning">
            <AlertTitle>Map-backed source intake is not available on this deployment</AlertTitle>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        </div>
      );
    }

    throw error;
  }
}
