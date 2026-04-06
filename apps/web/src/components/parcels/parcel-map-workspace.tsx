"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type {
  SearchSourceParcelsResponseDto,
  SourceParcelMapBoundsDto,
  SourceParcelMapConfigDto,
} from "@repo/contracts";
import maplibregl from "maplibre-gl";
import Map, { Layer, NavigationControl, ScaleControl, Source, type MapRef, type ViewState } from "react-map-gl/maplibre";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonClasses } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge, getConfidenceTone } from "@/components/ui/status-badge";
import {
  getParcelMapBasemapLabel,
  getParcelMapBasemapStyle,
  type ParcelMapBasemapMode,
} from "@/lib/maps/map-styles";
import { getConfidenceBand, getSourceAuthorityDetail, getSourceAuthorityLabel } from "@/lib/ui/provenance";

type SourceParcelItem = SearchSourceParcelsResponseDto["items"][number];

export type ParcelMapWorkspaceProps = {
  orgSlug: string;
  action: (formData: FormData) => void | Promise<void>;
  mapConfig: SourceParcelMapConfigDto;
  searchQuery: string;
  municipalityQuery: string;
  searchResults: SourceParcelItem[];
  searchTotal: number;
  searchErrorMessage: string | null;
};

type PreviewState = {
  items: SourceParcelItem[];
  coverageState: "PARCEL_SELECTION_AVAILABLE" | "ZOOM_IN_REQUIRED" | "SEARCH_GUIDANCE_ONLY";
  activeRegion: SourceParcelMapConfigDto["supportedRegions"][number] | null;
  minParcelSelectionZoom: number;
  loading: boolean;
  error: string | null;
};

type BoundsTuple = [[number, number], [number, number]];

const PARCEL_FILL_LAYER_ID = "parcel-preview-fill";
const PARCEL_LINE_LAYER_ID = "parcel-preview-line";
const parcelWorkspaceColorExpression = [
  "match",
  ["get", "workspaceState"],
  "EXISTING_STANDALONE_REUSABLE",
  "#2c6987",
  "EXISTING_STANDALONE_LOCKED",
  "#a3691b",
  "GROUPED_SITE_MEMBER",
  "#64748b",
  "#1f7d63",
] as unknown as string[];

const supportedRegionFillLayer = {
  id: "supported-region-fill",
  type: "fill" as const,
  paint: {
    "fill-color": "#2c6987",
    "fill-opacity": 0.08,
  },
};

const supportedRegionLineLayer = {
  id: "supported-region-line",
  type: "line" as const,
  paint: {
    "line-color": "#2c6987",
    "line-width": 2,
    "line-dasharray": [2, 2] as number[],
  },
};

const parcelFillLayer = {
  id: PARCEL_FILL_LAYER_ID,
  type: "fill" as const,
  paint: {
    "fill-color": parcelWorkspaceColorExpression,
    "fill-opacity": 0.18,
  },
};

const parcelLineLayer = {
  id: PARCEL_LINE_LAYER_ID,
  type: "line" as const,
  paint: {
    "line-color": parcelWorkspaceColorExpression,
    "line-width": 1.4,
  },
};

const hoveredLineLayerBase = {
  id: "parcel-preview-hovered",
  type: "line" as const,
  paint: {
    "line-color": "#163d36",
    "line-width": 3.2,
  },
};

const selectedFillLayerBase = {
  id: "parcel-preview-selected-fill",
  type: "fill" as const,
  paint: {
    "fill-color": "#163d36",
    "fill-opacity": 0.24,
  },
};

const selectedLineLayerBase = {
  id: "parcel-preview-selected-line",
  type: "line" as const,
  paint: {
    "line-color": "#0d2520",
    "line-width": 3,
  },
};

function formatArea(area: string | null | undefined) {
  if (!area) return "Area unresolved";
  const numeric = Number(area);
  if (!Number.isFinite(numeric)) return `${area} sqm`;
  return `${numeric.toLocaleString("en-US", { maximumFractionDigits: 0 })} sqm`;
}

function getWorkspaceStateLabel(workspaceState: SourceParcelItem["workspaceState"]) {
  switch (workspaceState) {
    case "EXISTING_STANDALONE_REUSABLE":
      return "Reusable parcel";
    case "EXISTING_STANDALONE_LOCKED":
      return "Locked parcel";
    case "GROUPED_SITE_MEMBER":
      return "Grouped site member";
    default:
      return "New parcel";
  }
}

function getWorkspaceStateTone(workspaceState: SourceParcelItem["workspaceState"]) {
  switch (workspaceState) {
    case "EXISTING_STANDALONE_REUSABLE":
      return "accent" as const;
    case "EXISTING_STANDALONE_LOCKED":
      return "warning" as const;
    case "GROUPED_SITE_MEMBER":
      return "surface" as const;
    default:
      return "success" as const;
  }
}

function getWorkspaceStateDetail(item: SourceParcelItem) {
  const scenarioPreview = item.downstreamWork.scenarios.length
    ? ` Latest scenarios: ${item.downstreamWork.scenarios.map((scenario) => scenario.name).join(", ")}.`
    : "";

  switch (item.workspaceState) {
    case "EXISTING_STANDALONE_REUSABLE":
      return "Already in the workspace with no downstream work yet, so the existing parcel identity can be reused without duplication.";
    case "EXISTING_STANDALONE_LOCKED":
      return `Already in the workspace with ${item.downstreamWork.planningValueCount} planning value(s) and ${item.downstreamWork.scenarioCount} scenario(s). If this is the only locked parcel in the selected set, downstream continuity can safely migrate to the grouped site.${scenarioPreview}`;
    case "GROUPED_SITE_MEMBER":
      return item.existingSite?.name
        ? `Already folded into ${item.existingSite.name}. Group membership is stable in this pass, so open that grouped site instead of creating a new one.`
        : "Already folded into an existing grouped site.";
    default:
      return "Ready to intake from map selection.";
  }
}

function getSelectionButtonLabel(item: SourceParcelItem, isSelected: boolean) {
  if (item.workspaceState === "GROUPED_SITE_MEMBER") {
    return item.existingSite?.siteParcelId ? "Open grouped site" : "Already grouped";
  }

  if (isSelected) {
    return "Remove from selection";
  }

  switch (item.workspaceState) {
    case "EXISTING_STANDALONE_REUSABLE":
      return "Select reusable parcel";
    case "EXISTING_STANDALONE_LOCKED":
      return "Select for safe migration";
    default:
      return "Select parcel";
  }
}

function getCoverageMessage(previewState: PreviewState) {
  if (previewState.error && previewState.activeRegion) {
    return {
      tone: "warning" as const,
      title: `Parcel-grade provider unavailable in ${previewState.activeRegion.name}`,
      description: "The configured cadastral provider did not return parcel geometry for this map view. Keep navigating for guidance, or use fallback intake until the provider recovers.",
    };
  }

  if (previewState.coverageState === "PARCEL_SELECTION_AVAILABLE") {
    return {
      tone: "success" as const,
      title: previewState.activeRegion
        ? `Parcel-grade selection available in ${previewState.activeRegion.name}`
        : "Parcel-grade selection available",
      description: "The visible parcel geometry is coming from the supported cadastral provider. Click a parcel to inspect and select it.",
    };
  }

  if (previewState.coverageState === "ZOOM_IN_REQUIRED") {
    return {
      tone: "warning" as const,
      title: "Zoom in to load parcel geometry",
      description: previewState.activeRegion
        ? `Parcel-grade map selection is supported in ${previewState.activeRegion.name}, but you need to zoom to ${previewState.minParcelSelectionZoom.toFixed(0)}+ before parcel polygons will load.`
        : `Zoom to ${previewState.minParcelSelectionZoom.toFixed(0)}+ to load supported parcel geometry.`,
    };
  }

  return {
    tone: "info" as const,
    title: "Search-guided only here",
    description: "Map navigation and search guidance work across Germany, but parcel-grade click selection is currently limited to supported Hessen coverage.",
  };
}

function toRegionFeatureCollection(regions: SourceParcelMapConfigDto["supportedRegions"]) {
  return {
    type: "FeatureCollection" as const,
    features: regions.map((region) => ({
      type: "Feature" as const,
      id: region.id,
      properties: {
        regionId: region.id,
        name: region.name,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [[
          [region.bounds.west, region.bounds.south],
          [region.bounds.east, region.bounds.south],
          [region.bounds.east, region.bounds.north],
          [region.bounds.west, region.bounds.north],
          [region.bounds.west, region.bounds.south],
        ]],
      },
    })),
  };
}

function toParcelFeatureCollection(items: SourceParcelItem[]) {
  return {
    type: "FeatureCollection" as const,
    features: items
      .filter((item) => item.geom)
      .map((item) => ({
        type: "Feature" as const,
        id: item.id,
        properties: {
          parcelId: item.id,
          workspaceState: item.workspaceState,
        },
        geometry: item.geom!,
      })),
  };
}

function getGeometryBounds(geom: SourceParcelItem["geom"]): BoundsTuple | null {
  if (!geom || geom.type !== "MultiPolygon" || !geom.coordinates.length) {
    return null;
  }

  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;

  for (const polygon of geom.coordinates) {
    for (const ring of polygon) {
      for (const [longitude, latitude] of ring) {
        west = Math.min(west, longitude);
        south = Math.min(south, latitude);
        east = Math.max(east, longitude);
        north = Math.max(north, latitude);
      }
    }
  }

  if (![west, south, east, north].every(Number.isFinite)) {
    return null;
  }

  return [[west, south], [east, north]];
}

function getGeometryCenter(geom: SourceParcelItem["geom"]) {
  const bounds = getGeometryBounds(geom);
  if (!bounds) {
    return null;
  }

  return {
    longitude: (bounds[0][0] + bounds[1][0]) / 2,
    latitude: (bounds[0][1] + bounds[1][1]) / 2,
  };
}

function deriveInitialViewState(
  mapConfig: SourceParcelMapConfigDto,
  searchResults: SourceParcelItem[],
): ViewState {
  const firstResult = searchResults[0];
  if (firstResult?.geom) {
    const center = getGeometryCenter(firstResult.geom);
    if (center) {
      return {
        longitude: center.longitude,
        latitude: center.latitude,
        zoom: Math.max(mapConfig.minParcelSelectionZoom, 16.2),
        bearing: 0,
        pitch: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
      };
    }
  }

  if (firstResult?.centroid) {
    return {
      longitude: firstResult.centroid.coordinates[0],
      latitude: firstResult.centroid.coordinates[1],
      zoom: firstResult.sourceAuthority === "CADASTRAL_GRADE"
        ? Math.max(mapConfig.minParcelSelectionZoom, 15.6)
        : 12.8,
      bearing: 0,
      pitch: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }

  return {
    longitude: mapConfig.defaultCenter.coordinates[0],
    latitude: mapConfig.defaultCenter.coordinates[1],
    zoom: mapConfig.defaultZoom,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
  };
}

function getMapPreviewUrl(orgSlug: string, bounds: SourceParcelMapBoundsDto, zoom: number) {
  const search = new URLSearchParams({
    west: String(bounds.west),
    south: String(bounds.south),
    east: String(bounds.east),
    north: String(bounds.north),
    zoom: zoom.toFixed(2),
    limit: "50",
  });
  return `/api/org/${orgSlug}/parcels/source/map/previews?${search.toString()}`;
}

function parseApiErrorMessage(payload: unknown) {
  if (payload && typeof payload === "object") {
    const message = "message" in payload ? payload.message : null;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  return "Map parcel previews are currently unavailable.";
}

function getLinkedSiteHref(orgSlug: string, item: SourceParcelItem) {
  const siteParcelId = item.existingSite?.siteParcelId;
  return siteParcelId ? `/${orgSlug}/parcels/${siteParcelId}` : null;
}

function isSelectableWorkspaceState(item: SourceParcelItem) {
  return item.workspaceState !== "GROUPED_SITE_MEMBER";
}

export default function ParcelMapWorkspace({
  orgSlug,
  action,
  mapConfig,
  searchQuery,
  municipalityQuery,
  searchResults,
  searchTotal,
  searchErrorMessage,
}: ParcelMapWorkspaceProps) {
  const mapRef = useRef<MapRef | null>(null);
  const [viewState, setViewState] = useState<ViewState>(() => deriveInitialViewState(mapConfig, searchResults));
  const [basemapMode, setBasemapMode] = useState<ParcelMapBasemapMode>("streets");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [viewportBounds, setViewportBounds] = useState<SourceParcelMapBoundsDto | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState>({
    items: [],
    coverageState: "SEARCH_GUIDANCE_ONLY",
    activeRegion: null,
    minParcelSelectionZoom: mapConfig.minParcelSelectionZoom,
    loading: false,
    error: null,
  });
  const [hoveredParcelId, setHoveredParcelId] = useState<string | null>(null);
  const [focusedParcel, setFocusedParcel] = useState<SourceParcelItem | null>(null);
  const [selectedParcels, setSelectedParcels] = useState<SourceParcelItem[]>([]);
  const [siteName, setSiteName] = useState("");
  const [autoFocusedSearch, setAutoFocusedSearch] = useState(false);

  const activeBasemapStyle = getParcelMapBasemapStyle(basemapMode);
  const regionFeatures = toRegionFeatureCollection(mapConfig.supportedRegions);
  const parcelFeatures = toParcelFeatureCollection(previewState.items);
  const selectedParcelIds = selectedParcels.map((item) => item.id);
  const selectedLockedCount = selectedParcels.filter((item) => item.workspaceState === "EXISTING_STANDALONE_LOCKED").length;
  const selectedIncompleteCount = selectedParcels.filter((item) => !item.hasGeometry || !item.hasLandArea).length;
  const selectedAuthoritySet = Array.from(new Set(selectedParcels.map((item) => item.sourceAuthority)));
  const selectedCombinedArea = selectedParcels.reduce((total, item) => {
    const numeric = Number(item.landAreaSqm ?? "");
    return Number.isFinite(numeric) ? total + numeric : total;
  }, 0);
  const viewportSupportedRegion = viewportBounds
    ? mapConfig.supportedRegions.find((region) => (
      region.bounds.west <= viewportBounds.east
      && region.bounds.east >= viewportBounds.west
      && region.bounds.south <= viewportBounds.north
      && region.bounds.north >= viewportBounds.south
    )) ?? null
    : null;
  const coverageMessage = getCoverageMessage({
    ...previewState,
    activeRegion: previewState.activeRegion ?? viewportSupportedRegion,
  });

  function updateViewportBounds() {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) {
      return;
    }

    setViewportBounds({
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    });
  }

  function focusOnBounds(bounds: BoundsTuple, maxZoom = 17.8) {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.fitBounds(bounds, {
      padding: 72,
      maxZoom,
      duration: 700,
    });
  }

  function focusOnParcel(item: SourceParcelItem) {
    const bounds = getGeometryBounds(item.geom);
    if (bounds) {
      focusOnBounds(bounds, 17.8);
    } else if (item.centroid && mapRef.current) {
      mapRef.current.easeTo({
        center: item.centroid.coordinates,
        zoom: item.sourceAuthority === "CADASTRAL_GRADE"
          ? Math.max(mapConfig.minParcelSelectionZoom, 16.1)
          : 13.2,
        duration: 700,
      });
    }

    setFocusedParcel(item);
  }

  function toggleParcelSelection(item: SourceParcelItem) {
    if (!isSelectableWorkspaceState(item)) {
      setFocusedParcel(item);
      return;
    }

    setSelectedParcels((current) => {
      if (current.some((entry) => entry.id === item.id)) {
        return current.filter((entry) => entry.id !== item.id);
      }
      return [...current, item];
    });
    setFocusedParcel(item);
  }

  function focusOnSupportedRegion() {
    const region = previewState.activeRegion ?? mapConfig.supportedRegions[0] ?? null;
    if (!region) {
      return;
    }

    focusOnBounds([
      [region.bounds.west, region.bounds.south],
      [region.bounds.east, region.bounds.north],
    ], 12.2);
  }

  function resetGermanyView() {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.easeTo({
      center: mapConfig.defaultCenter.coordinates,
      zoom: mapConfig.defaultZoom,
      duration: 700,
    });
  }

  useEffect(() => {
    if (!mapLoaded || autoFocusedSearch || !searchResults.length) {
      return;
    }

    focusOnParcel(searchResults[0]);
    setAutoFocusedSearch(true);
  }, [autoFocusedSearch, mapLoaded, searchResults]);

  useEffect(() => {
    if (!viewportBounds) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPreviewState((current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      try {
        const response = await fetch(
          getMapPreviewUrl(orgSlug, viewportBounds, viewState.zoom),
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(parseApiErrorMessage(payload));
        }

        const nextItems = Array.isArray(payload.items) ? payload.items as SourceParcelItem[] : [];
        if (controller.signal.aborted) {
          return;
        }

        setPreviewState({
          items: nextItems,
          coverageState: payload.coverageState ?? "SEARCH_GUIDANCE_ONLY",
          activeRegion: payload.activeRegion ?? null,
          minParcelSelectionZoom: payload.minParcelSelectionZoom ?? mapConfig.minParcelSelectionZoom,
          loading: false,
          error: null,
        });
        setFocusedParcel((current) => {
          if (!current) {
            return current;
          }
          return nextItems.find((item) => item.id === current.id) ?? current;
        });
        setSelectedParcels((current) => current.map((item) => (
          nextItems.find((candidate) => candidate.id === item.id) ?? item
        )));
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setPreviewState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : "Map parcel previews are currently unavailable.",
        }));
      }
    }, 260);

    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [mapConfig.minParcelSelectionZoom, orgSlug, viewportBounds, viewState.zoom]);

  return (
    <div className="parcel-map-workspace">
      <div className="parcel-map-workspace__rail">
        <SectionCard
          eyebrow="Search to area"
          title="Search, then verify on map"
          description="Use municipality, address, or parcel hints to move the map. Parcel-grade selection is supported in Hessen only for this pass."
        >
          <div className="content-stack">
            <form method="get" action={`/${orgSlug}/parcels/new`} className="content-stack">
              <div className="field-grid field-grid--single">
                <div className="field-stack">
                  <label className="ui-label" htmlFor="source-query">Address, municipality, or parcel hint</label>
                  <input
                    id="source-query"
                    name="q"
                    className="ui-input"
                    defaultValue={searchQuery}
                    placeholder="Frankfurt, parcel id, street address..."
                  />
                </div>
                <div className="field-stack">
                  <label className="ui-label" htmlFor="municipality-query">Municipality filter</label>
                  <input
                    id="municipality-query"
                    name="municipality"
                    className="ui-input"
                    defaultValue={municipalityQuery}
                    placeholder="Optional municipality"
                  />
                </div>
              </div>
              <div className="action-row">
                <button className={buttonClasses()} type="submit">Search and focus map</button>
                <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels/new`}>
                  Reset search
                </Link>
              </div>
            </form>

            {searchErrorMessage ? (
              <Alert tone="warning">
                <AlertTitle>Search guidance is currently limited</AlertTitle>
                <AlertDescription>{searchErrorMessage}</AlertDescription>
              </Alert>
            ) : null}

            {searchResults.length ? (
              <div className="parcel-map-search-results">
                <div className="field-row">
                  <div>
                    <div className="section-kicker">Search results</div>
                    <div className="field-help">{searchTotal} result{searchTotal === 1 ? "" : "s"} available for map guidance.</div>
                  </div>
                  <StatusBadge tone="info">Focus on map first</StatusBadge>
                </div>
                <div className="parcel-map-result-list">
                  {searchResults.map((item) => {
                    const linkedSiteHref = getLinkedSiteHref(orgSlug, item);
                    return (
                      <div key={item.id} className="parcel-map-result-card">
                        <div className="parcel-map-result-card__header">
                          <div>
                            <h3>{item.displayName}</h3>
                            <p>{item.providerName} / {item.providerParcelId}</p>
                          </div>
                          <div className="parcel-map-badge-stack">
                            <StatusBadge tone={getWorkspaceStateTone(item.workspaceState)}>
                              {getWorkspaceStateLabel(item.workspaceState)}
                            </StatusBadge>
                            <StatusBadge tone={getConfidenceTone(getConfidenceBand(item.confidenceScore))}>
                              {getConfidenceBand(item.confidenceScore)} confidence
                            </StatusBadge>
                          </div>
                        </div>
                        <div className="parcel-map-detail-list">
                          <span>{getSourceAuthorityLabel(item.sourceAuthority) ?? "Source-backed"}</span>
                          <span>{item.municipalityName ?? item.city ?? "Germany"}</span>
                          <span>{formatArea(item.landAreaSqm)}</span>
                        </div>
                        <p className="field-help">
                          {item.sourceAuthority === "CADASTRAL_GRADE"
                            ? "Focus on map to verify and select the cadastral parcel geometry."
                            : "Focus on map for location guidance. Parcel-grade click selection is only available in supported Hessen coverage."}
                        </p>
                        <div className="action-row">
                          <button
                            type="button"
                            className={buttonClasses({ size: "sm" })}
                            onClick={() => focusOnParcel(item)}
                          >
                            Focus on map
                          </button>
                          {item.workspaceState === "GROUPED_SITE_MEMBER" && linkedSiteHref ? (
                            <Link className={buttonClasses({ variant: "secondary", size: "sm" })} href={linkedSiteHref}>
                              Open grouped site
                            </Link>
                          ) : (
                            <form action={action}>
                              <input type="hidden" name="sourceParcelId" value={item.id} />
                              <button type="submit" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                                Secondary fallback intake
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : searchQuery || municipalityQuery ? (
              <Alert tone="info">
                <AlertTitle>No search results matched</AlertTitle>
                <AlertDescription>Try a broader municipality or address hint, then use the map to verify parcel-grade availability.</AlertDescription>
              </Alert>
            ) : (
              <p className="field-help">
                Search is the guidance step. The primary workflow is still map selection from supported parcel geometry, not manual parcel entry.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Focused parcel"
          title={focusedParcel ? focusedParcel.displayName : "Click a parcel to inspect it"}
          description={focusedParcel
            ? "The parcel preview below is coming from the provider layer, not from manual drawing."
            : "When you click a parcel in supported Hessen coverage, its provider, authority, completeness, and workspace state show up here."}
        >
          {focusedParcel ? (
            <div className="content-stack">
              <div className="parcel-map-preview-header">
                <div>
                  <div className="section-kicker">{focusedParcel.providerName}</div>
                  <h3>{focusedParcel.providerParcelId}</h3>
                  <p>{focusedParcel.addressLine1 ?? focusedParcel.municipalityName ?? focusedParcel.city ?? "Germany"}</p>
                </div>
                <div className="parcel-map-badge-stack">
                  <StatusBadge tone={getWorkspaceStateTone(focusedParcel.workspaceState)}>
                    {getWorkspaceStateLabel(focusedParcel.workspaceState)}
                  </StatusBadge>
                  <StatusBadge tone={getConfidenceTone(getConfidenceBand(focusedParcel.confidenceScore))}>
                    {getConfidenceBand(focusedParcel.confidenceScore)} confidence
                  </StatusBadge>
                </div>
              </div>

              <div className="parcel-map-detail-grid">
                <div>
                  <div className="section-kicker">Authority</div>
                  <div>{getSourceAuthorityLabel(focusedParcel.sourceAuthority) ?? "Source-backed"}</div>
                  <div className="field-help">{getSourceAuthorityDetail(focusedParcel.sourceAuthority) ?? "Authority not scored."}</div>
                </div>
                <div>
                  <div className="section-kicker">Area</div>
                  <div>{formatArea(focusedParcel.landAreaSqm)}</div>
                  <div className="field-help">{focusedParcel.hasLandArea ? "Derived or fetched automatically." : "Still unresolved from source."}</div>
                </div>
                <div>
                  <div className="section-kicker">Completeness</div>
                  <div>{focusedParcel.hasGeometry && focusedParcel.hasLandArea ? "Source primary" : "Source incomplete"}</div>
                  <div className="field-help">{focusedParcel.hasGeometry ? "Geometry ready." : "Geometry unresolved."} {focusedParcel.hasLandArea ? "Area ready." : "Area unresolved."}</div>
                </div>
                <div>
                  <div className="section-kicker">Workspace</div>
                  <div>{getWorkspaceStateLabel(focusedParcel.workspaceState)}</div>
                  <div className="field-help">{getWorkspaceStateDetail(focusedParcel)}</div>
                </div>
              </div>

              <div className="action-row">
                {focusedParcel.workspaceState === "GROUPED_SITE_MEMBER" ? (
                  getLinkedSiteHref(orgSlug, focusedParcel) ? (
                    <Link className={buttonClasses()} href={getLinkedSiteHref(orgSlug, focusedParcel)!}>
                      Open grouped site
                    </Link>
                  ) : (
                    <span className="field-help">This parcel already belongs to a grouped site and cannot be selected again in this pass.</span>
                  )
                ) : (
                  <button
                    type="button"
                    className={buttonClasses()}
                    onClick={() => toggleParcelSelection(focusedParcel)}
                  >
                    {getSelectionButtonLabel(focusedParcel, selectedParcelIds.includes(focusedParcel.id))}
                  </button>
                )}
                {focusedParcel.existingParcelId ? (
                  <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/${focusedParcel.existingParcelId}`}>
                    Open workspace parcel
                  </Link>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="helper-list">
              <div>Zoom into supported Hessen coverage until parcel polygons appear.</div>
              <div>Click a parcel polygon to preview provider identity, authority, area, and workspace state.</div>
              <div>Select one parcel to intake directly, or multiple parcels to create a grouped site anchor.</div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Selected parcels"
          title={selectedParcels.length ? `${selectedParcels.length} parcel${selectedParcels.length === 1 ? "" : "s"} selected` : "No parcels selected yet"}
          description="This tray becomes the direct parcel or grouped-site intake request. The app fetches geometry and area automatically from source."
        >
          {selectedParcels.length ? (
            <div className="content-stack">
              <div className="parcel-map-selection-summary">
                <div>
                  <div className="section-kicker">Combined selected area</div>
                  <div>{selectedCombinedArea ? `${selectedCombinedArea.toLocaleString("en-US", { maximumFractionDigits: 0 })} sqm` : "Area still partial"}</div>
                </div>
                <div>
                  <div className="section-kicker">Authority mix</div>
                  <div>{selectedAuthoritySet.length > 1 ? "Mixed authority" : getSourceAuthorityLabel(selectedAuthoritySet[0] ?? null) ?? "Unscored"}</div>
                </div>
                <div>
                  <div className="section-kicker">Incomplete members</div>
                  <div>{selectedIncompleteCount}</div>
                </div>
                <div>
                  <div className="section-kicker">Locked members</div>
                  <div>{selectedLockedCount}</div>
                </div>
              </div>

              {selectedIncompleteCount > 0 ? (
                <Alert tone="warning">
                  <AlertTitle>Some selected parcels are source incomplete</AlertTitle>
                  <AlertDescription>
                    Grouped-site creation can still continue with partial area or geometry resolution, but the resulting parcel/site will stay honest about incompleteness.
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedAuthoritySet.length > 1 ? (
                <Alert tone="info">
                  <AlertTitle>Mixed source authority selected</AlertTitle>
                  <AlertDescription>
                    A grouped site with mixed cadastral-grade and search-grade members will preserve that mixed-authority reality in provenance and confidence.
                  </AlertDescription>
                </Alert>
              ) : null}

              {selectedLockedCount > 1 ? (
                <Alert tone="warning">
                  <AlertTitle>Multiple locked parcels may block grouping</AlertTitle>
                  <AlertDescription>
                    If more than one selected standalone parcel already has downstream work, grouped-site creation will return a reconciliation-required conflict instead of silently migrating both.
                  </AlertDescription>
                </Alert>
              ) : null}

              <div className="parcel-map-selected-list">
                {selectedParcels.map((item) => (
                  <div key={item.id} className="parcel-map-selected-item">
                    <div>
                      <strong>{item.displayName}</strong>
                      <div className="field-help">{item.providerName} / {item.providerParcelId} / {formatArea(item.landAreaSqm)}</div>
                    </div>
                    <div className="action-row">
                      <StatusBadge tone={getWorkspaceStateTone(item.workspaceState)}>
                        {getWorkspaceStateLabel(item.workspaceState)}
                      </StatusBadge>
                      <button
                        type="button"
                        className={buttonClasses({ variant: "ghost", size: "sm" })}
                        onClick={() => setSelectedParcels((current) => current.filter((entry) => entry.id !== item.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <form action={action} className="content-stack">
                {selectedParcels.map((item) => (
                  <input key={item.id} type="hidden" name="sourceParcelId" value={item.id} />
                ))}
                {selectedParcels.length > 1 ? (
                  <div className="field-stack">
                    <label className="ui-label" htmlFor="site-name">Optional grouped-site name</label>
                    <input
                      id="site-name"
                      name="siteName"
                      className="ui-input"
                      placeholder="Leave blank to use the deterministic default site name"
                      value={siteName}
                      onChange={(event) => setSiteName(event.target.value)}
                    />
                    <div className="field-help">
                      Grouped-site creation still reuses exact member-set matches, safe migration, and downstream anchor rules from the existing source-backed intake flow.
                    </div>
                  </div>
                ) : null}
                <div className="action-row">
                  <button className={buttonClasses({ size: "lg" })} type="submit">
                    {selectedParcels.length === 1 ? "Add parcel to workspace" : "Create grouped site"}
                  </button>
                  <button
                    type="button"
                    className={buttonClasses({ variant: "secondary" })}
                    onClick={() => setSelectedParcels([])}
                  >
                    Clear selection
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="helper-list">
              <div>Single selection creates or reuses a source-backed parcel identity.</div>
              <div>Multi-selection creates or reuses one grouped site using the existing normalized member-set rules.</div>
              <div>Manual parcel entry remains available, but only as fallback when source-backed selection is not yet available.</div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          eyebrow="Coverage and fallback"
          title="Supported region honesty"
          description="Parcel-grade click selection is explicit about where it works today, and weaker source coverage stays weaker in the UI."
        >
          <div className="content-stack">
            <div className="parcel-map-region-list">
              {mapConfig.supportedRegions.map((region) => (
                <div key={region.id} className="parcel-map-region-card">
                  <div>
                    <strong>{region.name}</strong>
                    <div className="field-help">{region.description}</div>
                  </div>
                  <div className="parcel-map-badge-stack">
                    <StatusBadge tone="success">{getSourceAuthorityLabel(region.sourceAuthority) ?? "Supported"}</StatusBadge>
                    <StatusBadge tone="info">{region.providerName ?? "Provider-backed"}</StatusBadge>
                  </div>
                </div>
              ))}
            </div>
            <Alert tone="info">
              <AlertTitle>Search-guided only elsewhere in Germany</AlertTitle>
              <AlertDescription>
                Outside supported cadastral coverage, the map still helps you navigate to the right area, but parcel-grade click selection is not implied. Use manual parcel create only as fallback.
              </AlertDescription>
            </Alert>
            <div className="action-row">
              <Link className={buttonClasses({ variant: "secondary" })} href={`/${orgSlug}/parcels/new/manual`}>
                Manual fallback
              </Link>
              <Link className={buttonClasses({ variant: "ghost" })} href={`/${orgSlug}/parcels`}>
                Back to parcel board
              </Link>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="parcel-map-workspace__stage">
        <SectionCard
          className="parcel-map-stage-card"
          eyebrow="Map-first intake workspace"
          title="Select real parcel geometry from the map"
          description="The map is the primary source-backed parcel selection surface. Parcel polygons load only where cadastral-grade support exists."
        >
          <div className="parcel-map-stage">
            <div className="parcel-map-stage__toolbar">
              <div className="parcel-map-badge-stack">
                <StatusBadge tone={coverageMessage.tone}>{coverageMessage.title}</StatusBadge>
                <StatusBadge tone="info">Search-guided only elsewhere</StatusBadge>
                <StatusBadge tone="accent">Zoom {mapConfig.minParcelSelectionZoom.toFixed(0)}+ for parcel click selection</StatusBadge>
              </div>
              <div className="parcel-map-stage__controls">
                <div className="parcel-map-style-toggle" role="tablist" aria-label="Basemap style">
                  {(["streets", "satellite"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={mode === basemapMode ? "parcel-map-style-toggle__button is-active" : "parcel-map-style-toggle__button"}
                      onClick={() => setBasemapMode(mode)}
                    >
                      {getParcelMapBasemapLabel(mode)}
                    </button>
                  ))}
                </div>
                <div className="action-row">
                  <button type="button" className={buttonClasses({ variant: "secondary", size: "sm" })} onClick={focusOnSupportedRegion}>
                    Zoom to Hessen support
                  </button>
                  <button type="button" className={buttonClasses({ variant: "ghost", size: "sm" })} onClick={resetGermanyView}>
                    Reset Germany view
                  </button>
                </div>
              </div>
              <div className="field-help">
                Basemap: {getParcelMapBasemapLabel(basemapMode)}. Supported cadastral-grade region: {mapConfig.supportedRegions.map((region) => region.name).join(", ")}.
              </div>
            </div>

            <div className="parcel-map-stage__status">
              <Alert tone={coverageMessage.tone}>
                <AlertTitle>{coverageMessage.title}</AlertTitle>
                <AlertDescription>{coverageMessage.description}</AlertDescription>
              </Alert>
              {previewState.error ? (
                <Alert tone="warning">
                  <AlertTitle>Map previews unavailable</AlertTitle>
                  <AlertDescription>{previewState.error}</AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="parcel-map-canvas">
              {previewState.loading ? <div className="parcel-map-loading">Loading parcel previews...</div> : null}
              <Map
                ref={mapRef}
                mapLib={maplibregl}
                mapStyle={activeBasemapStyle}
                initialViewState={viewState}
                onLoad={() => {
                  setMapLoaded(true);
                  updateViewportBounds();
                }}
                onMove={(event) => {
                  setViewState(event.viewState);
                }}
                onMoveEnd={(event) => {
                  setViewState(event.viewState);
                  updateViewportBounds();
                }}
                onMouseMove={(event) => {
                  const hoveredFeature = event.features?.[0];
                  const hoveredId = hoveredFeature?.properties?.parcelId;
                  setHoveredParcelId(typeof hoveredId === "string" ? hoveredId : null);
                }}
                onMouseLeave={() => setHoveredParcelId(null)}
                onClick={(event) => {
                  const clickedFeature = event.features?.[0];
                  const clickedParcelId = clickedFeature?.properties?.parcelId;
                  if (typeof clickedParcelId !== "string") {
                    return;
                  }
                  const item = previewState.items.find((entry) => entry.id === clickedParcelId);
                  if (item) {
                    setFocusedParcel(item);
                  }
                }}
                interactiveLayerIds={[PARCEL_FILL_LAYER_ID, PARCEL_LINE_LAYER_ID]}
                reuseMaps
              >
                <NavigationControl position="top-right" visualizePitch={false} />
                <ScaleControl position="bottom-left" maxWidth={120} unit="metric" />

                <Source id="supported-regions" type="geojson" data={regionFeatures}>
                  <Layer {...(supportedRegionFillLayer as any)} />
                  <Layer {...(supportedRegionLineLayer as any)} />
                </Source>

                <Source id="parcel-previews" type="geojson" data={parcelFeatures}>
                  <Layer {...(parcelFillLayer as any)} />
                  <Layer {...(parcelLineLayer as any)} />
                  {hoveredParcelId ? (
                    <Layer
                      {...(hoveredLineLayerBase as any)}
                      filter={["==", ["get", "parcelId"], hoveredParcelId]}
                    />
                  ) : null}
                  {selectedParcelIds.length ? (
                    <>
                      <Layer
                        {...(selectedFillLayerBase as any)}
                        filter={["in", ["get", "parcelId"], ["literal", selectedParcelIds]]}
                      />
                      <Layer
                        {...(selectedLineLayerBase as any)}
                        filter={["in", ["get", "parcelId"], ["literal", selectedParcelIds]]}
                      />
                    </>
                  ) : null}
                </Source>
              </Map>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
