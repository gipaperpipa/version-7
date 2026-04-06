import type { StyleSpecification } from "maplibre-gl";

export type ParcelMapBasemapMode = "streets" | "satellite";

const DEFAULT_STREETS_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const DEFAULT_SATELLITE_TILE_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEFAULT_SATELLITE_LABELS_TILE_URL = "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places_Alternative/MapServer/tile/{z}/{y}/{x}";

const configuredStreetsStyleUrl = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim() || DEFAULT_STREETS_STYLE_URL;
const configuredSatelliteTileUrl = process.env.NEXT_PUBLIC_MAP_SATELLITE_TILE_URL?.trim() || DEFAULT_SATELLITE_TILE_URL;
const configuredSatelliteLabelsTileUrl = process.env.NEXT_PUBLIC_MAP_SATELLITE_LABELS_TILE_URL?.trim() || DEFAULT_SATELLITE_LABELS_TILE_URL;

const satelliteMapStyle: StyleSpecification = {
  version: 8,
  name: "Feasibility OS satellite",
  sources: {
    satellite: {
      type: "raster",
      tiles: [configuredSatelliteTileUrl],
      tileSize: 256,
      attribution: "Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community",
    },
    labels: {
      type: "raster",
      tiles: [configuredSatelliteLabelsTileUrl],
      tileSize: 256,
      attribution: "Labels © Esri",
    },
  },
  layers: [
    {
      id: "satellite-base",
      type: "raster",
      source: "satellite",
    },
    {
      id: "satellite-labels",
      type: "raster",
      source: "labels",
    },
  ],
};

export function getParcelMapBasemapStyle(mode: ParcelMapBasemapMode) {
  return mode === "satellite" ? satelliteMapStyle : configuredStreetsStyleUrl;
}

export function getParcelMapBasemapLabel(mode: ParcelMapBasemapMode) {
  return mode === "satellite" ? "Satellite" : "Streets";
}
