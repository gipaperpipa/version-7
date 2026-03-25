import { BadRequestException } from "@nestjs/common";
import type { Geometry, MultiPolygon, Polygon } from "geojson";

export function normalizePolygonGeometryToMultiPolygon(
  geom: Geometry | null | undefined,
): MultiPolygon | null | undefined {
  if (geom === undefined || geom === null) return geom;

  if (geom.type === "MultiPolygon") {
    return geom;
  }

  if (geom.type === "Polygon") {
    return {
      type: "MultiPolygon",
      coordinates: [geom.coordinates],
    };
  }

  throw new BadRequestException(
    "Parcel geometry must be GeoJSON Polygon or MultiPolygon. Polygon input is normalized to MultiPolygon before persistence.",
  );
}
